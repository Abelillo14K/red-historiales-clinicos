// Endpoints del módulo Centro Médico Pediátrico (backend MongoDB de este repositorio).
// Las rutas /api/* llegan a este módulo porque el token pertenece a centro_pediatrico.
import { seg } from '@plataforma/api/http.js';

export function crearApiPediatria(http) {
  const { get, post, put, patch } = http;
  const P = id => `/api/pacientes/${seg(id)}`;
  return {
    panel: () => get('/api/panel'),
    pacientes: {
      listar: params => get('/api/pacientes', params),
      crear: datos => post('/api/pacientes', datos),
      obtener: id => get(P(id)),
      administrativo: id => get(`${P(id)}/administrativo`),
      actualizar: (id, datos) => patch(P(id), datos),
      agregarTutor: (id, tutor) => post(`${P(id)}/tutores`, tutor),
      actualizarTutor: (id, idTutor, datos) => put(`${P(id)}/tutores/${seg(idTutor)}`, datos),
      archivar: (id, motivo_archivado) => patch(`${P(id)}/archivar`, { motivo_archivado })
    },
    consultas: {
      // rango: { desde, hasta } en ISO 8601 (opcional)
      listar: (id, rango) => get(`${P(id)}/consultas`, rango),
      crear: (id, datos) => post(`${P(id)}/consultas`, datos),
      agregarDiagnostico: (id, c, d) => post(`${P(id)}/consultas/${seg(c)}/diagnosticos`, d),
      establecerTratamiento: (id, c, t) => put(`${P(id)}/consultas/${seg(c)}/tratamiento`, t),
      agregarPrescripcion: (id, c, rx) => post(`${P(id)}/consultas/${seg(c)}/prescripciones`, rx),
      prescripciones: id => get(`${P(id)}/prescripciones`),
      diagnosticos: id => get(`${P(id)}/diagnosticos`)
    },
    crecimiento: {
      listar: id => get(`${P(id)}/crecimiento`),
      registrar: (id, datos) => post(`${P(id)}/crecimiento`, datos)
    },
    vacunacion: {
      esquema: (id, estado) => get(`${P(id)}/vacunacion`, { estado }),
      programar: (id, datos) => post(`${P(id)}/vacunacion`, datos),
      aplicar: (id, e, datos) => patch(`${P(id)}/vacunacion/${seg(e)}/aplicar`, datos),
      cancelar: (id, e, motivo_cancelacion) => patch(`${P(id)}/vacunacion/${seg(e)}/cancelar`, { motivo_cancelacion }),
      pendientes: limite => get('/api/vacunacion/pendientes', { limite })
    },
    catalogos: {
      medicos: especialidad => get('/api/medicos', { especialidad }),
      medico: id => get(`/api/medicos/${seg(id)}`),
      especialidades: () => get('/api/especialidades'),
      vacunas: () => get('/api/vacunas')
    },
    auditoria: params => get('/api/auditoria', params)
  };
}
