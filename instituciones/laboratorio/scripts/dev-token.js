'use strict';
// Generador de JWT EXCLUSIVO DE DESARROLLO para el laboratorio. No es un mecanismo de autenticación de producción.
// Uso: npm run lab:token -- [recepcion|tecnico|bioquimico|administrador] [USUARIO]
require('dotenv').config({ quiet: true });
const { firmarTokenDesarrollo } = require('../backend/security');

const rol = process.argv[2] || 'tecnico';
const usuario = process.argv[3] || 'USUARIO-DEMO';
try {
  console.log(firmarTokenDesarrollo({ usuario, rol }));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
