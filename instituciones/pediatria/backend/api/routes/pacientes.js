'use strict';
// Rutas /api/pacientes: controladores delgados (validar entrada -> caso de uso -> JSON).
const express = require('express');
const S = require('../../schema');
const { asyncRoute: h, validarParametroId } = require('../middleware');
const { rolesCon } = require('../../permisos');

const ESTADO_DOSIS = S.dosis.shape.estado.unwrap();

function rutasPacientes(servicios, roles) {
  const { pacientes, consultas, crecimiento, vacunacion } = servicios;
  const r = express.Router();
  for (const p of ['id', 'consulta', 'tutor', 'esquema']) r.param(p, validarParametroId);
  // Autorización por permiso (backend/permisos.js): misma tabla que recibe el frontend en /api/sesion.
  const permite = p => roles(...rolesCon(p));
  const LISTAR = permite('pacientes.listar');
  const VER_ADMIN = permite('pacientes.ver_administrativo');
  const REGISTRAR = permite('pacientes.registrar');
  const EDITAR = permite('pacientes.editar');
  const CLINICO_LECTURA = permite('historial.leer');
  const MEDICO = permite('clinico.escribir');

  // Pacientes y tutores
  r.get('/', LISTAR, h(async (req, res) => res.json(await pacientes.listar(req.actor, S.listarPacientes.parse(req.query)))));
  r.post('/', REGISTRAR, h(async (req, res) => res.status(201).json(await pacientes.registrar(req.actor, S.patient.parse(req.body)))));
  r.get('/:id', CLINICO_LECTURA, h(async (req, res) => res.json(await pacientes.obtener(req.actor, req.params.id))));
  r.get('/:id/administrativo', VER_ADMIN, h(async (req, res) => res.json(await pacientes.obtenerAdministrativo(req.actor, req.params.id))));
  r.patch('/:id', EDITAR, h(async (req, res) => res.json(await pacientes.actualizarDatos(req.actor, req.params.id, S.patientActualizar.parse(req.body)))));
  r.patch('/:id/tutores', EDITAR, h(async (req, res) => res.json(await pacientes.reemplazarTutores(req.actor, req.params.id, S.tutores.parse(req.body).tutores))));
  r.post('/:id/tutores', EDITAR, h(async (req, res) => res.status(201).json(await pacientes.agregarTutor(req.actor, req.params.id, S.tutor.parse(req.body)))));
  r.put('/:id/tutores/:tutor', EDITAR, h(async (req, res) => res.json(await pacientes.actualizarTutor(req.actor, req.params.id, req.params.tutor, S.tutorActualizar.parse(req.body)))));
  r.patch('/:id/archivar', permite('historial.archivar'), h(async (req, res) => res.json(await pacientes.archivar(req.actor, req.params.id, S.archivar.parse(req.body)))));

  // Consultas, diagnósticos, tratamiento y prescripciones
  r.get('/:id/consultas', CLINICO_LECTURA, h(async (req, res) => res.json(await consultas.listar(req.actor, req.params.id, S.rangoFechas.parse(req.query)))));
  r.post('/:id/consultas', MEDICO, h(async (req, res) => res.status(201).json(await consultas.registrar(req.actor, req.params.id, S.consulta.parse(req.body)))));
  r.post('/:id/consultas/:consulta/diagnosticos', MEDICO, h(async (req, res) => res.status(201).json(await consultas.agregarDiagnostico(req.actor, req.params.id, req.params.consulta, S.diagnostico.parse(req.body)))));
  r.put('/:id/consultas/:consulta/tratamiento', MEDICO, h(async (req, res) => res.json(await consultas.establecerTratamiento(req.actor, req.params.id, req.params.consulta, S.tratamiento.parse(req.body)))));
  r.post('/:id/consultas/:consulta/prescripciones', MEDICO, h(async (req, res) => res.status(201).json(await consultas.agregarPrescripcion(req.actor, req.params.id, req.params.consulta, S.prescripcion.parse(req.body)))));
  r.get('/:id/prescripciones', CLINICO_LECTURA, h(async (req, res) => res.json(await consultas.listarPrescripciones(req.actor, req.params.id))));
  r.get('/:id/diagnosticos', CLINICO_LECTURA, h(async (req, res) => res.json(await consultas.listarDiagnosticos(req.actor, req.params.id))));

  // Crecimiento
  r.get('/:id/crecimiento', CLINICO_LECTURA, h(async (req, res) => res.json(await crecimiento.historial(req.actor, req.params.id))));
  r.post('/:id/crecimiento', MEDICO, h(async (req, res) => res.status(201).json(await crecimiento.registrar(req.actor, req.params.id, S.crecimiento.parse(req.body)))));

  // Vacunación
  r.get('/:id/vacunacion', CLINICO_LECTURA, h(async (req, res) => {
    const estado = req.query.estado === undefined ? undefined : ESTADO_DOSIS.parse(req.query.estado);
    res.json(await vacunacion.esquema(req.actor, req.params.id, { estado }));
  }));
  r.post('/:id/vacunacion', MEDICO, h(async (req, res) => res.status(201).json(await vacunacion.programar(req.actor, req.params.id, S.dosis.parse(req.body)))));
  r.patch('/:id/vacunacion/:esquema/aplicar', MEDICO, h(async (req, res) => res.json(await vacunacion.aplicar(req.actor, req.params.id, req.params.esquema, S.aplicar.parse(req.body)))));
  r.patch('/:id/vacunacion/:esquema/cancelar', MEDICO, h(async (req, res) => res.json(await vacunacion.cancelar(req.actor, req.params.id, req.params.esquema, S.cancelar.parse(req.body)))));

  return r;
}

module.exports = { rutasPacientes };
