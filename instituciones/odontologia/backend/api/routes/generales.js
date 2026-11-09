'use strict';
// Rutas de sesión, panel, citas, catálogos y bitácora de la clínica (bajo /api, autenticadas).
const express = require('express');
const S = require('../../schema');
const R = require('../../domain/reglas');
const { asyncRoute: h, validarParametroId } = require('../middleware');
const { permisosDe, ROLES } = require('../../permisos');

function rutasGenerales({ catalogos, citas, panel, auditoria }, permite, roles) {
  const r = express.Router();
  r.param('id', validarParametroId);
  const VER = permite('catalogos.ver');
  const EDITAR = permite('catalogos.editar');
  const alta = (crear, esquema) => h(async (req, res) => res.status(201).json(await crear(req.actor, esquema.parse(req.body))));

  r.get('/sesion', roles(...ROLES), (req, res) => res.json({
    usuario: req.actor.id, rol: req.actor.rol, institucion: req.actor.institucion,
    institucion_nombre: req.modulo?.nombre ?? null, motor: req.modulo?.motor ?? null,
    permisos: permisosDe(req.actor.rol),
    expira: new Date(req.actor.exp * 1000).toISOString(),
    capacidades: { prescripciones: true, piezas: R.PIEZAS, estados_pieza: R.ESTADOS_PIEZA }
  }));
  r.get('/panel', permite('panel.ver'), h(async (req, res) => res.json(await panel.resumen(req.actor))));

  // Agenda: por defecto desde hoy (00:00 UTC) y los 30 días siguientes.
  r.get('/citas', permite('odontologia.citas.ver'), h(async (req, res) => {
    const f = S.listarCitas.parse(req.query);
    const desde = f.desde || new Date(new Date().toISOString().slice(0, 10));
    res.json(await citas.listar(req.actor, { ...f, desde, hasta: f.hasta || new Date(desde.getTime() + 30 * 864e5) }));
  }));
  r.post('/citas', permite('odontologia.citas.gestionar'), alta(citas.programar, S.cita));
  r.patch('/citas/:id/estado', permite('odontologia.citas.gestionar'), h(async (req, res) =>
    res.json(await citas.cambiarEstado(req.actor, req.params.id, S.estadoCita.parse(req.body).estado))));

  r.get('/odontologos', VER, h(async (req, res) => res.json(await catalogos.odontologos())));
  r.post('/odontologos', EDITAR, alta(catalogos.crearOdontologo, S.odontologo));
  r.get('/procedimientos', VER, h(async (req, res) => res.json(await catalogos.procedimientos())));
  r.post('/procedimientos', EDITAR, alta(catalogos.crearProcedimiento, S.procedimiento));

  r.get('/auditoria', permite('auditoria.leer'), h(async (req, res) => res.json(await auditoria.listar(S.filtroAuditoria.parse(req.query)))));
  return r;
}

module.exports = { rutasGenerales };
