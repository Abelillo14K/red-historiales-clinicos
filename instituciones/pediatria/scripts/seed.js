// Crea los índices de la aplicación (idempotente, no destructivo). No inserta ni borra documentos.
require('dotenv').config({ quiet: true });
const { connect, client } = require('../backend/db');
const { asegurarIndices } = require('../backend/adapters/mongo');

async function main() {
  const db = await connect();
  for (const r of await asegurarIndices(db)) {
    console.log(`${r.ok ? 'OK ' : 'ERR'} ${r.coleccion}: ${r.indice}${r.ok ? '' : ` (${r.error})`}`);
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => client.close());
