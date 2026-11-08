'use strict';
// Casos de uso clínicos: registrar consulta, agregar diagnóstico, tratamiento por pieza y receta.
// Cada operación lee el paciente y la consulta y escribe en la misma transacción.
const { randomUUID } = require('node:crypto');
const E = require('../domain/errors');
const R = require('../domain/reglas');

const nuevoId = p => `${p}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

function crearConsultasService({ consultas }, comun) {
  const { escribir, leerPaciente } = comun;

  async function odontologoActivo(tx, id) {
    const o = await tx.catalogos.obtenerOdontologo(id);
    if (!o || !o.activo) throw E.badReference('Odontólogo inexistente o inactivo');
    return o;
  }

  // Completa cada tratamiento con el nombre del procedimiento del catálogo (si se indica).
  async function prepararTratamientos(tx, lista, actor) {
    const r = [];
    for (const t of lista) {
      R.exigirPieza(t.pieza);
      let procedimiento = t.procedimiento || null;
      if (t.id_procedimiento) {
        const p = await tx.catalogos.obtenerProcedimiento(t.id_procedimiento);
        if (!p) throw E.badReference(`Procedimiento inexistente: ${t.id_procedimiento}`);
        procedimiento = p.nombre;
      }
      if (!procedimiento) throw E.invalid('Cada tratamiento necesita un procedimiento');
      r.push({ id_tratamiento: nuevoId('T'), pieza: t.pieza || null, id_procedimiento: t.id_procedimiento || null, procedimiento,
        descripcion: t.descripcion || null, recomendaciones: t.recomendaciones || null, fecha: new Date(), registrado_por: actor.id });
    }
    return r;
  }
  const prescripcion = (d, actor) => ({ id_prescripcion: nuevoId('RX'), fecha_emision: new Date(), indicaciones_generales: d.indicaciones_generales || null,
    medicamentos: d.medicamentos, registrado_por: actor.id });
  // El odontograma guarda el último tratamiento de cada pieza (sin pisar su estado).
  const piezasTratadas = (tratamientos, idConsulta) => Object.fromEntries(tratamientos.filter(t => t.pieza).map(t => [
    `piezas.${t.pieza}.ultimo_tratamiento`, { procedimiento: t.procedimiento, fecha: t.fecha, id_consulta: idConsulta }
  ]));

  async function contexto(tx, idPaciente, idConsulta) {
    const p = R.exigirActivo(await tx.pacientes.obtener(idPaciente));
    const c = await tx.consultas.obtener(idPaciente, idConsulta);
    if (!c) throw E.notFound('Consulta inexistente');
    return { p, c };
  }

  return {
    // Registrar consulta (regla común). Puede traer diagnósticos, tratamientos y receta, y cerrar su cita.
    async registrar(actor, idPaciente, d) {
      R.noEnFuturo(d.fecha_hora, 'fecha_hora');
      for (const x of d.diagnosticos) R.exigirPieza(x.pieza);
      return escribir(actor, 'REGISTRAR_CONSULTA', r => ({ id_paciente: idPaciente, recurso: 'consultas', detalle: `Consulta ${r.id_consulta}` }), async tx => {
        const p = R.exigirActivo(await tx.pacientes.obtener(idPaciente));
        R.despuesDeNacer(d.fecha_hora, p, 'fecha_hora');
        const o = await odontologoActivo(tx, d.id_odontologo);
        const tratamientos = await prepararTratamientos(tx, d.tratamientos, actor);
        let cita = null;
        if (d.id_cita) {
          cita = await tx.citas.obtener(d.id_cita);
          if (!cita || cita.id_paciente !== idPaciente) throw E.badReference('La cita no pertenece al paciente');
          R.cambiarEstadoCita(cita.estado, 'Atendida');
        }
        const id_consulta = await tx.consultas.nuevoId();
        await tx.consultas.crear(idPaciente, id_consulta, {
          fecha_hora: d.fecha_hora, id_odontologo: o.id_odontologo, odontologo: `${o.nombres} ${o.apellidos}`,
          motivo: d.motivo, evaluacion: d.evaluacion, id_cita: d.id_cita || null,
          diagnosticos: d.diagnosticos.map(x => ({ ...x, pieza: x.pieza || null, fecha: new Date(), registrado_por: actor.id })),
          tratamientos, prescripciones: d.prescripcion ? [prescripcion(d.prescripcion, actor)] : [],
          fecha_registro: new Date(), registrado_por: actor.id
        });
        const ultima = !p.ultima_consulta || new Date(p.ultima_consulta) < d.fecha_hora ? d.fecha_hora : p.ultima_consulta;
        await tx.pacientes.actualizar(idPaciente, { total_consultas: (p.total_consultas || 0) + 1, ultima_consulta: ultima, ...piezasTratadas(tratamientos, id_consulta) });
        if (cita) await tx.citas.actualizar(cita.id_cita, { estado: 'Atendida', id_consulta, actualizado_por: actor.id });
        return { id_consulta };
      });
    },

    // Agregar diagnóstico (regla común) a una consulta existente.
    async agregarDiagnostico(actor, idPaciente, idConsulta, d) {
      R.exigirPieza(d.pieza);
      return escribir(actor, 'AGREGAR_DIAGNOSTICO', { id_paciente: idPaciente, recurso: 'consultas', detalle: `${d.codigo} en ${idConsulta}` }, async tx => {
        const { c } = await contexto(tx, idPaciente, idConsulta);
        R.caben(c.diagnosticos, 1, 'diagnósticos');
        await tx.consultas.actualizar(idPaciente, idConsulta, {
          diagnosticos: [...c.diagnosticos, { ...d, pieza: d.pieza || null, fecha: new Date(), registrado_por: actor.id }]
        });
        return { id_consulta: idConsulta, diagnosticos: c.diagnosticos.length + 1 };
      });
    },

    // Tratamiento por pieza: queda en la consulta y como último tratamiento de la pieza.
    async agregarTratamiento(actor, idPaciente, idConsulta, d) {
      return escribir(actor, 'AGREGAR_TRATAMIENTO', { id_paciente: idPaciente, recurso: 'consultas', detalle: `Pieza ${d.pieza || '—'} en ${idConsulta}` }, async tx => {
        const { c } = await contexto(tx, idPaciente, idConsulta);
        R.caben(c.tratamientos, 1, 'tratamientos');
        const [t] = await prepararTratamientos(tx, [d], actor);
        await tx.consultas.actualizar(idPaciente, idConsulta, { tratamientos: [...c.tratamientos, t] });
        await tx.pacientes.actualizar(idPaciente, piezasTratadas([t], idConsulta));
        return { id_consulta: idConsulta, id_tratamiento: t.id_tratamiento };
      });
    },

    // Recetar (regla común): una receta con uno o varios medicamentos.
    async agregarPrescripcion(actor, idPaciente, idConsulta, d) {
      return escribir(actor, 'REGISTRAR_PRESCRIPCION', { id_paciente: idPaciente, recurso: 'consultas', detalle: `Receta en ${idConsulta}` }, async tx => {
        const { c } = await contexto(tx, idPaciente, idConsulta);
        R.caben(c.prescripciones, 1, 'recetas');
        const rx = prescripcion(d, actor);
        await tx.consultas.actualizar(idPaciente, idConsulta, { prescripciones: [...c.prescripciones, rx] });
        return { id_consulta: idConsulta, id_prescripcion: rx.id_prescripcion };
      });
    },

    async listar(actor, idPaciente) {
      await leerPaciente(actor, idPaciente, 'LEER_CONSULTAS');
      return consultas.listar(idPaciente);
    },

    // Historial de medicamentos: lista plana, receta más reciente primero.
    async prescripciones(actor, idPaciente) {
      await leerPaciente(actor, idPaciente, 'LEER_PRESCRIPCIONES');
      return (await consultas.listar(idPaciente))
        .flatMap(c => c.prescripciones.flatMap(rx => rx.medicamentos.map(m => ({
          ...m, id_prescripcion: rx.id_prescripcion, fecha_emision: rx.fecha_emision, id_consulta: c.id_consulta, odontologo: c.odontologo
        }))))
        .sort((a, b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
    }
  };
}

module.exports = { crearConsultasService };
