'use strict';
// Rutas de sesión, panel, catálogos y bitácora del laboratorio (bajo /api, autenticadas).
const express = require('express');
const S = require('../../schema');
const { asyncRoute: h, validarParametroId } = require('../middleware');
const { permisosDe, ROLES } = require('../../permisos');

function rutasGenerales({ catalogos, panel, auditoria }, permite, roles) {
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
    capacidades: { prescripciones: false }
  }));
  r.get('/panel', permite('panel.ver'), h(async (req, res) => res.json(await panel.resumen(req.actor))));

  r.get('/tipos-muestra', VER, h(async (req, res) => res.json(await catalogos.tiposMuestra())));
  r.post('/tipos-muestra', EDITAR, alta(catalogos.crearTipoMuestra, S.tipoMuestra));
  r.get('/parametros', VER, h(async (req, res) => res.json(await catalogos.parametros())));
  r.post('/parametros', EDITAR, alta(catalogos.crearParametro, S.parametro));
  r.get('/tipos-examen', VER, h(async (req, res) => res.json(await catalogos.tiposExamen())));
  r.get('/tipos-examen/:id', VER, h(async (req, res) => res.json(await catalogos.obtenerTipoExamen(req.params.id))));
  r.post('/tipos-examen', EDITAR, alta(catalogos.crearTipoExamen, S.tipoExamen));
  r.get('/medicos', VER, h(async (req, res) => res.json(await catalogos.medicos())));
  r.post('/medicos', EDITAR, alta(catalogos.crearMedico, S.medico));
  r.get('/personal', VER, h(async (req, res) => res.json(await catalogos.personal())));
  r.post('/personal', EDITAR, alta(catalogos.crearPersonal, S.personal));

  r.get('/auditoria', permite('auditoria.leer'), h(async (req, res) => res.json(await auditoria.listar(S.filtroAuditoria.parse(req.query)))));
  return r;
}

module.exports = { rutasGenerales };
