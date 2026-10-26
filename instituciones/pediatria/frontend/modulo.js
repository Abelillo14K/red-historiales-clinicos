// Manifiesto del módulo Centro Médico Pediátrico (contrato de módulos v1,
// ver plataforma/modulos/contrato.js y docs/GUIA_INTEGRACION_EQUIPO.md).
// Sin JSX: las páginas se cargan bajo demanda con import() y el manifiesto se
// puede validar desde Node.
import { crearApiPediatria } from './api.js';
import presentacion from './presentacion.js';

// Una sola función de carga para las dos rutas del expediente: al cambiar de
// pestaña la página se conserva (no se vuelve a montar).
const expediente = () => import('./paginas/Expediente.jsx');

const SECCIONES = {
  consultas: 'Consultas', prescripciones: 'Prescripciones', crecimiento: 'Crecimiento',
  vacunacion: 'Vacunación', auditoria: 'Auditoría'
};

export default {
  contrato: 1,
  institucion: 'centro_pediatrico',       // igual al claim `institucion` del JWT
  ...presentacion,                       // nombre, sigla, descripción e icono (presentacion.js)
  roles: { medico: 'Médico', secretaria: 'Secretaría', administrador: 'Administrador' },
  crearApi: crearApiPediatria,

  // El orden importa solo para las migas de pan: las rutas fijas antes que las de parámetros.
  rutas: [
    { path: '', permiso: 'panel.ver', cargar: () => import('./paginas/Panel.jsx') },
    { path: 'pacientes', titulo: 'Pacientes', permiso: 'pacientes.listar', cargar: () => import('./paginas/Pacientes.jsx') },
    { path: 'pacientes/nuevo', titulo: 'Registrar paciente', permiso: 'pacientes.registrar', cargar: () => import('./paginas/PacienteNuevo.jsx') },
    { path: 'pacientes/:id', titulo: p => p.id, permiso: 'pacientes.ver_administrativo', cargar: expediente },
    { path: 'pacientes/:id/consultas/nueva', titulo: 'Nueva consulta', permiso: 'clinico.escribir', cargar: () => import('./paginas/NuevaConsulta.jsx') },
    { path: 'pacientes/:id/:seccion', titulo: p => SECCIONES[p.seccion] || null, permiso: 'pacientes.ver_administrativo', cargar: expediente },
    { path: 'vacunacion', titulo: 'Vacunación', permiso: 'catalogos.ver', cargar: () => import('./paginas/Vacunacion.jsx') },
    { path: 'medicos', titulo: 'Médicos', permiso: 'catalogos.ver', cargar: () => import('./paginas/Medicos.jsx') },
    { path: 'archivados', titulo: 'Historiales archivados', permiso: 'historial.leer_archivados', cargar: () => import('./paginas/Archivados.jsx') },
    { path: 'auditoria', titulo: 'Auditoría', permiso: 'auditoria.leer', cargar: () => import('./paginas/Auditoria.jsx') }
  ],

  navegacion: [
    { to: '/', etiqueta: 'Panel', icono: 'panel', permiso: 'panel.ver', exacto: true },
    { to: '/pacientes', etiqueta: 'Pacientes', icono: 'pacientes', permiso: 'pacientes.listar' },
    { to: '/vacunacion', etiqueta: 'Vacunación', icono: 'vacuna', permiso: 'catalogos.ver' },
    { to: '/medicos', etiqueta: 'Médicos', icono: 'medico', permiso: 'catalogos.ver' },
    { to: '/archivados', etiqueta: 'Historiales archivados', icono: 'archivo', permiso: 'historial.leer_archivados', grupo: 'Administración' },
    { to: '/auditoria', etiqueta: 'Auditoría', icono: 'auditoria', permiso: 'auditoria.leer', grupo: 'Administración' }
  ],

  // Acción rápida del encabezado global (opcional en el contrato).
  accionRapida: { to: '/pacientes/nuevo', etiqueta: 'Registrar paciente', permiso: 'pacientes.registrar' }
};
