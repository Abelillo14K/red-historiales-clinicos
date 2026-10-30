// Crea los índices de la aplicación (idempotente, no destructivo). No inserta ni borra documentos.
require('dotenv').config({ quiet: true });
const { connect, client } = require('../backend/db');
const { asegurarIndices, exigirIndicesEsenciales } = require('../backend/adapters/mongo');

async function main() {
  const db = await connect();
  const resultados = await asegurarIndices(db);
  for (const r of resultados) {
    console.log(`${r.ok ? 'OK ' : 'ERR'} ${r.coleccion}: ${r.indice}${r.ok ? '' : ` (${r.error})`}`);
  }
  exigirIndicesEsenciales(resultados);
  if (resultados.some(r => !r.ok)) process.exitCode = 1;
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => client.close());
