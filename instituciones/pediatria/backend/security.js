'use strict';
// Autenticación JWT y autorización por roles.
// Contrato de token compartido con la plataforma general (ver docs/GUIA_INTEGRACION_EQUIPO.md):
//   { sub, rol: medico|secretaria|administrador, institucion: 'centro_pediatrico', exp }
// firmado con HS256, issuer JWT_ISSUER y audience JWT_AUDIENCE.
const jwt = require('jsonwebtoken');

const ROLES = ['medico', 'secretaria', 'administrador'];
const INSTITUCION = 'centro_pediatrico';
const opcionesJwt = () => ({
  issuer: process.env.JWT_ISSUER || 'centro-pediatrico-dev',
  audience: process.env.JWT_AUDIENCE || 'centro-pediatrico-api'
});
// Rechaza también el valor de ejemplo de .env.example.
const secretoValido = () => typeof process.env.JWT_SECRET === 'string' && process.env.JWT_SECRET.length >= 32 &&
  !process.env.JWT_SECRET.startsWith('CAMBIAR_POR');

function verificarToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], ...opcionesJwt() });
  if (typeof payload.exp !== 'number') throw new Error('Token sin expiración');
  return payload;
}

// Verifica el Bearer de la petición: { payload } o { status, cuerpo } con el error HTTP.
function autenticarPeticion(req) {
  if (!secretoValido()) return { status: 503, cuerpo: { error: 'Configurar JWT_SECRET (mínimo 32 caracteres)' } };
  const m = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(req.headers.authorization || '');
  if (!m) return { status: 401, cuerpo: { error: 'Token Bearer requerido', codigo: 'NO_AUTENTICADO' } };
  try {
    return { payload: verificarToken(m[1]) };
  } catch (e) {
    const expirado = e.name === 'TokenExpiredError';
    return { status: 401, cuerpo: { error: expirado ? 'Sesión expirada' : 'Token no válido', codigo: expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO' } };
  }
}

function requireAuth(req, res, next) {
  const { payload, status, cuerpo } = autenticarPeticion(req);
  if (!payload) return res.status(status).json(cuerpo);
  if (!ROLES.includes(payload.rol) || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 80 ||
      payload.institucion !== INSTITUCION) {
    return res.status(403).json({ error: 'Usuario/institución no autorizados', codigo: 'INSTITUCION_NO_AUTORIZADA' });
  }
  req.actor = { id: payload.sub, rol: payload.rol, institucion: payload.institucion, exp: payload.exp };
  next();
}

// onDenegado permite auditar intentos de acceso sin permiso.
function crearRoles(onDenegado) {
  return (...allowed) => (req, res, next) => {
    if (allowed.includes(req.actor?.rol)) return next();
    if (onDenegado) onDenegado(req);
    res.status(403).json({ error: 'Rol sin permiso para esta operación', codigo: 'ROL_SIN_PERMISO' });
  };
}
const roles = crearRoles();

// Solo desarrollo: lo usan scripts/dev-token.js y POST /auth/dev-login.
function firmarTokenDesarrollo({ usuario, rol }, expiresIn = '2h') {
  if (process.env.NODE_ENV === 'production') throw new Error('No usar tokens de desarrollo en producción');
  if (!secretoValido()) throw new Error('Configura JWT_SECRET >= 32 caracteres');
  if (!ROLES.includes(rol)) throw new Error('Rol inválido');
  return jwt.sign({ rol, institucion: INSTITUCION }, process.env.JWT_SECRET,
    { algorithm: 'HS256', subject: usuario, expiresIn, ...opcionesJwt() });
}

module.exports = { autenticarPeticion, requireAuth, roles, crearRoles, firmarTokenDesarrollo, verificarToken, ROLES, INSTITUCION, secretoValido };
