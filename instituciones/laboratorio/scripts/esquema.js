'use strict';
// Aplica el esquema del laboratorio en una transacción (idempotente, no borra datos).
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { crearPool } = require('../backend/db');

const ESQUEMA = path.join(__dirname, '..', 'backend', 'adapters', 'postgres', 'esquema.sql');

async function main() {
  const pool = crearPool();
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(fs.readFileSync(ESQUEMA, 'utf8'));
    await cliente.query('COMMIT');
    const { rows } = await cliente.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'laboratorio'");
    console.log(`Esquema laboratorio aplicado: ${rows[0].n} tablas.`);
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
