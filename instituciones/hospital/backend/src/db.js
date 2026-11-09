import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,        // fechas como texto, sin conversiones de zona horaria
  charset: 'utf8mb4'
});

// Consulta parametrizada. `c` permite reutilizar la conexión de una transacción.
export async function q(sql, params = [], c = pool) {
  const [filas] = await c.query(sql, params);
  return filas;
}

export async function tx(fn) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const r = await fn(c);
    await c.commit();
    return r;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
