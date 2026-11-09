'use strict';
// Permisos del laboratorio: única fuente de verdad para autorizar cada ruta y para GET /api/sesion.
// Los nombres comunes son los de docs/GUIA_EQUIPO.md §9; los exclusivos llevan el prefijo laboratorio.
const LEER_PACIENTES = ['panel.ver', 'pacientes.listar', 'pacientes.ver_administrativo'];
const ANALISIS = [...LEER_PACIENTES, 'historial.leer', 'catalogos.ver', 'laboratorio.solicitudes.ver',
  'laboratorio.resultados.ver', 'laboratorio.resultados.registrar'];

const PERMISOS_POR_ROL = Object.freeze({
  recepcion: [...LEER_PACIENTES, 'pacientes.registrar', 'catalogos.ver', 'laboratorio.solicitudes.ver', 'laboratorio.solicitudes.crear'],
  tecnico: ANALISIS,
  bioquimico: [...ANALISIS, 'laboratorio.resultados.validar'],
  administrador: [...LEER_PACIENTES, 'pacientes.registrar', 'historial.leer', 'historial.leer_archivados', 'historial.archivar',
    'catalogos.ver', 'catalogos.editar', 'auditoria.leer', 'laboratorio.solicitudes.ver', 'laboratorio.resultados.ver']
});

const ROLES = Object.freeze(Object.keys(PERMISOS_POR_ROL));
const PERMISOS = Object.freeze([...new Set(Object.values(PERMISOS_POR_ROL).flat())].sort());
const permisosDe = rol => [...(PERMISOS_POR_ROL[rol] || [])];
const tienePermiso = (rol, permiso) => (PERMISOS_POR_ROL[rol] || []).includes(permiso);

function rolesCon(permiso) {
  const roles = ROLES.filter(r => PERMISOS_POR_ROL[r].includes(permiso));
  if (!roles.length) throw new Error(`Permiso desconocido: ${permiso}`); // evita rutas inaccesibles por errores de escritura
  return roles;
}

module.exports = { PERMISOS_POR_ROL, ROLES, PERMISOS, permisosDe, tienePermiso, rolesCon };
