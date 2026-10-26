// Manifiesto del módulo Clínica Odontológica (contrato de módulos v1, plataforma/modulos/contrato.js).
// ESTADO: preparado visualmente, PENDIENTE de integración. No está en registro.js, así que
// la aplicación real no lo carga. Se revisa en la vista previa de desarrollo:
//   npm run web:dev  →  http://localhost:5173/vista-previa/clinica_odontologica
// Guía: docs/FRONTEND_EQUIPO.md · instituciones/odontologia/README.md.
import { crearApiOdontologia } from './api.js';
import presentacion from './presentacion.js';

// Una sola función de carga para las rutas del expediente (no se vuelve a montar al cambiar de pestaña).
const expediente = () => import('./paginas/Expediente.jsx');

const SECCIONES = {
  consultas: 'Consultas', diagnosticos: 'Diagnósticos', tratamientos: 'Tratamientos', prescripciones: 'Prescripciones',
  piezas: 'Piezas dentales'
};

export default {
  contrato: 1,
  institucion: 'clinica_odontologica',       // igual al claim `institucion` del JWT que emita su backend
  ...presentacion,                       // nombre, sigla, descripción e icono (presentacion.js)
  // Los roles y su tabla de permisos los define el backend de la Clínica; no se inventan aquí.
  roles: {},
  crearApi: crearApiOdontologia,

  // Permisos: los comunes de la plataforma (docs/GUIA_INTEGRACION_EQUIPO.md §9) y, para
  // operaciones exclusivas, el prefijo `odontologia.` (propuesta a confirmar con su backend).
  rutas: [
    { path: '', permiso: 'panel.ver', cargar: () => import('./paginas/Panel.jsx') },
    { path: 'pacientes', titulo: 'Pacientes', permiso: 'pacientes.listar', cargar: () => import('./paginas/Pacientes.jsx') },
    { path: 'pacientes/nuevo', titulo: 'Registrar paciente', permiso: 'pacientes.registrar', cargar: () => import('./paginas/PacienteNuevo.jsx') },
    { path: 'pacientes/:id', titulo: (p, ctx) => (ctx.vistaPrevia ? 'Estructura del expediente' : p.id), permiso: 'pacientes.ver_administrativo', cargar: expediente },
    { path: 'pacientes/:id/:seccion', titulo: p => SECCIONES[p.seccion] || null, permiso: 'pacientes.ver_administrativo', cargar: expediente },
    { path: 'citas', titulo: 'Citas odontológicas', permiso: 'odontologia.citas.ver', cargar: () => import('./paginas/Citas.jsx') },
    { path: 'archivados', titulo: 'Historiales archivados', permiso: 'historial.leer_archivados', cargar: () => import('./paginas/Archivados.jsx') }
  ],

  navegacion: [
    { to: '/', etiqueta: 'Panel', icono: 'panel', permiso: 'panel.ver', exacto: true },
    { to: '/pacientes', etiqueta: 'Pacientes', icono: 'pacientes', permiso: 'pacientes.listar' },
    { to: '/citas', etiqueta: 'Citas', icono: 'calendario', permiso: 'odontologia.citas.ver' },
    { to: '/archivados', etiqueta: 'Historiales archivados', icono: 'archivo', permiso: 'historial.leer_archivados', grupo: 'Administración' }
  ],

  accionRapida: { to: '/pacientes/nuevo', etiqueta: 'Registrar paciente', permiso: 'pacientes.registrar' }
};
