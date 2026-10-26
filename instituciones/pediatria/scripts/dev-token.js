// Generador de JWT EXCLUSIVO DE DESARROLLO. No es un mecanismo de autenticación de producción.
// Uso: npm run token:dev -- [medico|secretaria|administrador] [USUARIO]
require('dotenv').config({ quiet: true });
const { firmarTokenDesarrollo } = require('../backend/security');
const rol = process.argv[2] || 'medico';
const usuario = process.argv[3] || 'USUARIO-DEMO';
console.log(firmarTokenDesarrollo({ usuario, rol }));
