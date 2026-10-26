// Respaldo BSON completo de centro_pediatrico_db con mongodump (MongoDB Database Tools).
//
//   node scripts/respaldo/respaldar.js [--salida <carpeta>]
//
// - SOLO LECTURA sobre la base: mongodump lee; el script solo hace find/listIndexes.
// - La URI con credenciales se lee de .env y se entrega a mongodump en un archivo
//   --config temporal (no aparece en la línea de comandos ni en los registros) que se
//   borra al terminar. El respaldo no contiene credenciales.
// - Standalone sin --oplog: no hay instantánea. Se calcula la huella de la base antes
//   y después del volcado; si cambió, el respaldo se marca NO consistente (código 2).
//   Detenga la API (npm run dev / npm start) durante el respaldo.
//
// Resultado en respaldos/mongodb/<fecha>/:
//   centro_pediatrico_db.archive.gz   archivo mongodump (--archive --gzip): BSON + índices + validadores
//   manifiesto.json                   huella del origen, versiones, tamaño y SHA-256
//   SHA256SUMS.txt                    suma del archivo (sha256sum -c)
const path = require('node:path');
require('dotenv').config({ quiet: true, path: path.join(__dirname, '..', '..', '..', '..', '.env') });
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { MongoClient } = require('mongodb');
const C = require('./comun');

const args = process.argv.slice(2);
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const nombreDb = process.env.MONGO_DB || 'centro_pediatrico_db';
  const mongodump = C.binarioTools('mongodump');
  const version = spawnSync(mongodump, ['--version'], { encoding: 'utf8' }).stdout.split('\n')[0].trim();
  const salida = path.resolve(opcion('--salida') || path.join(C.RAIZ, 'respaldos', 'mongodb', C.marcaTiempo()));
  if (fs.existsSync(salida) && fs.readdirSync(salida).length) throw new Error(`La carpeta de salida no está vacía: ${salida}`);
  fs.mkdirSync(salida, { recursive: true });
  const archivo = path.join(salida, `${nombreDb}.archive.gz`);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, appName: 'pediatria-respaldo' });
  await client.connect();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pediatria-respaldo-'));
  try {
    const db = client.db(nombreDb);
    const servidor = (await db.command({ buildInfo: 1 })).version;
    const hello = await db.command({ hello: 1 });
    console.log(`Origen: MongoDB ${servidor} ${hello.setName ? 'replica set' : 'standalone'} · base ${nombreDb} · ${version}`);

    const antes = await C.huella(db);
    const inicio = new Date();
    // Archivo de configuración con la URI: solo lo lee mongodump y se elimina en finally.
    const config = path.join(tmp, 'mongodump.yaml');
    fs.writeFileSync(config, `uri: '${uri.replace(/'/g, "''")}'\n`, { mode: 0o600 });
    const r = spawnSync(mongodump, [`--config=${config}`, `--db=${nombreDb}`, `--archive=${archivo}`, '--gzip'], { encoding: 'utf8' });
    const registro = `${r.stdout || ''}${r.stderr || ''}`.split(uri).join('<uri>');
    fs.writeFileSync(path.join(salida, 'mongodump.log'), registro);
    if (r.status !== 0) throw new Error(`mongodump terminó con código ${r.status} (ver ${path.join(salida, 'mongodump.log')})`);
    const fin = new Date();
    const despues = await C.huella(db);
    const cambios = C.comparar(antes, despues);

    const tamano = fs.statSync(archivo).size;
    const suma = C.sha256Archivo(archivo);
    const manifiesto = {
      formato: 'mongodump --archive --gzip (BSON, con índices y opciones de colección/validadores)',
      base: nombreDb, servidor, topologia: hello.setName ? 'replica set' : 'standalone', herramienta: version,
      inicio: inicio.toISOString(), fin: fin.toISOString(),
      consistente: cambios.length === 0, cambios_durante_respaldo: cambios,
      archivo: path.basename(archivo), tamano_bytes: tamano, sha256: suma,
      huella: antes
    };
    fs.writeFileSync(path.join(salida, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
    fs.writeFileSync(path.join(salida, 'SHA256SUMS.txt'), `${suma}  ${path.basename(archivo)}\n`);

    for (const [n, c] of Object.entries(antes.colecciones)) {
      console.log(`  ${n}: ${c.documentos} documentos · ${c.indices.length} índices · validador ${c.validador ? 'sí' : 'no'}`);
    }
    console.log(`Archivo: ${archivo}\nTamaño: ${tamano} bytes · SHA-256 ${suma}`);
    if (cambios.length) {
      console.error(`NO CONSISTENTE: la base cambió durante el respaldo (${cambios.join('; ')}). Detenga la API y repita.`);
      process.exitCode = 2;
    } else {
      console.log('Consistente: la huella de la base no cambió durante el volcado.');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    await client.close();
  }
})().catch(e => { console.error(`Error: ${String(e.message).split(process.env.MONGO_URI || '\0').join('<uri>')}`); process.exitCode = 1; });
