// Endpoints del módulo Laboratorio Clínico (backend PostgreSQL de instituciones/laboratorio/backend).
// Las rutas /api/* llegan a este módulo porque el token pertenece a laboratorio_clinico.
// Reglas comunes: registrar consulta = crear solicitud; agregar diagnóstico = registrar resultado;
// recetar no aplica al laboratorio. Errores: formato común { error, codigo, detalles? }.
import { seg } from '@plataforma/api/http.js';

export function crearApiLaboratorio(http) {
  const { get, post, put, patch } = http;
  const P = id => `/api/pacientes/${seg(id)}`;
  return {
    panel: () => get('/api/panel'),
    pacientes: {
      listar: params => get('/api/pacientes', params),
      crear: datos => post('/api/pacientes', datos),
      obtener: id => get(P(id)),
      administrativo: id => get(`${P(id)}/administrativo`),
      archivar: (id, motivo_archivado) => patch(`${P(id)}/archivar`, { motivo_archivado })
    },
    solicitudes: {
      listar: params => get('/api/solicitudes', params),
      obtener: id => get(`/api/solicitudes/${seg(id)}`),
      crear: (idPaciente, datos) => post(`${P(idPaciente)}/solicitudes`, datos)
    },
    resultados: {
      listar: params => get('/api/resultados', params),
      obtener: id => get(`/api/resultados/${seg(id)}`),
      // Crea o completa el resultado preliminar del examen.
      registrar: (idExamen, datos) => put(`/api/examenes/${seg(idExamen)}/resultado`, datos),
      validar: id => patch(`/api/resultados/${seg(id)}/validar`)
    },
    catalogos: {
      tiposMuestra: () => get('/api/tipos-muestra'),
      crearTipoMuestra: datos => post('/api/tipos-muestra', datos),
      parametros: () => get('/api/parametros'),
      crearParametro: datos => post('/api/parametros', datos),
      tiposExamen: () => get('/api/tipos-examen'),
      tipoExamen: id => get(`/api/tipos-examen/${seg(id)}`),
      crearTipoExamen: datos => post('/api/tipos-examen', datos),
      medicos: () => get('/api/medicos'),
      crearMedico: datos => post('/api/medicos', datos),
      personal: () => get('/api/personal'),
      crearPersonal: datos => post('/api/personal', datos)
    },
    auditoria: params => get('/api/auditoria', params)
  };
}
