'use strict';
// Punto de entrada: conecta el adaptador MongoDB a los casos de uso y expone la API.
require('dotenv').config({ quiet: true });
const { connect, client } = require('./db');
const { crearRepositoriosMongo, asegurarIndices, exigirIndicesEsenciales } = require('./adapters/mongo');
const { crearServicios } = require('./application');
const { crearApp, devLoginHabilitado } = require('./app');
const { secretoValido } = require('./security');

async function start() {
  if (!secretoValido()) throw Error('Configure JWT_SECRET de al menos 32 caracteres');
  const db = await connect();
  await db.command({ ping: 1 });
  const indices = await asegurarIndices(db);
  exigirIndicesEsenciales(indices);
  for (const r of indices) {
    if (!r.ok) console.warn(`[indices] ${r.coleccion} ${r.indice}: ${r.error}`);
  }
  const repos = crearRepositoriosMongo(client, db);
  const transacciones = await repos.unidad.soportaTransacciones();
  const { perimetro_cefalico_opcional } = await repos.capacidades();
  // Entrega los eventos de auditoría que hubieran quedado pendientes (outbox).
  const reenviar = () => repos.unidad.reenviarPendientes()
    .then(n => n && console.log(`[auditoria] ${n} evento(s) pendiente(s) entregado(s) a bitacora_acceso`))
    .catch(e => console.error(`[auditoria] reenvío de pendientes: ${e.message}`));
  await reenviar();
  setInterval(reenviar, 60_000).unref();
  const app = crearApp(crearServicios(repos));
  const port = Number(process.env.PORT) || 3001;
  const server = app.listen(port, () => {
    console.log(`Centro pediátrico API: http://localhost:${port}`);
    console.log(`MongoDB conectado. Transacciones multidocumento: ${transacciones ? 'sí (replica set)' : 'no (servidor standalone; auditoría por outbox embebido)'}`);
    console.log(`Perímetro cefálico: ${perimetro_cefalico_opcional ? 'opcional (validador Fase II)' : 'obligatorio (validador instalado; ver npm run db:validadores)'}`);
    if (devLoginHabilitado()) console.log('Inicio de sesión de desarrollo: activo solo para peticiones desde este equipo (127.0.0.1/::1).');
  });
  server.on('error', e => {
    console.error(e.code === 'EADDRINUSE' ? `El puerto ${port} ya está en uso (¿otra instancia de la API?). Cambie PORT o detenga la otra.` : e.message);
    client.close().finally(() => process.exit(1));
  });
  const cerrar = () => server.close(() => client.close().finally(() => process.exit(0)));
  process.once('SIGINT', cerrar);
  process.once('SIGTERM', cerrar);
  return server;
}

if (require.main === module) start().catch(e => { console.error(e.message); process.exitCode = 1; client.close(); });
module.exports = { start };
