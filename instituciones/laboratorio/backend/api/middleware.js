'use strict';
// Middleware del router del laboratorio. Formato de error común (docs/GUIA_EQUIPO.md §4):
//   { error: mensaje legible, codigo: CODIGO_ESTABLE, detalles?: [{ campo, mensaje }] }
const { DomainError } = require('../domain/errors');

const asyncRoute = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);

const ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
function validarParametroId(req, res, next, valor) {
  if (!ID_VALIDO.test(valor)) return res.status(400).json({ error: 'Identificador inválido en la ruta', codigo: 'VALIDACION' });
  next();
}

// Va al final del router: sus errores de dominio no dependen del manejador del servidor común.
function manejadorErrores(err, req, res, _next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Datos inválidos', codigo: 'VALIDACION',
      detalles: err.issues.map(i => ({ campo: i.path.join('.') || '(cuerpo)', mensaje: i.message }))
    });
  }
  if (err instanceof DomainError) return res.status(err.status).json({ error: err.message, codigo: err.code });
  // Motor caído o sin conexión: el laboratorio responde 503 sin afectar a las demás instituciones.
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '57P03', '08001', '08006'].includes(err.code) ||
      /timeout exceeded when trying to connect/i.test(err.message)) {
    console.error(`[laboratorio] PostgreSQL no disponible: ${err.message}`);
    return res.status(503).json({ error: 'La base de datos del laboratorio no está disponible', codigo: 'MOTOR_NO_DISPONIBLE' });
  }
  // No se registran cuerpos de petición para no volcar datos clínicos en los logs.
  console.error(`[laboratorio] ${req.method} ${req.baseUrl}${req.path}: ${err.message}`);
  res.status(500).json({ error: 'Error interno', codigo: 'ERROR_INTERNO' });
}

module.exports = { asyncRoute, validarParametroId, manejadorErrores };
