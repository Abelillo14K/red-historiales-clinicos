// Diagnóstico de SOLO LECTURA de centro_pediatrico_db antes de un respaldo.
//
//   node scripts/respaldo/diagnostico.js
//
// Usa MONGO_URI/MONGO_DB de .env sin mostrarlos. Solo ejecuta hello, buildInfo,
// listCollections, listIndexes, countDocuments y dbStats: no escribe nada ni
// imprime datos personales (solo nombres de colecciones, conteos e índices).
require('dotenv').config({ quiet: true, path: require('node:path').join(__dirname, '..', '..', '..', '..', '.env') });
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000, appName: 'pediatria-diagnostico' });
  await client.connect();
  try {
    const db = client.db(process.env.MONGO_DB || 'centro_pediatrico_db');
    const hello = await db.command({ hello: 1 });
    const build = await db.command({ buildInfo: 1 });
    const stats = await db.command({ dbStats: 1 });
    console.log(`Servidor: MongoDB ${build.version} · ${hello.setName ? `replica set ${hello.setName}` : 'standalone (sin replica set)'} · primario escribible: ${hello.isWritablePrimary}`);
    console.log(`Base: ${db.databaseName} · ${stats.collections} colecciones · ${stats.objects} documentos · datos ${stats.dataSize} B · almacenamiento ${stats.storageSize} B · índices ${stats.indexSize} B`);
    for (const c of (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
      const col = db.collection(c.name);
      const n = await col.countDocuments({});
      const v = c.options?.validator;
      console.log(`\n${c.name} (${c.type}) · ${n} documentos · validador: ${v ? `${c.options.validationLevel || 'strict'}/${c.options.validationAction || 'error'}` : 'ninguno'}`);
      for (const i of await col.listIndexes().toArray()) {
        const extra = ['unique', 'sparse', 'partialFilterExpression'].filter(k => i[k] !== undefined).map(k => `${k}=${JSON.stringify(i[k])}`);
        console.log(`  índice ${i.name}: ${JSON.stringify(i.key)} ${extra.join(' ')}`);
      }
    }
  } finally { await client.close(); }
})().catch(e => { console.error(`Error: ${e.codeName || e.message}`); process.exitCode = 1; });
