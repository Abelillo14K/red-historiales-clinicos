// Endpoints del módulo Clínica Odontológica (backend Cloud Firestore de instituciones/odontologia/backend).
// Las rutas /api/* llegan a este módulo porque el token pertenece a clinica_odontologica.
// Errores: formato común { error, codigo, detalles? }.
import { seg } from '@plataforma/api/http.js';

export function crearApiOdontologia(http) {
  const { get, post, put, patch } = http;
  const P = id => `/api/pacientes/${seg(id)}`;
  const C = (id, c) => `${P(id)}/consultas/${seg(c)}`;
  return {
    panel: () => get('/api/panel'),
    pacientes: {
      listar: params => get('/api/pacientes', params),
      crear: datos => post('/api/pacientes', datos),
      obtener: id => get(P(id)),
      administrativo: id => get(`${P(id)}/administrativo`),
      archivar: (id, motivo_archivado) => patch(`${P(id)}/archivar`, { motivo_archivado }),
      actualizarPieza: (id, pieza, datos) => put(`${P(id)}/piezas/${seg(pieza)}`, datos)
    },
    consultas: {
      listar: id => get(`${P(id)}/consultas`),
      crear: (id, datos) => post(`${P(id)}/consultas`, datos),
      agregarDiagnostico: (id, c, d) => post(`${C(id, c)}/diagnosticos`, d),
      agregarTratamiento: (id, c, t) => post(`${C(id, c)}/tratamientos`, t),
      agregarPrescripcion: (id, c, rx) => post(`${C(id, c)}/prescripciones`, rx),
      prescripciones: id => get(`${P(id)}/prescripciones`)
    },
    citas: {
      listar: params => get('/api/citas', params),
      programar: datos => post('/api/citas', datos),
      cambiarEstado: (id, estado) => patch(`/api/citas/${seg(id)}/estado`, { estado })
    },
    catalogos: {
      odontologos: () => get('/api/odontologos'),
      crearOdontologo: datos => post('/api/odontologos', datos),
      procedimientos: () => get('/api/procedimientos'),
      crearProcedimiento: datos => post('/api/procedimientos', datos)
    },
    auditoria: params => get('/api/auditoria', params)
  };
}
