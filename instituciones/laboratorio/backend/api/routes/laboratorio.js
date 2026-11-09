'use strict';
// Rutas propias del laboratorio: solicitudes, exámenes y resultados.
const express = require('express');
const S = require('../../schema');
const { asyncRoute: h, validarParametroId } = require('../middleware');

function rutasLaboratorio({ solicitudes, resultados }, permite) {
  const r = express.Router();
  r.param('id', validarParametroId);
  const VER_RESULTADOS = permite('laboratorio.resultados.ver');

  r.get('/solicitudes', permite('laboratorio.solicitudes.ver'), h(async (req, res) => res.json(await solicitudes.listar(req.actor, S.listarSolicitudes.parse(req.query)))));
  r.get('/solicitudes/:id', permite('laboratorio.solicitudes.ver'), h(async (req, res) => res.json(await solicitudes.obtener(req.actor, req.params.id))));

  // Agregar diagnóstico (regla común) = registrar o completar el resultado preliminar de un examen.
  r.put('/examenes/:id/resultado', permite('laboratorio.resultados.registrar'), h(async (req, res) =>
    res.json(await resultados.registrar(req.actor, req.params.id, S.resultado.parse(req.body)))));

  r.get('/resultados', VER_RESULTADOS, h(async (req, res) => res.json(await resultados.listar(req.actor, S.listarResultados.parse(req.query)))));
  r.get('/resultados/:id', VER_RESULTADOS, h(async (req, res) => res.json(await resultados.obtener(req.actor, req.params.id))));
  r.patch('/resultados/:id/validar', permite('laboratorio.resultados.validar'), h(async (req, res) => res.json(await resultados.validar(req.actor, req.params.id))));

  return r;
}

module.exports = { rutasLaboratorio };
