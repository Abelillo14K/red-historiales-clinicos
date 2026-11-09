// Inicio de sesión PROPIO del Hospital (solo modo independiente / desarrollo).
// El inicio de sesión común sigue pendiente del equipo (GUIA_EQUIPO §3.3).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { q } from '../db.js';
import { ah, ApiError } from '../errores.js';
import { validar } from '../utilidades.js';
import { firmarToken } from '../seguridad.js';

export const authRouter = Router();

const login = z.object({ usuario: z.string().min(1).max(50), contrasena: z.string().min(1).max(200) });
const HASH_FALSO = bcrypt.hashSync('no-existe', 10); // iguala el tiempo si el usuario no existe

// Valida la cuenta en MySQL y devuelve la sesión. La usan esta ruta y el inicio de sesión común (modulo.js).
export async function autenticarCuenta(usuario, contrasena) {
  const [u] = await q(
    `SELECT u.id_usuario, u.id_medico, u.nombre_usuario, u.contrasena_hash, u.estado, r.nombre_rol
       FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.nombre_usuario = ?`, [usuario]);
  const ok = await bcrypt.compare(contrasena, u?.contrasena_hash || HASH_FALSO);
  if (!u || !ok || u.estado !== 'Activo') throw new ApiError(401, 'NO_AUTENTICADO', 'Usuario o contraseña incorrectos');
  await q('UPDATE usuario SET ultimo_acceso = NOW() WHERE id_usuario = ?', [u.id_usuario]);
  return { token: firmarToken(u), usuario: u.nombre_usuario, rol: u.nombre_rol };
}

authRouter.post('/auth/login', ah(async (req, res) => {
  const { usuario, contrasena } = validar(login, req.body);
  res.json(await autenticarCuenta(usuario, contrasena));
}));
