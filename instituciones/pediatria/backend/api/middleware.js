'use strict';
const { DomainError } = require('../domain/errors');
// Formato de error común a todas las instituciones (docs/GUIA_INTEGRACION_EQUIPO.md §4):
//   { error: mensaje legible, codigo: CODIGO_ESTABLE, detalles?: [{ campo, mensaje }] }

const asyncRoute = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);

function cabecerasSeguridad(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  // Los historiales clínicos no deben quedar en cachés intermedias ni del navegador.
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) res.set('Cache-Control', 'no-store');
  next();
}

// CORS opcional para integrar con el frontend compartido en otro origen (CORS_ORIGIN).
function cors(origenes) {
  const permitidos = new Set(origenes);
  return (req, res, next) => {
    const origen = req.headers.origin;
    if (origen && permitidos.has(origen)) {
      res.set({
        'Access-Control-Allow-Origin': origen, Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS'
      });
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  };
}

// Limitador en memoria por IP (suficiente para un único proceso de la API).
function limitador({ ventanaMs, maximo }) {
  const conteos = new Map();
  return (req, res, next) => {
    const ahora = Date.now();
    const k = req.ip;
    const e = conteos.get(k);
    if (!e || ahora - e.inicio > ventanaMs) conteos.set(k, { inicio: ahora, n: 1 });
    else if (++e.n > maximo) return res.status(429).json({ error: 'Demasiadas solicitudes; espere un momento', codigo: 'DEMASIADAS_SOLICITUDES' });
    if (conteos.size > 10000) conteos.clear();
    next();
  };
}

const ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
function validarParametroId(req, res, next, valor) {
  if (!ID_VALIDO.test(valor)) return res.status(400).json({ error: 'Identificador inválido en la ruta', codigo: 'VALIDACION' });
  next();
}

function manejadorErrores(err, req, res, _next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Datos inválidos', codigo: 'VALIDACION',
      detalles: err.issues.map(i => ({ campo: i.path.join('.') || '(cuerpo)', mensaje: i.message }))
    });
  }
  if (err instanceof DomainError) return res.status(err.status).json({ error: err.message, codigo: err.code });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande', codigo: 'SOLICITUD_DEMASIADO_GRANDE' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON malformado', codigo: 'VALIDACION' });
  if (err.code === 11000) return res.status(409).json({ error: 'Identificador duplicado', codigo: 'CONFLICTO' });
  if (err.code === 121) return res.status(422).json({ error: 'Documento rechazado por validación de MongoDB', codigo: 'VALIDACION_MOTOR' });
  // No se registran cuerpos de petición para no volcar datos clínicos en los logs.
  console.error(`[error] ${req.method} ${req.path}: ${err.message}`);
  res.status(500).json({ error: 'Error interno', codigo: 'ERROR_INTERNO' });
}

module.exports = { asyncRoute, cabecerasSeguridad, cors, limitador, validarParametroId, manejadorErrores };
