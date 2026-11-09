// Punto de integración del Hospital General con SU backend (instituciones/hospital/backend).
// Cada operación usa el cliente común `http`: agrega el token, cierra la sesión ante 401 y
// convierte los errores en ApiError { status, codigo, detalles }.
import { seg } from '@plataforma/api/http.js';

export function crearApiHospital({ get, post, put, patch }) {
  const P = id => `/api/pacientes/${seg(id)}`;
  return {
    panel: { resumen: () => get('/api/panel') },

    pacientes: {
      listar: params => get('/api/pacientes', params),              // ?q=&por=nombre|dpi|expediente&estado=Activo|Archivado&limite=&pagina= → { items, total }
      crear: datos => post('/api/pacientes', datos),                // 201 { id_paciente, numero_expediente }
      obtener: id => get(P(id)),
      actualizar: (id, datos) => patch(P(id), datos),
      impactoArchivado: id => get(`${P(id)}/archivar/impacto`),
      archivar: (id, datos) => patch(`${P(id)}/archivar`, datos),   // { motivo_archivado, fecha_traslado?, institucion_destino?, numero_certificado_defuncion?, observaciones?, cancelar_citas? }
      reactivar: id => patch(`${P(id)}/reactivar`, {})
    },

    consultas: {
      listar: (id, params) => get(`${P(id)}/consultas`, params),
      obtener: (id, c) => get(`${P(id)}/consultas/${seg(c)}`),
      crear: (id, datos) => post(`${P(id)}/consultas`, datos),      // 201 { id_consulta, alertas }
      agregarDiagnostico: (id, c, datos) => post(`${P(id)}/consultas/${seg(c)}/diagnosticos`, datos),
      establecerTratamiento: (id, c, datos) => put(`${P(id)}/consultas/${seg(c)}/tratamiento`, datos),
      agregarPrescripcion: (id, c, datos) => post(`${P(id)}/consultas/${seg(c)}/prescripciones`, datos),
      prescripciones: id => get(`${P(id)}/prescripciones`),
      diagnosticos: id => get(`${P(id)}/diagnosticos`),
      tratamientos: id => get(`${P(id)}/tratamientos`),
      alertasMedicamento: (id, medicamentos) => post(`${P(id)}/alertas-medicamento`, { medicamentos })
    },

    examenes: {
      listar: (id, params) => get(`${P(id)}/examenes`, params),
      registrarResultado: (id, detalle, datos) => post(`${P(id)}/examenes/${seg(detalle)}/resultado`, datos)
    },

    expediente: {
      hospitalizaciones: id => get(`${P(id)}/hospitalizaciones`),
      antecedentes: id => get(`${P(id)}/antecedentes`),
      agregarAntecedente: (id, datos) => post(`${P(id)}/antecedentes`, datos),   // { clase: 'personal'|'familiar', ... }
      agregarAlergia: (id, datos) => post(`${P(id)}/alergias`, datos)
    },

    citas: {
      listar: params => get('/api/citas', params),                  // ?fecha=AAAA-MM-DD&id_medico=&estado=
      crear: datos => post('/api/citas', datos),                    // { id_paciente, id_medico, fecha_hora, motivo }
      cambiar: (id, datos) => patch(`/api/citas/${seg(id)}`, datos) // { fecha_hora? , estado_cita? }
    },

    hospitalizacion: {
      listar: params => get('/api/hospitalizaciones', params),
      ingresar: datos => post('/api/hospitalizaciones', datos),
      egresar: (id, datos) => patch(`/api/hospitalizaciones/${seg(id)}/egreso`, datos),
      disponibilidad: () => get('/api/camas/disponibilidad'),
      camas: params => get('/api/camas', params)
    },

    catalogos: {
      nombres: () => get('/api/catalogos'),
      listar: (nombre, params) => get(`/api/catalogos/${seg(nombre)}`, params),
      crear: (nombre, datos) => post(`/api/catalogos/${seg(nombre)}`, datos),
      actualizar: (nombre, id, datos) => put(`/api/catalogos/${seg(nombre)}/${seg(id)}`, datos)
    },

    auditoria: { listar: params => get('/api/auditoria', params) }   // ?id_paciente=&accion=&desde=&hasta=&limite=&pagina=
  };
}
