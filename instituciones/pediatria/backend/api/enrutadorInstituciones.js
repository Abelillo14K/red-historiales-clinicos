'use strict';
// Enrutamiento por usuario (requisito de la Entrega II): tras autenticar, cada
// petición se despacha al módulo de la institución indicada en el token, que
// trae sus propios casos de uso y adaptador de persistencia (motor).
// Este repositorio registra solo el Centro Médico Pediátrico (MongoDB); la
// aplicación compartida agrega las demás instituciones con sus adaptadores.
const express = require('express');
const { autenticarPeticion } = require('../security');

// modulos: { [institucion]: { nombre, motor, router: express.Router } }
function crearEnrutadorInstituciones(modulos) {
  const r = express.Router();
  r.use((req, res, next) => {
    const { payload, status, cuerpo } = autenticarPeticion(req);
    if (!payload) return res.status(status).json(cuerpo);
    const modulo = Object.hasOwn(modulos, payload.institucion) ? modulos[payload.institucion] : null;
    if (!modulo) {
      return res.status(403).json({ error: 'La institución del usuario no está registrada en este servidor', codigo: 'INSTITUCION_NO_REGISTRADA' });
    }
    req.modulo = { institucion: payload.institucion, nombre: modulo.nombre ?? payload.institucion, motor: modulo.motor };
    modulo.router(req, res, next);
  });
  return r;
}

module.exports = { crearEnrutadorInstituciones };
