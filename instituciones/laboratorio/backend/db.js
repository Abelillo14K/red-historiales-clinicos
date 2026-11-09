'use strict';
// Conexión PostgreSQL del laboratorio. La URL (con credenciales) solo se lee de variables de entorno.
const { Pool } = require('pg');

function crearPool(url = process.env.LABORATORIO_DB_URL) {
  if (!url) throw new Error('Configure LABORATORIO_DB_URL');
  const pool = new Pool({
    connectionString: url,
    application_name: 'laboratorio-clinico-api',
    connectionTimeoutMillis: 8000,
    max: 20
  });
  // Un cliente inactivo que pierde la conexión no debe tumbar el servidor común.
  pool.on('error', e => console.error(`[laboratorio] conexión PostgreSQL perdida: ${e.message}`));
  return pool;
}

module.exports = { crearPool };
