'use strict';
// Agenda odontológica (extensión de la clínica): programar, listar y cambiar el estado de las citas.
const E = require('../domain/errors');
const R = require('../domain/reglas');

const MIN = 60_000;
const seCruzan = (a, b) => a.inicio < b.fin && b.inicio < a.fin;
const intervalo = c => ({ inicio: new Date(c.fecha_hora).getTime(), fin: new Date(c.fecha_hora).getTime() + c.duracion_min * MIN });

function crearCitasService({ citas }, comun) {
  const { auditar, escribir } = comun;

  return {
    // Un odontólogo no puede tener dos citas programadas que se crucen.
    async programar(actor, d) {
      if (d.fecha_hora.getTime() < Date.now() - 5 * MIN) throw E.invalid('La cita no puede programarse en el pasado');
      return escribir(actor, 'PROGRAMAR_CITA', r => ({ id_paciente: d.id_paciente, recurso: 'citas', detalle: `Cita ${r.id_cita}` }), async tx => {
        const p = R.exigirActivo(await tx.pacientes.obtener(d.id_paciente));
        const o = await tx.catalogos.obtenerOdontologo(d.id_odontologo);
        if (!o || !o.activo) throw E.badReference('Odontólogo inexistente o inactivo');
        const nueva = { fecha_hora: d.fecha_hora, duracion_min: d.duracion_min };
        const cercanas = await tx.citas.listar({ desde: new Date(d.fecha_hora.getTime() - 8 * 60 * MIN), hasta: new Date(d.fecha_hora.getTime() + d.duracion_min * MIN) });
        const choque = cercanas.find(c => c.id_odontologo === o.id_odontologo && c.estado === 'Programada' && seCruzan(intervalo(c), intervalo(nueva)));
        if (choque) throw E.conflict(`El odontólogo ya tiene una cita a las ${new Date(choque.fecha_hora).toISOString().slice(11, 16)} UTC`);
        const id_cita = await tx.citas.nuevoId();
        await tx.citas.crear(id_cita, {
          id_paciente: p.id_paciente, paciente: `${p.nombres} ${p.apellidos}`, id_odontologo: o.id_odontologo, odontologo: `${o.nombres} ${o.apellidos}`,
          fecha_hora: d.fecha_hora, duracion_min: d.duracion_min, motivo: d.motivo, estado: 'Programada', id_consulta: null,
          registrado_por: actor.id, fecha_registro: new Date()
        });
        return { id_cita };
      });
    },

    async listar(actor, filtros) {
      const r = await citas.listar(filtros);
      await auditar(actor, 'LISTAR_CITAS', { recurso: 'citas' });
      return r;
    },

    async cambiarEstado(actor, id, estado) {
      return escribir(actor, 'CAMBIAR_ESTADO_CITA', r => ({ id_paciente: r.id_paciente, recurso: 'citas', detalle: `Cita ${id}: ${estado}` }), async tx => {
        const c = await tx.citas.obtener(id);
        if (!c) throw E.notFound('Cita inexistente');
        R.cambiarEstadoCita(c.estado, estado);
        await tx.citas.actualizar(id, { estado, actualizado_por: actor.id });
        return { id_cita: id, id_paciente: c.id_paciente, estado };
      });
    }
  };
}

module.exports = { crearCitasService };
