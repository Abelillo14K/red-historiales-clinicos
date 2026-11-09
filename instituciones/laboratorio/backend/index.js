'use strict';
// Composición del módulo del laboratorio para el servidor común: conexión, adaptador, casos de uso y router.
// Si PostgreSQL no responde al arrancar, el módulo se monta igual y cada petición responde 503.
const { crearPool } = require('./db');
const { crearRepositoriosPostgres } = require('./adapters/postgres');
const { crearServicios } = require('./application');
const { crearRouterLaboratorio } = require('./app');
const { INSTITUCION, firmarTokenSesion } = require('./security');
const { DomainError } = require('./domain/errors');

// Inicio de sesión con usuario y contraseña para el formulario común: devuelve el JWT de la institución.
// Credenciales incorrectas -> DomainError 401 CREDENCIALES_INVALIDAS; PostgreSQL caído -> DomainError 503.
const crearAutenticador = servicios => async (usuario, contrasena) => {
  let cuenta;
  try {
    cuenta = await servicios.acceso.autenticar(usuario, contrasena);
  } catch (e) {
    if (e instanceof DomainError) throw e;
    console.error(`[laboratorio] inicio de sesión: ${e.message}`);
    throw new DomainError('La base de datos del laboratorio no está disponible', 503, 'MOTOR_NO_DISPONIBLE');
  }
  return { ...cuenta, institucion: INSTITUCION, token: firmarTokenSesion(cuenta) };
};

async function crearModuloLaboratorio(url) {
  const pool = crearPool(url);
  let error = null;
  try {
    await pool.query('SELECT 1 FROM laboratorio.paciente LIMIT 1');
  } catch (e) {
    error = e.message;
  }
  const servicios = crearServicios(crearRepositoriosPostgres(pool));
  return {
    institucion: INSTITUCION,
    nombre: 'Laboratorio Clínico',
    motor: 'PostgreSQL',
    prefijoUsuario: 'lab.',
    router: crearRouterLaboratorio(servicios),
    autenticar: crearAutenticador(servicios),
    error,
    cerrar: () => pool.end()
  };
}

module.exports = { crearModuloLaboratorio, crearAutenticador };
