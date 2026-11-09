'use strict';
// Adaptador primario HTTP del laboratorio: un router montable en el enrutador por institución
// del servidor común (docs/GUIA_EQUIPO.md §6). No conoce PostgreSQL: recibe los servicios ya construidos.
const express = require('express');
const { requireAuth, crearRoles } = require('./security');
const { rolesCon } = require('./permisos');
const { manejadorErrores } = require('./api/middleware');
const { rutasPacientes } = require('./api/routes/pacientes');
const { rutasLaboratorio } = require('./api/routes/laboratorio');
const { rutasGenerales } = require('./api/routes/generales');

function crearRouterLaboratorio(servicios) {
  const roles = crearRoles(req => {
    const id = /\/pacientes\/([A-Za-z0-9_-]{1,40})/.exec(req.baseUrl + req.path)?.[1];
    servicios.comun.auditar(req.actor, 'ACCESO_DENEGADO', {
      id_paciente: id || null, resultado: 'DENEGADO', detalle: `${req.method} ${req.baseUrl}${req.path}`
    }).catch(() => {});
  });
  // Autorización por permiso (permisos.js): misma tabla que recibe el frontend en /api/sesion.
  const permite = permiso => roles(...rolesCon(permiso));

  const r = express.Router();
  r.use(requireAuth);
  r.use('/pacientes', rutasPacientes(servicios, permite));
  r.use('/', rutasLaboratorio(servicios, permite));
  r.use('/', rutasGenerales(servicios, permite, roles));
  r.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada', codigo: 'RUTA_NO_ENCONTRADA' }));
  r.use(manejadorErrores);
  return r;
}

module.exports = { crearRouterLaboratorio };
