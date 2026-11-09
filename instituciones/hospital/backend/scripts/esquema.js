// Crea la base del Hospital, sus datos base y el usuario de aplicación.
//   npm run hospital:esquema
// Usa HOSPITAL_ADMIN_USER y HOSPITAL_ADMIN_PASSWORD (cuenta con permiso para crear bases).
// Si la base ya tiene sus tablas, no la modifica ni borra nada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql');
const BASE = 'historial_clinico'; // nombre fijo en 01_esquema.sql
const leer = archivo => fs.readFileSync(path.join(SQL, archivo), 'utf8');

async function crearUsuarioDeAplicacion(c, usuario, clave) {
  for (const host of ['localhost', '127.0.0.1']) {
    await c.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [usuario, host, clave]);
    await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${BASE}.* TO ?@?`, [usuario, host]);
  }
  console.log(`Usuario de aplicación listo: ${usuario} (si ya existía, conserva su contraseña).`);
}

async function main() {
  if (process.env.HOSPITAL_DB_NAME && process.env.HOSPITAL_DB_NAME !== BASE) {
    throw new Error(`Los archivos SQL crean la base ${BASE}; ajuste HOSPITAL_DB_NAME`);
  }
  const admin = process.env.HOSPITAL_ADMIN_USER || 'root';
  const c = await mysql.createConnection({
    host: process.env.HOSPITAL_DB_HOST || '127.0.0.1',
    port: Number(process.env.HOSPITAL_DB_PORT || 3306),
    user: admin,
    password: process.env.HOSPITAL_ADMIN_PASSWORD || '',
    charset: 'utf8mb4',
    multipleStatements: true
  });
  try {
    const [[{ n }]] = await c.query(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = ? AND table_name = 'paciente'", [BASE]);
    if (n) {
      console.log(`La base ${BASE} ya existe: no se modificó.`);
    } else {
      await c.query(leer('01_esquema.sql'));
      await c.query(leer('02_datos_base.sql'));
      const [[{ t }]] = await c.query('SELECT COUNT(*) t FROM information_schema.tables WHERE table_schema = ?', [BASE]);
      console.log(`Base ${BASE} creada: ${t} tablas y datos base.`);
    }
    const usuario = process.env.HOSPITAL_DB_USER;
    if (usuario && usuario !== admin) {
      if (!process.env.HOSPITAL_DB_PASSWORD) throw new Error('Configure HOSPITAL_DB_PASSWORD para crear el usuario de aplicación');
      await crearUsuarioDeAplicacion(c, usuario, process.env.HOSPITAL_DB_PASSWORD);
    }
  } finally {
    await c.end();
  }
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
