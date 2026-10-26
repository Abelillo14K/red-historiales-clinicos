// Validadores $jsonSchema de Fase II (centro_pediatrico_db).
//
//   npm run db:validadores                          verificar (solo lectura)
//   npm run db:validadores -- --respaldo            respaldo de validadores y documentos en respaldos/
//   npm run db:validadores -- --aplicar --usuario <admin> [--auth-db admin]
//                                                   respaldo + verificación + collMod
//   npm run db:validadores -- --revertir <carpeta> --usuario <admin>
//                                                   restaura los validadores previos
//
// collMod requiere un usuario con privilegio dbAdmin (el de la aplicación es
// readWrite). La contraseña se pide por teclado sin mostrarse ni guardarse;
// también puede definirse MONGO_ADMIN_URI solo en la sesión de la terminal.
// Ninguna opción elimina ni modifica documentos.
require('dotenv').config({ quiet: true });
const path = require('node:path');
const readline = require('node:readline');
const { MongoClient } = require('mongodb');
const A = require('../backend/adapters/mongo/administracionValidadores');

const args = process.argv.slice(2);
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

function preguntarOculto(pregunta) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.startsWith(pregunta)) rl.output.write(pregunta); };
    rl.question(pregunta, r => { rl.close(); process.stdout.write('\n'); resolve(r); });
  });
}

async function uriAdministrativa() {
  if (process.env.MONGO_ADMIN_URI) return process.env.MONGO_ADMIN_URI;
  const usuario = opcion('--usuario');
  if (!usuario) return null;
  const u = new URL(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
  u.username = encodeURIComponent(usuario);
  u.password = encodeURIComponent(await preguntarOculto(`Contraseña de ${usuario}: `));
  u.searchParams.set('authSource', opcion('--auth-db') || 'admin');
  return u.toString();
}

function mostrarEstado(est) {
  for (const [c, e] of Object.entries(est)) {
    const req = e.validator?.$jsonSchema?.properties?.controles_crecimiento?.items?.required;
    console.log(`  ${c}: ${e.existe ? (e.validator ? 'con validador' : 'sin validador') : 'no existe'}` +
      (req ? ` · perímetro cefálico ${req.includes('perimetro_cefalico_cm') ? 'OBLIGATORIO' : 'opcional'}` : ''));
  }
}

async function main() {
  const necesitaAdmin = args.includes('--aplicar') || args.includes('--revertir');
  const uri = necesitaAdmin ? await uriAdministrativa() : process.env.MONGO_URI;
  if (!uri) throw new Error('Indique --usuario <administrador> (o MONGO_ADMIN_URI) para modificar validadores.');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  try {
    const db = client.db(process.env.MONGO_DB || 'centro_pediatrico_db');
    console.log(`Base: ${db.databaseName}\nValidadores instalados:`);
    mostrarEstado(await A.estado(db));

    if (args.includes('--revertir')) {
      const dir = opcion('--revertir');
      if (!dir) throw new Error('Indique la carpeta del respaldo: --revertir <carpeta>');
      await A.revertir(db, A.leerRespaldo(dir));
      console.log('\nValidadores restaurados desde el respaldo:');
      return mostrarEstado(await A.estado(db));
    }

    console.log('\nVerificación contra el validador de Fase II (solo lectura):');
    const v = await A.verificar(db);
    for (const [c, x] of Object.entries(v)) {
      console.log(`  ${c}: ${x.total} documentos, ${x.incumplen.length} incumplen` + (x.incumplen.length ? ` (_id: ${x.incumplen.join(', ')})` : ''));
    }
    if (!args.includes('--aplicar') && !args.includes('--respaldo')) {
      return console.log('\nModo verificación. Opciones: --respaldo, --aplicar --usuario <admin>, --revertir <carpeta> --usuario <admin>.');
    }
    const dir = path.join(__dirname, '..', '..', '..', 'respaldos', `validadores-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    const r = await A.respaldar(db, dir);
    console.log(`\nRespaldo creado en ${r.dir} (${JSON.stringify(r.conteos)})`);
    if (!args.includes('--aplicar')) return;
    await A.aplicar(db);
    console.log('\nValidadores de Fase II aplicados:');
    mostrarEstado(await A.estado(db));
    console.log(`\nPara revertir: npm run db:validadores -- --revertir "${dir}" --usuario <admin>`);
  } finally {
    await client.close();
  }
}

main().catch(e => {
  console.error(e.codeName === 'Unauthorized' || /not authorized/i.test(e.message)
    ? 'Sin privilegio collMod: use un usuario con rol dbAdmin sobre la base (--usuario <admin>).'
    : e.codeName === 'AuthenticationFailed' ? 'Autenticación fallida: usuario o contraseña incorrectos.' : e.message);
  process.exitCode = 1;
});
