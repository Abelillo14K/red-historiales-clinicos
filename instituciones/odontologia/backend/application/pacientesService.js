'use strict';
// Casos de uso de pacientes: registro, búsqueda, expediente, odontograma y archivo (baja sin borrar).
const E = require('../domain/errors');
const R = require('../domain/reglas');
const { tienePermiso } = require('../permisos');
const { paginar } = require('./comun');

// Datos clínicos que la proyección administrativa no entrega.
const sinClinicos = ({ antecedentes, piezas, ...resto }) => resto;

function crearPacientesService({ pacientes, consultas, citas }, comun) {
  const { auditar, escribir, leerPaciente } = comun;

  return {
    // Contador, unicidad del documento y alta en la misma transacción.
    async registrar(actor, d) {
      R.noEnFuturo(d.fecha_nacimiento, 'fecha_nacimiento');
      return escribir(actor, 'CREAR_PACIENTE', r => ({ id_paciente: r.id_paciente, recurso: 'pacientes' }), async tx => {
        const id_paciente = await tx.pacientes.siguienteId();
        if (d.documento_identidad) await tx.pacientes.reservarDocumento(d.documento_identidad, id_paciente);
        await tx.pacientes.crear({
          id_paciente, nombres: d.nombres, apellidos: d.apellidos, documento_identidad: d.documento_identidad || null,
          fecha_nacimiento: d.fecha_nacimiento.toISOString().slice(0, 10), sexo: d.sexo,
          contacto: d.contacto, antecedentes: d.antecedentes, atencion_inicial: d.atencion_inicial,
          estado_historial: 'Activo', fecha_archivado: null, motivo_archivado: null,
          total_consultas: 0, ultima_consulta: null, piezas: {},
          terminos: R.terminosBusqueda(d.nombres, d.apellidos),
          fecha_registro: new Date(), registrado_por: actor.id
        });
        return { id_paciente };
      });
    },

    async listar(actor, { q, estado = 'Activo', ...pag }) {
      if (estado !== 'Activo' && !tienePermiso(actor.rol, 'historial.leer_archivados')) {
        throw E.forbidden('Solo el administrador puede consultar historiales archivados');
      }
      const { limite, pagina, saltar } = paginar(pag);
      const r = await pacientes.listar({ texto: q, estado, limite, saltar });
      await auditar(actor, estado === 'Activo' ? 'LISTAR_PACIENTES' : 'LISTAR_ARCHIVADOS', { recurso: 'pacientes' });
      return { items: r.items.map(sinClinicos), total: r.total, pagina, limite };
    },

    // Datos generales y de contacto, sin antecedentes ni odontograma.
    async obtenerAdministrativo(actor, id) {
      return sinClinicos(await leerPaciente(actor, id, 'LEER_DATOS_PACIENTE'));
    },

    // Expediente completo: datos, antecedentes, odontograma, consultas y citas.
    async obtener(actor, id) {
      const paciente = await leerPaciente(actor, id, 'LEER_HISTORIAL');
      const [lista, agenda] = await Promise.all([consultas.listar(id), citas.listar({ id_paciente: id })]);
      return { ...paciente, consultas: lista, citas: agenda };
    },

    // Estado de una pieza en el odontograma (lo registra el odontólogo).
    async actualizarPieza(actor, id, pieza, { estado, observaciones }) {
      R.exigirPieza(pieza);
      return escribir(actor, 'ACTUALIZAR_PIEZA', { id_paciente: id, recurso: 'piezas', detalle: `Pieza ${pieza}: ${estado}` }, async tx => {
        const p = R.exigirActivo(await tx.pacientes.obtener(id));
        const previa = p.piezas?.[pieza] || {};
        await tx.pacientes.actualizar(id, {
          [`piezas.${pieza}`]: { ...previa, estado, observaciones: observaciones ?? null, actualizado: new Date(), actualizado_por: actor.id }
        });
        return { id_paciente: id, pieza, estado };
      });
    },

    async archivar(actor, id, motivo_archivado) {
      return escribir(actor, 'ARCHIVAR_HISTORIAL', { id_paciente: id, recurso: 'pacientes', detalle: motivo_archivado }, async tx => {
        R.exigirActivo(await tx.pacientes.obtener(id));
        await tx.pacientes.actualizar(id, { estado_historial: 'Archivado', motivo_archivado, fecha_archivado: new Date(), archivado_por: actor.id });
        return { id_paciente: id, estado_historial: 'Archivado' };
      });
    }
  };
}

module.exports = { crearPacientesService };
