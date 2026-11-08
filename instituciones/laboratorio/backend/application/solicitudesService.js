'use strict';
// Casos de uso de solicitudes de exámenes (la «consulta» del laboratorio).
const E = require('../domain/errors');
const R = require('../domain/reglas');
const { paginar } = require('./comun');

const CAMPOS_SOLICITUD = ['id_medico', 'institucion_remitente', 'fecha_solicitud', 'prioridad', 'motivo', 'indicaciones', 'observaciones'];

function crearSolicitudesService({ solicitudes, pacientes }, comun) {
  const { auditar, escribir, exigirLectura } = comun;

  return {
    async crear(actor, idPaciente, datos) {
      R.noEnFuturo(datos.fecha_solicitud, 'fecha_solicitud');
      for (const e of datos.examenes) R.noEnFuturo(e.fecha_toma_muestra, 'fecha_toma_muestra');
      R.sinRepetidos(datos.examenes.map(e => e.id_tipo_examen), 'Tipo de examen');
      R.sinRepetidos(datos.examenes.filter(e => e.codigo_muestra).map(e => e.codigo_muestra), 'Código de muestra');

      return escribir(actor, 'CREAR_SOLICITUD', r => ({ id_paciente: idPaciente, recurso: 'solicitudes', detalle: `Solicitud ${r.id_solicitud}` }), async tx => {
        R.exigirActivo(await tx.pacientes.obtener(idPaciente, { bloquear: true }));
        if (datos.id_medico && !(await tx.catalogos.obtenerMedico(datos.id_medico))) {
          throw E.badReference('Médico solicitante inexistente');
        }
        for (const e of datos.examenes) {
          const tipo = await tx.catalogos.obtenerTipoExamen(e.id_tipo_examen);
          if (!tipo || !tipo.activo) throw E.badReference(`Tipo de examen inexistente o inactivo: ${e.id_tipo_examen}`);
        }
        const examenes = datos.examenes.map(e => ({ ...e, estado: e.fecha_toma_muestra ? 'Muestra tomada' : 'Pendiente' }));
        const solicitud = Object.fromEntries(CAMPOS_SOLICITUD.map(c => [c, datos[c] ?? null]));
        const id_solicitud = await tx.solicitudes.crear({
          ...solicitud, prioridad: datos.prioridad || 'Rutina', fecha_solicitud: datos.fecha_solicitud || new Date(),
          id_paciente: idPaciente, estado: R.estadoSolicitud(examenes.map(e => e.estado)), registrado_por: actor.id
        }, examenes);
        return { id_solicitud };
      });
    },

    async listar(actor, { estado, ...pag }) {
      const { limite, pagina, saltar } = paginar(pag);
      const r = await solicitudes.listar({ estado, limite, saltar });
      await auditar(actor, 'LISTAR_SOLICITUDES', { recurso: 'solicitudes' });
      return { ...r, pagina, limite };
    },

    async obtener(actor, id) {
      const s = await solicitudes.obtener(id);
      if (!s) throw E.notFound('Solicitud inexistente');
      await exigirLectura(actor, await pacientes.obtener(s.id_paciente), 'LEER_SOLICITUD');
      return s;
    }
  };
}

module.exports = { crearSolicitudesService };
