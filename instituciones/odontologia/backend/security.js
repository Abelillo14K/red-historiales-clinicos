'use strict';
// Autenticación JWT de la clínica con el contrato de sesión común (docs/GUIA_EQUIPO.md §3):
// mismo secreto, issuer y audience que las demás instituciones, pero solo acepta tokens de clinica_odontologica.
const jwt = require('jsonwebtoken');
const { ROLES } = require('./permisos');

const INSTITUCION = 'clinica_odontologica';
const opcionesJwt = () => ({
  issuer: process.env.JWT_ISSUER || 'centro-pediatrico-dev',
  audience: process.env.JWT_AUDIENCE || 'centro-pediatrico-api'
});
const secretoValido = () => typeof process.env.JWT_SECRET === 'string' && process.env.JWT_SECRET.length >= 32 &&
  !process.env.JWT_SECRET.startsWith('CAMBIAR_POR');

function verificarToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], ...opcionesJwt() });
  if (typeof payload.exp !== 'number') throw new Error('Token sin expiración');
  return payload;
}

function requireAuth(req, res, next) {
  if (!secretoValido()) return res.status(503).json({ error: 'Servicio de autenticación no configurado', codigo: 'AUTENTICACION_NO_DISPONIBLE' });
  const m = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(req.headers.authorization || '');
  if (!m) return res.status(401).json({ error: 'Token Bearer requerido', codigo: 'NO_AUTENTICADO' });
  let payload;
  try {
    payload = verificarToken(m[1]);
  } catch (e) {
    const expirado = e.name === 'TokenExpiredError';
    return res.status(401).json({ error: expirado ? 'Sesión expirada' : 'Token no válido', codigo: expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO' });
  }
  if (!ROLES.includes(payload.rol) || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 80 ||
      payload.institucion !== INSTITUCION) {
    return res.status(403).json({ error: 'Usuario/institución no autorizados', codigo: 'INSTITUCION_NO_AUTORIZADA' });
  }
  req.actor = { id: payload.sub, rol: payload.rol, institucion: payload.institucion, exp: payload.exp };
  next();
}

// onDenegado permite auditar intentos de acceso sin permiso.
function crearRoles(onDenegado) {
  return (...permitidos) => (req, res, next) => {
    if (permitidos.includes(req.actor?.rol)) return next();
    if (onDenegado) onDenegado(req);
    res.status(403).json({ error: 'Rol sin permiso para esta operación', codigo: 'ROL_SIN_PERMISO' });
  };
}

// Solo desarrollo: lo usa scripts/dev-token.js.
function firmarTokenDesarrollo({ usuario, rol }, expiresIn = '8h') {
  if (process.env.NODE_ENV === 'production') throw new Error('No usar tokens de desarrollo en producción');
  if (!secretoValido()) throw new Error('Configura JWT_SECRET >= 32 caracteres');
  if (!ROLES.includes(rol)) throw new Error(`Rol inválido; use uno de: ${ROLES.join(', ')}`);
  return jwt.sign({ rol, institucion: INSTITUCION }, process.env.JWT_SECRET,
    { algorithm: 'HS256', subject: usuario, expiresIn, ...opcionesJwt() });
}

module.exports = { INSTITUCION, requireAuth, crearRoles, firmarTokenDesarrollo, verificarToken, secretoValido };
