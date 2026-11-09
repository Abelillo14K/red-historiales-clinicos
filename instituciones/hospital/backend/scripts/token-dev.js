// Uso: npm run token:dev -- <usuario>   → imprime un JWT para probar con curl (el usuario debe existir)
import { pool, q } from '../src/db.js';
import { firmarToken } from '../src/seguridad.js';

const [usuario] = process.argv.slice(2);
const [u] = await q(`SELECT u.id_usuario, u.id_medico, u.nombre_usuario, r.nombre_rol FROM usuario u JOIN rol r USING (id_rol) WHERE u.nombre_usuario = ?`, [usuario]);
if (!u) { console.error('Usuario no encontrado'); process.exit(1); }
console.log(firmarToken(u));
await pool.end();
