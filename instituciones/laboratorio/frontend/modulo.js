// Manifiesto del módulo Laboratorio Clínico (contrato de módulos v1, plataforma/modulos/contrato.js).
// ESTADO: preparado visualmente, PENDIENTE de integración. No está en registro.js, así que
// la aplicación real no lo carga. Se revisa en la vista previa de desarrollo:
//   npm run web:dev  →  http://localhost:5173/vista-previa/laboratorio_clinico
// Guía: docs/FRONTEND_EQUIPO.md · instituciones/laboratorio/README.md.
import { crearApiLaboratorio } from './api.js';
import presentacion from './presentacion.js';

// Una sola función de carga para las rutas del expediente (no se vuelve a montar al cambiar de pestaña).
const expediente = () => import('./paginas/Expediente.jsx');
const administracion = () => import('./paginas/Administracion.jsx');

const SECCIONES = {
  resumen: 'Datos generales',
  solicitudes: 'Solicitudes', resultados: 'Resultados', historial: 'Historial de resultados', atenciones: 'Atenciones relacionadas'
};

export default {
  contrato: 1,
  institucion: 'laboratorio_clinico',    // igual al claim `institucion` del JWT que emita su backend
  ...presentacion,                       // nombre, sigla, descripción e icono (presentacion.js)
  // Los roles y su tabla de permisos los define el backend del Laboratorio; no se inventan aquí.
  roles: {},
  crearApi: crearApiLaboratorio,

  // Permisos: los comunes de la plataforma (docs/GUIA_INTEGRACION_EQUIPO.md §9) y, para
  // operaciones exclusivas, el prefijo `laboratorio.` (propuesta a confirmar con su backend).
  rutas: [
    { path: '', permiso: 'panel.ver', cargar: () => import('./paginas/Panel.jsx') },
    { path: 'pacientes', titulo: 'Pacientes', permiso: 'pacientes.listar', cargar: () => import('./paginas/Pacientes.jsx') },
    { path: 'pacientes/nuevo', titulo: 'Registrar paciente', permiso: 'pacientes.registrar', cargar: () => import('./paginas/PacienteNuevo.jsx') },
    { path: 'pacientes/:id/archivar', titulo: 'Archivar', permiso: 'historial.archivar', cargar: () => import('./paginas/Archivar.jsx') },
    { path: 'pacientes/:id', titulo: (p, ctx) => (ctx.vistaPrevia ? 'Estructura del expediente' : p.id), permiso: 'pacientes.ver_administrativo', cargar: expediente },
    { path: 'pacientes/:id/:seccion', titulo: p => SECCIONES[p.seccion] || null, permiso: 'pacientes.ver_administrativo', cargar: expediente },
    { path: 'solicitudes', titulo: 'Solicitudes de exámenes', permiso: 'laboratorio.solicitudes.ver', cargar: () => import('./paginas/Solicitudes.jsx') },
    { path: 'solicitudes/nueva', titulo: 'Nueva solicitud', permiso: 'laboratorio.solicitudes.crear', cargar: () => import('./paginas/NuevaSolicitud.jsx') },
    { path: 'resultados', titulo: 'Resultados', permiso: 'laboratorio.resultados.ver', cargar: () => import('./paginas/Resultados.jsx') },
    { path: 'resultados/nuevo', titulo: 'Registrar resultado', permiso: 'laboratorio.resultados.registrar', cargar: () => import('./paginas/RegistrarResultado.jsx') },
    { path: 'resultados/:resultado', titulo: 'Detalle del resultado', permiso: 'laboratorio.resultados.ver', cargar: () => import('./paginas/DetalleResultado.jsx') },
    { path: 'catalogos', titulo: 'Catálogos', permiso: 'catalogos.ver', cargar: administracion },
    { path: 'bitacora', titulo: 'Bitácora de acceso', permiso: 'auditoria.leer', cargar: administracion },
    { path: 'archivados', titulo: 'Historiales archivados', permiso: 'historial.leer_archivados', cargar: () => import('./paginas/Archivados.jsx') }
  ],

  navegacion: [
    { to: '/', etiqueta: 'Panel', icono: 'panel', permiso: 'panel.ver', exacto: true },
    { to: '/pacientes', etiqueta: 'Pacientes', icono: 'pacientes', permiso: 'pacientes.listar' },
    { to: '/solicitudes', etiqueta: 'Solicitudes de exámenes', icono: 'matraz', permiso: 'laboratorio.solicitudes.ver' },
    { to: '/resultados', etiqueta: 'Resultados', icono: 'resultado', permiso: 'laboratorio.resultados.ver' },
    { to: '/catalogos', etiqueta: 'Catálogos', icono: 'consulta', permiso: 'catalogos.ver' },
    { to: '/bitacora', etiqueta: 'Bitácora de acceso', icono: 'auditoria', permiso: 'auditoria.leer' },
    { to: '/archivados', etiqueta: 'Historiales archivados', icono: 'archivo', permiso: 'historial.leer_archivados', grupo: 'Administración' }
  ],

  accionRapida: { to: '/pacientes/nuevo', etiqueta: 'Registrar paciente', permiso: 'pacientes.registrar' }
};
