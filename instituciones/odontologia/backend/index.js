'use strict';
// Composición del módulo de la clínica para el servidor común: conexión, adaptador, casos de uso y router.
// Si Firestore no responde al arrancar, o la llave está mal configurada, el módulo se monta igual y
// responde 503 sin afectar a las demás instituciones.
const express = require('express');
const { crearFirestore, proyectoConectado } = require('./db');
const { crearRepositoriosFirestore } = require('./adapters/firestore');
const { crearServicios } = require('./application');
const { crearRouterOdontologia } = require('./app');
const { INSTITUCION } = require('./security');

const MODULO = { institucion: INSTITUCION, nombre: 'Clínica Odontológica', motor: 'Cloud Firestore' };

function routerNoDisponible() {
  const r = express.Router();
  r.use((req, res) => res.status(503).json({ error: 'La base de datos de la clínica no está configurada', codigo: 'MOTOR_NO_DISPONIBLE' }));
  return r;
}

async function crearModuloOdontologia(opciones) {
  let db;
  try {
    db = crearFirestore(opciones);
  } catch (e) {
    return { ...MODULO, router: routerNoDisponible(), proyecto: '—', error: e.message, cerrar: async () => {} };
  }
  let error = null;
  try {
    await Promise.race([
      db.collection('contadores').doc('pacientes').get(),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('sin respuesta en 10 s')), 10_000).unref())
    ]);
  } catch (e) {
    error = e.message;
  }
  return {
    ...MODULO,
    router: crearRouterOdontologia(crearServicios(crearRepositoriosFirestore(db))),
    proyecto: proyectoConectado(),
    error,
    cerrar: () => db.terminate()
  };
}

module.exports = { crearModuloOdontologia };
