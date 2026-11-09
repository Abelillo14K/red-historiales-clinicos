import { crearApiHospital } from './api.js';
import presentacion from './presentacion.js';

const expediente = () => import('./paginas/Expediente.jsx');
const seccionHospital = () => import('./paginas/SeccionHospital.jsx');

const SECCIONES = {
  resumen: 'Datos generales',
  consultas: 'Consultas',
  diagnosticos: 'Diagnósticos',
  tratamientos: 'Tratamientos',
  prescripciones: 'Medicamentos y prescripciones',
  examenes: 'Exámenes',
  hospitalizaciones: 'Hospitalizaciones',
  antecedentes: 'Antecedentes'
};

export default {
  contrato: 1,
  institucion: 'hospital_general',
  ...presentacion,
  roles: {
    administrador: 'Administrador',
    medico: 'Médico',
    enfermeria: 'Enfermería',
    recepcion: 'Recepción'
  },
  crearApi: crearApiHospital,

  rutas: [
    { path: '', permiso: 'panel.ver', cargar: () => import('./paginas/Panel.jsx') },
    { path: 'pacientes', titulo: 'Pacientes', permiso: 'pacientes.listar', cargar: () => import('./paginas/Pacientes.jsx') },
    { path: 'pacientes/nuevo', titulo: 'Registrar paciente', permiso: 'pacientes.registrar', cargar: () => import('./paginas/PacienteNuevo.jsx') },
    { path: 'pacientes/:id/consultas/nueva', titulo: 'Nueva consulta', permiso: 'clinico.escribir', cargar: () => import('./paginas/NuevaConsulta.jsx') },
    { path: 'pacientes/:id/archivar', titulo: 'Archivar', permiso: 'historial.archivar', cargar: () => import('./paginas/Archivar.jsx') },
    { path: 'pacientes/:id', titulo: p => p.id, permiso: 'pacientes.ver_administrativo', cargar: expediente },
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
