'use strict';
// Rutas /api/pacientes del laboratorio: controladores delgados (validar entrada -> caso de uso -> JSON).
const express = require('express');
const S = require('../../schema');
const { asyncRoute: h, validarParametroId } = require('../middleware');

function rutasPacientes({ pacientes, solicitudes }, permite) {
  const r = express.Router();
  r.param('id', validarParametroId);

  r.get('/', permite('pacientes.listar'), h(async (req, res) => res.json(await pacientes.listar(req.actor, S.listarPacientes.parse(req.query)))));
  r.post('/', permite('pacientes.registrar'), h(async (req, res) => res.status(201).json(await pacientes.registrar(req.actor, S.paciente.parse(req.body)))));
  r.get('/:id', permite('historial.leer'), h(async (req, res) => res.json(await pacientes.obtener(req.actor, req.params.id))));
  r.get('/:id/administrativo', permite('pacientes.ver_administrativo'), h(async (req, res) => res.json(await pacientes.obtenerAdministrativo(req.actor, req.params.id))));
  r.patch('/:id/archivar', permite('historial.archivar'), h(async (req, res) =>
    res.json(await pacientes.archivar(req.actor, req.params.id, S.archivar.parse(req.body).motivo_archivado))));

  // Registrar consulta (regla común) = crear una solicitud de exámenes para el paciente.
  r.post('/:id/solicitudes', permite('laboratorio.solicitudes.crear'), h(async (req, res) =>
    res.status(201).json(await solicitudes.crear(req.actor, req.params.id, S.solicitud.parse(req.body)))));

  return r;
}

module.exports = { rutasPacientes };
