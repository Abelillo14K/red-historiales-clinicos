// Crea las cuentas iniciales (una por rol) con contraseñas aleatorias y las deja en
// CREDENCIALES_ACCESO.txt, en la raíz del repositorio (excluido de Git).
//
//   npm run db:crear-accesos
//
// No muestra contraseñas en pantalla. No modifica cuentas existentes ni sobrescribe
// el archivo de credenciales: si encuentra alguno de los dos, se detiene sin cambiar nada.
const path = require('node:path');
const RAIZ = path.join(__dirname, '..', '..', '..');
require('dotenv').config({ quiet: true, path: path.join(RAIZ, '.env') });
const fs = require('node:fs');
const crypto = require('node:crypto');
const { connect, client } = require('../backend/db');
const { asegurarIndices, exigirIndicesEsenciales } = require('../backend/adapters/mongo');
const { crearUsuarioRepository } = require('../backend/adapters/mongo/repositorios');
const { cifrarContrasena } = require('../backend/contrasenas');

const ARCHIVO = path.join(RAIZ, 'CREDENCIALES_ACCESO.txt');
const CUENTAS = [
  { usuario: 'admin', nombre: 'Administrador', rol: 'administrador' },
  { usuario: 'medico', nombre: 'Médico', rol: 'medico' },
  { usuario: 'secretaria', nombre: 'Secretaría', rol: 'secretaria' }
];

function contenido(cuentas, nombreDb) {
  const puerto = process.env.PORT || 3001;
  return [
    'RED DE HISTORIALES CLÍNICOS - DATOS DE ACCESO',
    'CONFIDENCIAL: no subir a Git ni publicar. Compartir solo por un medio privado.',
    `Creado: ${new Date().toISOString()}`,
    '',
    'APLICACIÓN',
    `  Dirección: http://localhost:${puerto}`,
    '  Arranque:  npm run build  y luego  npm start',
    '',
    'USUARIOS (una cuenta por rol)',
    ...cuentas.flatMap(c => [`  Rol:        ${c.rol}`, `  Usuario:    ${c.usuario}`, `  Contraseña: ${c.contrasena}`, '']),
    'BASE DE DATOS',
    `  Base:      ${nombreDb}`,
    `  MONGO_URI: ${process.env.MONGO_URI || 'mongodb://127.0.0.1:27017'}`,
    ''
  ].join('\r\n');
}

async function main() {
  if (fs.existsSync(ARCHIVO)) throw new Error('Ya existe CREDENCIALES_ACCESO.txt; no se sobrescribe.');
  const db = await connect();
  exigirIndicesEsenciales(await asegurarIndices(db));
  const repo = crearUsuarioRepository(db);
  for (const c of CUENTAS) {
    if (await repo.obtenerPorUsuario(c.usuario)) throw new Error(`La cuenta "${c.usuario}" ya existe; no se modificó nada.`);
  }
  const cuentas = CUENTAS.map(c => ({ ...c, contrasena: crypto.randomBytes(15).toString('base64url') }));
  // Primero el archivo: una cuenta creada sin su contraseña anotada quedaría inutilizable.
  fs.writeFileSync(ARCHIVO, contenido(cuentas, db.databaseName), { flag: 'wx', mode: 0o600 });
  let creadas = 0;
  try {
    for (const { contrasena, ...c } of cuentas) {
      await repo.crear({ ...c, contrasena_hash: await cifrarContrasena(contrasena), activo: true, fecha_registro: new Date() });
      creadas++;
      console.log(`Cuenta creada: ${c.usuario} (${c.rol})`);
    }
  } catch (e) {
    if (!creadas) fs.rmSync(ARCHIVO, { force: true });
    throw e;
  }
  console.log('Credenciales guardadas en CREDENCIALES_ACCESO.txt');
}

main().catch(e => {
  console.error(e.codeName === 'Unauthorized' ? 'MongoDB rechazó la operación: revise el usuario y la contraseña de MONGO_URI en .env.' : e.message);
  process.exitCode = 1;
}).finally(() => client.close());
