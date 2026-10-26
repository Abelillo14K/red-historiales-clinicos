'use strict';
// Permisos del módulo pediátrico: única fuente de verdad para
//  - la autorización de cada ruta de la API (src/api/routes), y
//  - la navegación del frontend (GET /api/sesion devuelve los permisos del rol).
// Los nombres comunes (pacientes.*, historial.*, clinico.*, auditoria.*, catalogos.*)
// forman parte del contrato compartido entre instituciones (docs/GUIA_INTEGRACION_EQUIPO.md);
// cada institución decide qué roles los tienen.
const PERMISOS_POR_ROL = Object.freeze({
  medico: ['panel.ver', 'pacientes.listar', 'pacientes.ver_administrativo', 'historial.leer', 'clinico.escribir', 'catalogos.ver'],
  secretaria: ['panel.ver', 'pacientes.listar', 'pacientes.ver_administrativo', 'pacientes.registrar', 'pacientes.editar', 'catalogos.ver'],
  administrador: ['panel.ver', 'pacientes.listar', 'pacientes.ver_administrativo', 'pacientes.registrar', 'pacientes.editar',
    'historial.leer', 'historial.leer_archivados', 'historial.archivar', 'catalogos.ver', 'catalogos.editar', 'auditoria.leer']
});

const PERMISOS = Object.freeze([...new Set(Object.values(PERMISOS_POR_ROL).flat())].sort());
const permisosDe = rol => [...(PERMISOS_POR_ROL[rol] || [])];
const tienePermiso = (rol, permiso) => (PERMISOS_POR_ROL[rol] || []).includes(permiso);

function rolesCon(permiso) {
  const roles = Object.keys(PERMISOS_POR_ROL).filter(r => PERMISOS_POR_ROL[r].includes(permiso));
  if (!roles.length) throw new Error(`Permiso desconocido: ${permiso}`); // evita rutas inaccesibles por errores de escritura
  return roles;
}

module.exports = { PERMISOS_POR_ROL, PERMISOS, permisosDe, tienePermiso, rolesCon };
