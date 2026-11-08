'use strict';
// Conexión PostgreSQL del laboratorio. La URL (con credenciales) solo se lee de variables de entorno.
const { Pool } = require('pg');

function crearPool(url = process.env.LABORATORIO_DB_URL) {
  if (!url) throw new Error('Configure LABORATORIO_DB_URL');
  return new Pool({
    connectionString: url,
    application_name: 'laboratorio-clinico-api',
    connectionTimeoutMillis: 8000,
    max: 20
  });
}

module.exports = { crearPool };
