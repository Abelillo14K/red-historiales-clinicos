// Restaura un respaldo de respaldar.js en un mongod TEMPORAL y lo compara con el origen.
//
//   node scripts/respaldo/restaurar-aislado.js <carpeta-del-respaldo> [--comparar-origen] [--conservar]
//
// - Lanza un mongod propio (tests/soporte/mongodTemporal.js): carpeta temporal, puerto
//   libre, solo 127.0.0.1, sin autenticación. Nunca se conecta a la base original
//   para escribir: se niega a continuar si el destino coincide con el puerto de
//   MONGO_URI o si la base ya existe en el destino. No usa --drop.
// - Verifica el SHA-256 del archivo antes de restaurar.
// - Compara la base restaurada con la huella del manifiesto (estado del origen al
//   respaldar). --comparar-origen además la compara con el origen actual (solo lectura).
// - --conservar deja el mongod temporal en marcha para inspección manual (Ctrl+C lo detiene).
// Escribe verificacion-<fecha>.json en la carpeta del respaldo.
const path = require('node:path');
require('dotenv').config({ quiet: true, path: path.join(__dirname, '..', '..', '..', '..', '.env') });
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { MongoClient } = require('mongodb');
const C = require('./comun');
const { iniciarMongodTemporal } = require('../../tests/soporte/mongodTemporal');

const args = process.argv.slice(2);
const carpeta = args.find(a => !a.startsWith('--'));
const conservar = args.includes('--conservar');

(async () => {
  if (!carpeta) throw new Error('Indique la carpeta del respaldo (respaldos/mongodb/<fecha>)');
  const dir = path.resolve(carpeta);
  const manifiesto = JSON.parse(fs.readFileSync(path.join(dir, 'manifiesto.json'), 'utf8'));
  const archivo = path.join(dir, manifiesto.archivo);
  const suma = C.sha256Archivo(archivo);
  if (suma !== manifiesto.sha256) throw new Error(`SHA-256 no coincide: el archivo está dañado o fue modificado (${suma})`);
  console.log(`Archivo íntegro: ${manifiesto.archivo} · ${manifiesto.tamano_bytes} bytes · SHA-256 verificado`);
  if (!manifiesto.consistente) console.warn('ATENCIÓN: el manifiesto indica que el respaldo NO es consistente.');

  const mongo = await iniciarMongodTemporal();
  if (!mongo) throw new Error('No se encontró mongod (defina MONGOD_BIN)');
  const original = C.destino(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
  let client;
  try {
    // Salvaguardas: el destino es el mongod temporal recién creado, nunca el original.
    if (mongo.port === original.port) throw new Error('El puerto temporal coincide con el del servidor original; se cancela');
    client = new MongoClient(mongo.uri);
    await client.connect();
    const { databases } = await client.db('admin').command({ listDatabases: 1, nameOnly: true });
    if (databases.some(d => d.name === manifiesto.base)) throw new Error('La base ya existe en el destino; se cancela');
    console.log(`Destino aislado: mongod temporal en 127.0.0.1:${mongo.port} (datos en ${mongo.dir})`);

    const mongorestore = C.binarioTools('mongorestore');
    const r = spawnSync(mongorestore, [`--uri=${mongo.uri}`, `--archive=${archivo}`, '--gzip',
      `--nsInclude=${manifiesto.base}.*`, '--stopOnError'], { encoding: 'utf8' });
    const registro = `${r.stdout || ''}${r.stderr || ''}`;
    const marca = C.marcaTiempo();
    fs.writeFileSync(path.join(dir, `mongorestore-${marca}.log`), registro);
    if (r.status !== 0) throw new Error(`mongorestore terminó con código ${r.status} (ver mongorestore-${marca}.log)`);
    const resumen = /(\d+) document\(s\) restored successfully\. (\d+) document\(s\) failed to restore/.exec(registro);
    console.log(`mongorestore: ${resumen ? `${resumen[1]} restaurados, ${resumen[2]} fallidos` : 'ver registro'}`);

    const restaurada = await C.huella(client.db(manifiesto.base));
    const contraManifiesto = C.comparar(manifiesto.huella, restaurada);
    const informe = {
      fecha: new Date().toISOString(), respaldo: path.basename(dir), sha256_verificado: true,
      destino: `mongod temporal 127.0.0.1:${mongo.port}`,
      mongorestore: resumen ? { restaurados: Number(resumen[1]), fallidos: Number(resumen[2]) } : null,
      diferencias_con_manifiesto: contraManifiesto,
      integridad_restaurada: restaurada.integridad,
      colecciones: Object.fromEntries(Object.entries(restaurada.colecciones).map(([n, c]) => [n, {
        documentos: c.documentos, indices: c.indices.map(i => i.name), validador: Boolean(c.validador),
        sha256_documentos: c.sha256_documentos
      }]))
    };

    if (args.includes('--comparar-origen')) {
      const origen = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000, appName: 'pediatria-verificacion' });
      await origen.connect();
      try { informe.diferencias_con_origen_actual = C.comparar(await C.huella(origen.db(manifiesto.base)), restaurada); }
      finally { await origen.close(); }
    }
    fs.writeFileSync(path.join(dir, `verificacion-${marca}.json`), JSON.stringify(informe, null, 2));

    for (const [n, c] of Object.entries(informe.colecciones)) {
      const o = manifiesto.huella.colecciones[n];
      console.log(`  ${n}: origen ${o?.documentos ?? '-'} / restaurada ${c.documentos} documentos · índices ${o?.indices.length ?? '-'}/${c.indices.length} · validador ${o?.validador ? 'sí' : 'no'}/${c.validador ? 'sí' : 'no'} · huella ${o?.sha256_documentos === c.sha256_documentos ? 'idéntica' : 'DISTINTA'}`);
    }
    const i = restaurada.integridad;
    const rotas = ['consultas_con_medico_inexistente', 'controles_con_consulta_inexistente', 'dosis_con_vacuna_inexistente',
      'dosis_con_medico_inexistente', 'ids_repetidos_en_historial'].reduce((n, k) => n + i[k].length, 0) + i.eventos_con_paciente_inexistente + i.eventos_id_evento_repetido;
    console.log(`Historial: ${i.consultas} consultas, ${i.prescripciones} prescripciones, ${i.controles_crecimiento} controles, ${i.dosis} dosis, ${i.eventos_bitacora} eventos de auditoría · referencias rotas o ids repetidos: ${rotas} · eventos pendientes embebidos: ${i.eventos_pendientes_embebidos}`);
    console.log(contraManifiesto.length ? `DIFERENCIAS con el manifiesto: ${contraManifiesto.join('; ')}` : 'Restaurada idéntica al origen respaldado (colecciones, documentos, ids, estructura, índices, validadores e integridad).');
    if (informe.diferencias_con_origen_actual) {
      console.log(informe.diferencias_con_origen_actual.length ? `Origen actual distinto (cambió después del respaldo): ${informe.diferencias_con_origen_actual.join('; ')}` : 'Origen actual: idéntico a la restaurada.');
    }
    if (contraManifiesto.length) process.exitCode = 2;

    if (conservar) {
      console.log(`mongod temporal en marcha: ${mongo.uri} · Ctrl+C para detenerlo y borrar sus datos.`);
      await new Promise(r => process.once('SIGINT', r));
    }
  } finally {
    await client?.close();
    await mongo.detener();
  }
})().catch(e => { console.error(`Error: ${String(e.message).split(process.env.MONGO_URI || '\0').join('<uri>')}`); process.exitCode = 1; });
