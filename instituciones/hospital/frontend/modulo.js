// Manifiesto del módulo Hospital General (contrato de módulos v1, plataforma/modulos/contrato.js).
// ESTADO: preparado visualmente, PENDIENTE de integración. No está en registro.js, así que
// la aplicación real no lo carga. Se revisa en la vista previa de desarrollo:
//   npm run web:dev  →  http://localhost:5173/vista-previa/hospital_general
// Guía: docs/FRONTEND_EQUIPO.md · instituciones/hospital/README.md.
import { crearApiHospital } from './api.js';
import presentacion from './presentacion.js';

// Una sola función de carga para las rutas del expediente (no se vuelve a montar al cambiar de pestaña).
const expediente = () => import('./paginas/Expediente.jsx');
const seccionHospital = () => import('./paginas/SeccionHospital.jsx');

const SECCIONES = {
  resumen: 'Datos generales',
  consultas: 'Consultas', diagnosticos: 'Diagnósticos', tratamientos: 'Tratamientos', prescripciones: 'Medicamentos y prescripciones',
  examenes: 'Exámenes', hospitalizaciones: 'Hospitalizaciones', antecedentes: 'Antecedentes'
};

export default {
  contrato: 1,
  institucion: 'hospital_general',       // igual al claim `institucion` del JWT que emita su backend
  ...presentacion,                       // nombre, sigla, descripción e icono (presentacion.js)
  // Los roles y su tabla de permisos los define el backend del Hospital; no se inventan aquí.
  roles: {},
  crearApi: crearApiHospital,

  // Permisos: los comunes de la plataforma (docs/GUIA_INTEGRACION_EQUIPO.md §9) y, para
  // operaciones exclusivas, el prefijo `hospital.` (propuesta a confirmar con su backend).
  rutas: [
    { path: '', permiso: 'panel.ver', cargar: () => import('./paginas/Panel.jsx') },
    { path: 'pacientes', titulo: 'Pacientes', permiso: 'pacientes.listar', cargar: () => import('./paginas/Pacientes.jsx') },
    { path: 'pacientes/nuevo', titulo: 'Registrar paciente', permiso: 'pacientes.registrar', cargar: () => import('./paginas/PacienteNuevo.jsx') },
    { path: 'pacientes/:id/consultas/nueva', titulo: 'Nueva consulta', permiso: 'clinico.escribir', cargar: () => import('./paginas/NuevaConsulta.jsx') },
    { path: 'pacientes/:id/archivar', titulo: 'Archivar', permiso: 'historial.archivar', cargar: () => import('./paginas/Archivar.jsx') },
    { path: 'pacientes/:id', titulo: (p, ctx) => (ctx.vistaPrevia ? 'Estructura del expediente' : p.id), permiso: 'pacientes.ver_administrativo', cargar: expediente },
    { path: 'pacientes/:id/:seccion', titulo: p => SECCIONES[p.seccion] || null, permiso: 'pacientes.ver_administrativo', cargar: expediente },
    { path: 'citas', titulo: 'Citas', permiso: 'hospital.citas.ver', cargar: () => import('./paginas/Citas.jsx') },
    { path: 'hospitalizacion', titulo: 'Hospitalización', permiso: 'hospital.hospitalizacion.ver', cargar: seccionHospital },
    { path: 'catalogos', titulo: 'Catálogos', permiso: 'catalogos.ver', cargar: seccionHospital },
    { path: 'bitacora', titulo: 'Bitácora de acceso', permiso: 'auditoria.leer', cargar: seccionHospital },
    { path: 'archivados', titulo: 'Historiales archivados', permiso: 'historial.leer_archivados', cargar: () => import('./paginas/Archivados.jsx') }
  ],

  navegacion: [
    { to: '/', etiqueta: 'Panel', icono: 'panel', permiso: 'panel.ver', exacto: true },
    { to: '/pacientes', etiqueta: 'Pacientes', icono: 'pacientes', permiso: 'pacientes.listar' },
    { to: '/citas', etiqueta: 'Agenda de citas', icono: 'calendario', permiso: 'hospital.citas.ver' },
    { to: '/hospitalizacion', etiqueta: 'Hospitalización', icono: 'hospital', permiso: 'hospital.hospitalizacion.ver' },
    { to: '/catalogos', etiqueta: 'Catálogos', icono: 'consulta', permiso: 'catalogos.ver' },
    { to: '/bitacora', etiqueta: 'Bitácora de acceso', icono: 'auditoria', permiso: 'auditoria.leer' },
    { to: '/archivados', etiqueta: 'Historiales archivados', icono: 'archivo', permiso: 'historial.leer_archivados', grupo: 'Administración' }
  ],

  accionRapida: { to: '/pacientes/nuevo', etiqueta: 'Registrar paciente', permiso: 'pacientes.registrar' }
};
