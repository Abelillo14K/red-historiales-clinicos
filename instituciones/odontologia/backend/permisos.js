'use strict';
// Permisos de la clínica odontológica: única fuente de verdad para autorizar cada ruta y para GET /api/sesion.
// Los nombres comunes son los de docs/GUIA_EQUIPO.md §9; los exclusivos llevan el prefijo odontologia.
const BASE = ['panel.ver', 'pacientes.listar', 'pacientes.ver_administrativo', 'catalogos.ver', 'odontologia.citas.ver'];

const PERMISOS_POR_ROL = Object.freeze({
  recepcion: [...BASE, 'pacientes.registrar', 'odontologia.citas.gestionar'],
  odontologo: [...BASE, 'historial.leer', 'clinico.escribir', 'odontologia.citas.gestionar'],
  administrador: [...BASE, 'pacientes.registrar', 'historial.leer', 'historial.leer_archivados', 'historial.archivar',
    'catalogos.editar', 'auditoria.leer']
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
