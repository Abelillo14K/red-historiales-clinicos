'use strict';
// Rutas de catálogos, panel, auditoría y sesión (bajo /api, autenticadas).
const express = require('express');
const S = require('../../schema');
const { asyncRoute: h, validarParametroId } = require('../middleware');
const { permisosDe, rolesCon } = require('../../permisos');

function rutasGenerales(servicios, roles) {
  const { catalogos, vacunacion, panel, auditoria } = servicios;
  const r = express.Router();
  r.param('id', validarParametroId);
  const permite = p => roles(...rolesCon(p));
  const TODOS = roles('medico', 'secretaria', 'administrador');
  const CATALOGOS = permite('catalogos.ver');
  const EDITAR_CATALOGOS = permite('catalogos.editar');

  r.get('/sesion', TODOS, h(async (req, res) => res.json({
    usuario: req.actor.id, rol: req.actor.rol, institucion: req.actor.institucion,
    institucion_nombre: req.modulo?.nombre ?? null, motor: req.modulo?.motor ?? null,
    permisos: permisosDe(req.actor.rol),
    expira: new Date(req.actor.exp * 1000).toISOString(),
    capacidades: await servicios.capacidades()
  })));
  r.get('/panel', permite('panel.ver'), h(async (req, res) => res.json(await panel.resumen(req.actor))));

  r.get('/medicos', CATALOGOS, h(async (req, res) => {
    const especialidad = req.query.especialidad ? S.medico.shape.especialidad.shape.nombre.parse(req.query.especialidad) : undefined;
    res.json(await catalogos.listarMedicos({ especialidad }));
  }));
  r.get('/medicos/:id', CATALOGOS, h(async (req, res) => res.json(await catalogos.obtenerMedico(req.params.id))));
  r.post('/medicos', EDITAR_CATALOGOS, h(async (req, res) => res.status(201).json(await catalogos.crearMedico(req.actor, S.medico.parse(req.body)))));
  r.get('/especialidades', CATALOGOS, h(async (req, res) => res.json(await catalogos.especialidades())));

  r.get('/vacunas', CATALOGOS, h(async (req, res) => res.json(await catalogos.listarVacunas())));
  r.post('/vacunas', EDITAR_CATALOGOS, h(async (req, res) => res.status(201).json(await catalogos.crearVacuna(req.actor, S.vacuna.parse(req.body)))));
  r.get('/vacunacion/pendientes', permite('historial.leer'), h(async (req, res) => {
    const { limite } = S.filtroAuditoria.pick({ limite: true }).parse(req.query);
    res.json(await vacunacion.pendientes(req.actor, { limite: Math.min(limite, 100) }));
  }));

  r.get('/auditoria', permite('auditoria.leer'), h(async (req, res) => res.json(await auditoria.listar(S.filtroAuditoria.parse(req.query)))));
  // Ruta original de Fase II conservada por compatibilidad.
  r.get('/auditoria/:id', permite('auditoria.leer'), h(async (req, res) => res.json(await auditoria.listar({ id_paciente: req.params.id, limite: 100 }))));
  return r;
}

module.exports = { rutasGenerales };
