import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { ApiError } from './errores.js';

const TODOS = [
  'panel.ver', 'pacientes.listar', 'pacientes.registrar', 'pacientes.ver_administrativo', 'pacientes.editar',
  'historial.leer', 'clinico.escribir', 'historial.archivar', 'historial.leer_archivados',
  'catalogos.ver', 'catalogos.editar', 'auditoria.leer',
  'hospital.citas.ver', 'hospital.citas.gestionar', 'hospital.hospitalizacion.ver', 'hospital.hospitalizacion.gestionar'
];

// Permisos por rol (tabla `rol`). El documento exige que recepción NO vea el detalle clínico restringido.
export const PERMISOS_POR_ROL = {
  administrador: TODOS,
  medico: ['panel.ver', 'pacientes.listar', 'pacientes.ver_administrativo', 'historial.leer', 'clinico.escribir',
    'catalogos.ver', 'hospital.citas.ver', 'hospital.citas.gestionar',
    'hospital.hospitalizacion.ver', 'hospital.hospitalizacion.gestionar'],
  enfermeria: ['panel.ver', 'pacientes.listar', 'pacientes.ver_administrativo', 'historial.leer',
    'catalogos.ver', 'hospital.citas.ver', 'hospital.hospitalizacion.ver'],
  recepcion: ['panel.ver', 'pacientes.listar', 'pacientes.registrar', 'pacientes.ver_administrativo', 'pacientes.editar',
    'catalogos.ver', 'hospital.citas.ver', 'hospital.citas.gestionar']
};

// Token según GUIA_EQUIPO §3.1: HS256, iss, aud, sub, rol, institucion, exp
export const firmarToken = u => jwt.sign(
  { usuario: u.nombre_usuario, rol: u.nombre_rol, id_medico: u.id_medico ?? null, institucion: config.institucion },
  config.jwtSecret,
  { algorithm: 'HS256', subject: String(u.id_usuario), expiresIn: config.jwtExpira, issuer: config.jwtIssuer, audience: config.jwtAudience });

// Valida el JWT por sí mismo: sirve igual en modo independiente o montado en el enrutador por institución.
export function autenticar(req, _res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return next(new ApiError(401, 'NO_AUTENTICADO', 'Sesión requerida'));
  let p;
  try {
    p = jwt.verify(m[1], config.jwtSecret, { algorithms: ['HS256'], issuer: config.jwtIssuer, audience: config.jwtAudience });
  } catch (e) {
    return next(e.name === 'TokenExpiredError'
      ? new ApiError(401, 'TOKEN_EXPIRADO', 'La sesión expiró')
      : new ApiError(401, 'TOKEN_INVALIDO', 'Sesión inválida'));
  }
  if (p.institucion !== config.institucion) return next(new ApiError(403, 'INSTITUCION_NO_AUTORIZADA', 'El token no pertenece al Hospital General'));
  const permisos = PERMISOS_POR_ROL[p.rol];
  if (!permisos) return next(new ApiError(403, 'ROL_SIN_PERMISO', 'Rol desconocido en el Hospital General'));
  const id = Number(p.sub);
  if (!Number.isInteger(id) || id <= 0) return next(new ApiError(401, 'TOKEN_INVALIDO', 'El sub debe ser el id de un usuario del Hospital'));
  req.usuario = { id_usuario: id, usuario: p.usuario || String(p.sub), rol: p.rol, id_medico: p.id_medico ?? null, exp: p.exp };
  // Los permisos se calculan en el servidor: el token NO los otorga.
  req.permisos = new Set(permisos);
  next();
}

export const permiso = (...requeridos) => (req, _res, next) =>
  requeridos.every(p => req.permisos.has(p))
    ? next()
    : next(new ApiError(403, 'ROL_SIN_PERMISO', 'No tiene permiso para esta operación'));

export const puede = (req, p) => req.permisos.has(p);
