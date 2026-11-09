// Uso: npm run db:crear-usuario -- <usuario> <contraseña> <rol> [id_medico]
//   rol: administrador | medico | enfermeria | recepcion
import bcrypt from 'bcryptjs';
import { pool, q } from '../src/db.js';

const [usuario, contrasena, rol, idMedico] = process.argv.slice(2);
if (!usuario || !contrasena || !rol) {
  console.error('Uso: npm run db:crear-usuario -- <usuario> <contraseña> <rol> [id_medico]');
  process.exit(1);
}
if (contrasena.length < 10) { console.error('La contraseña debe tener al menos 10 caracteres'); process.exit(1); }
const [r] = await q('SELECT id_rol FROM rol WHERE nombre_rol = ?', [rol]);
if (!r) { console.error(`Rol inexistente: ${rol}`); process.exit(1); }
const hash = await bcrypt.hash(contrasena, 12);
await q('INSERT INTO usuario (id_medico, nombre_usuario, contrasena_hash, id_rol) VALUES (?,?,?,?)', [idMedico ? Number(idMedico) : null, usuario, hash, r.id_rol]);
console.log(`Usuario ${usuario} (${rol}) creado.`);
await pool.end();
