'use strict';
// Casos de uso de pacientes: registro, búsqueda, expediente y archivo (baja sin borrar).
const E = require('../domain/errors');
const R = require('../domain/reglas');
const { tienePermiso } = require('../permisos');
const { paginar } = require('./comun');

function crearPacientesService({ pacientes, solicitudes }, comun) {
  const { auditar, escribir, leerPaciente } = comun;

  return {
    async registrar(actor, datos) {
      R.noEnFuturo(datos.fecha_nacimiento, 'fecha_nacimiento');
      return escribir(actor, 'CREAR_PACIENTE', r => ({ id_paciente: r.id_paciente, recurso: 'pacientes' }),
        async tx => ({ id_paciente: await tx.pacientes.crear(datos) }));
    },

    async listar(actor, { q, estado = 'Activo', ...pag }) {
      if (estado !== 'Activo' && !tienePermiso(actor.rol, 'historial.leer_archivados')) {
        throw E.forbidden('Solo el administrador puede consultar historiales archivados');
      }
      const { limite, pagina, saltar } = paginar(pag);
      const r = await pacientes.listar({ texto: q, estado, limite, saltar });
      await auditar(actor, estado === 'Activo' ? 'LISTAR_PACIENTES' : 'LISTAR_ARCHIVADOS', { recurso: 'pacientes' });
      return { ...r, pagina, limite };
    },

    // Datos generales, sin solicitudes ni resultados.
    obtenerAdministrativo: (actor, id) => leerPaciente(actor, id, 'LEER_DATOS_PACIENTE'),

    // Expediente completo: datos generales con sus solicitudes, exámenes y resultados.
    async obtener(actor, id) {
      const paciente = await leerPaciente(actor, id, 'LEER_HISTORIAL');
      return { ...paciente, solicitudes: await solicitudes.dePaciente(id) };
    },

    archivar(actor, id, motivo_archivado) {
      return escribir(actor, 'ARCHIVAR_HISTORIAL', { id_paciente: id, recurso: 'pacientes', detalle: motivo_archivado }, async tx => {
        R.exigirActivo(await tx.pacientes.obtener(id, { bloquear: true }));
        if (!(await tx.pacientes.archivar(id, { motivo_archivado, fecha_archivado: new Date() }))) {
          throw E.conflict('El historial cambió durante la operación; vuelva a intentarlo');
        }
        return { id_paciente: id, estado_historial: 'Archivado' };
      });
    }
  };
}

module.exports = { crearPacientesService };
