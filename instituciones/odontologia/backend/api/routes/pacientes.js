'use strict';
// Rutas /api/pacientes de la clínica: controladores delgados (validar entrada -> caso de uso -> JSON).
const express = require('express');
const S = require('../../schema');
const { asyncRoute: h, validarParametroId } = require('../middleware');

function rutasPacientes({ pacientes, consultas }, permite) {
  const r = express.Router();
  for (const p of ['id', 'consulta']) r.param(p, validarParametroId);
  const CLINICO = permite('clinico.escribir');
  const LEER = permite('historial.leer');

  r.get('/', permite('pacientes.listar'), h(async (req, res) => res.json(await pacientes.listar(req.actor, S.listarPacientes.parse(req.query)))));
  r.post('/', permite('pacientes.registrar'), h(async (req, res) => res.status(201).json(await pacientes.registrar(req.actor, S.paciente.parse(req.body)))));
  r.get('/:id', LEER, h(async (req, res) => res.json(await pacientes.obtener(req.actor, req.params.id))));
  r.get('/:id/administrativo', permite('pacientes.ver_administrativo'), h(async (req, res) => res.json(await pacientes.obtenerAdministrativo(req.actor, req.params.id))));
  r.patch('/:id/archivar', permite('historial.archivar'), h(async (req, res) =>
    res.json(await pacientes.archivar(req.actor, req.params.id, S.archivar.parse(req.body).motivo_archivado))));
  r.put('/:id/piezas/:pieza', CLINICO, h(async (req, res) =>
    res.json(await pacientes.actualizarPieza(req.actor, req.params.id, req.params.pieza, S.estadoPieza.parse(req.body)))));

  // Reglas comunes: registrar consulta, agregar diagnóstico, tratamiento y recetar.
  r.get('/:id/consultas', LEER, h(async (req, res) => res.json(await consultas.listar(req.actor, req.params.id))));
  r.post('/:id/consultas', CLINICO, h(async (req, res) => res.status(201).json(await consultas.registrar(req.actor, req.params.id, S.consulta.parse(req.body)))));
  r.post('/:id/consultas/:consulta/diagnosticos', CLINICO, h(async (req, res) =>
    res.status(201).json(await consultas.agregarDiagnostico(req.actor, req.params.id, req.params.consulta, S.diagnostico.parse(req.body)))));
  r.post('/:id/consultas/:consulta/tratamientos', CLINICO, h(async (req, res) =>
    res.status(201).json(await consultas.agregarTratamiento(req.actor, req.params.id, req.params.consulta, S.tratamiento.parse(req.body)))));
  r.post('/:id/consultas/:consulta/prescripciones', CLINICO, h(async (req, res) =>
    res.status(201).json(await consultas.agregarPrescripcion(req.actor, req.params.id, req.params.consulta, S.prescripcion.parse(req.body)))));
  r.get('/:id/prescripciones', LEER, h(async (req, res) => res.json(await consultas.prescripciones(req.actor, req.params.id))));

  return r;
}

module.exports = { rutasPacientes };
