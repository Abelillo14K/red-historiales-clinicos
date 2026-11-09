'use strict';
// Composición del módulo de la clínica para el servidor común: conexión, adaptador, casos de uso y router.
// Si Firestore no responde al arrancar, o la llave está mal configurada, el módulo se monta igual y
// responde 503 sin afectar a las demás instituciones.
const express = require('express');
const { crearFirestore, proyectoConectado } = require('./db');
const { crearRepositoriosFirestore } = require('./adapters/firestore');
const { crearServicios } = require('./application');
const { crearRouterOdontologia } = require('./app');
const { INSTITUCION, firmarTokenSesion } = require('./security');
const { DomainError } = require('./domain/errors');

const MODULO = { institucion: INSTITUCION, nombre: 'Clínica Odontológica', motor: 'Cloud Firestore', prefijoUsuario: 'odonto.' };
const NO_CONFIGURADA = 'La base de datos de la clínica no está configurada';

function routerNoDisponible() {
  const r = express.Router();
  r.use((req, res) => res.status(503).json({ error: NO_CONFIGURADA, codigo: 'MOTOR_NO_DISPONIBLE' }));
  return r;
}

// Inicio de sesión con usuario y contraseña para el formulario común: devuelve el JWT de la institución.
// Credenciales incorrectas -> DomainError 401 CREDENCIALES_INVALIDAS; Firestore caído -> DomainError 503.
const crearAutenticador = servicios => async (usuario, contrasena) => {
  let cuenta;
  try {
    cuenta = await servicios.acceso.autenticar(usuario, contrasena);
  } catch (e) {
    if (e instanceof DomainError) throw e;
    console.error(`[odontologia] inicio de sesión: ${e.message}`);
    throw new DomainError('La base de datos de la clínica no está disponible', 503, 'MOTOR_NO_DISPONIBLE');
  }
  return { ...cuenta, institucion: INSTITUCION, token: firmarTokenSesion(cuenta) };
};

async function crearModuloOdontologia(opciones) {
  let db;
  try {
    db = crearFirestore(opciones);
  } catch (e) {
    const autenticar = async () => { throw new DomainError(NO_CONFIGURADA, 503, 'MOTOR_NO_DISPONIBLE'); };
    return { ...MODULO, router: routerNoDisponible(), autenticar, proyecto: '—', error: e.message, cerrar: async () => {} };
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
  const servicios = crearServicios(crearRepositoriosFirestore(db));
  return {
    ...MODULO,
    router: crearRouterOdontologia(servicios),
    autenticar: crearAutenticador(servicios),
    proyecto: proyectoConectado(),
    error,
    cerrar: () => db.terminate()
  };
}

module.exports = { crearModuloOdontologia, crearAutenticador };
