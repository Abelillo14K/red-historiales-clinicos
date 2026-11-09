// Composición del Hospital para el servidor común (mismo contrato que Laboratorio y Odontología).
// Si MySQL no responde al arrancar, el módulo se monta igual y cada petición responde 503.
import { Router } from 'express';
import { config } from './config.js';
import { pool } from './db.js';
import { ApiError, manejador, noEncontrada } from './errores.js';
import { crearRouterHospital } from './router.js';
import { autenticarCuenta } from './rutas/auth.js';

// El servidor común lee `status` y `code` de los errores de inicio de sesión.
const errorDeSesion = (status, code, mensaje) => Object.assign(new ApiError(status, code, mensaje), { code });

async function autenticar(usuario, contrasena) {
  try {
    return { ...await autenticarCuenta(usuario, contrasena), institucion: config.institucion };
  } catch (e) {
    if (e instanceof ApiError) throw errorDeSesion(e.status, e.status === 401 ? 'CREDENCIALES_INVALIDAS' : e.codigo, e.message);
    console.error(`[hospital] inicio de sesión: ${e.code || e.message}`);
    throw errorDeSesion(503, 'MOTOR_NO_DISPONIBLE', 'La base de datos del Hospital no está disponible');
  }
}

export async function crearModuloHospital() {
  let error = null;
  try {
    await pool.query('SELECT 1 FROM usuario LIMIT 1');
  } catch (e) {
    error = e.code || e.message;
  }
  // Sus errores (ApiError y MySQL) se responden aquí, con el formato común.
  const router = Router();
  router.use(crearRouterHospital(), noEncontrada, manejador);
  return {
    institucion: config.institucion,
    nombre: 'Hospital General',
    motor: 'MySQL',
    prefijoUsuario: 'hosp.',
    router,
    autenticar,
    error,
    cerrar: () => pool.end()
  };
}
