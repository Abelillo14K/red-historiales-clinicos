'use strict';
// Composición del módulo del laboratorio para el servidor común: conexión, adaptador, casos de uso y router.
// Si PostgreSQL no responde al arrancar, el módulo se monta igual y cada petición responde 503.
const { crearPool } = require('./db');
const { crearRepositoriosPostgres } = require('./adapters/postgres');
const { crearServicios } = require('./application');
const { crearRouterLaboratorio } = require('./app');
const { INSTITUCION } = require('./security');

async function crearModuloLaboratorio(url) {
  const pool = crearPool(url);
  let error = null;
  try {
    await pool.query('SELECT 1 FROM laboratorio.paciente LIMIT 1');
  } catch (e) {
    error = e.message;
  }
  return {
    institucion: INSTITUCION,
    nombre: 'Laboratorio Clínico',
    motor: 'PostgreSQL',
    router: crearRouterLaboratorio(crearServicios(crearRepositoriosPostgres(pool))),
    error,
    cerrar: () => pool.end()
  };
}

module.exports = { crearModuloLaboratorio };
