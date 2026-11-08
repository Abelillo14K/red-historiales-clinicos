'use strict';
// Casos de uso de resultados (el «diagnóstico» del laboratorio): registro preliminar y validación.
// El laboratorio no receta medicamentos; esa regla común no aplica a esta institución.
const E = require('../domain/errors');
const R = require('../domain/reglas');
const { paginar } = require('./comun');

function crearResultadosService({ resultados, pacientes, unidad }, comun) {
  const { auditar, escribir, exigirLectura } = comun;

  // Contexto bloqueado del examen; rechaza historiales archivados, solicitudes anuladas y resultados ya validados.
  async function contextoEditable(tx, filtro) {
    const ctx = await tx.resultados.contexto(filtro, { bloquear: true });
    if (!ctx || (filtro.id_resultado && !ctx.resultado)) throw E.notFound(filtro.id_resultado ? 'Resultado inexistente' : 'Examen inexistente');
    R.exigirActivo({ estado_historial: ctx.estado_historial });
    if (ctx.estado_solicitud === 'Anulada') throw E.conflict('La solicitud está anulada');
    if (ctx.resultado?.estado === 'Validado') throw E.conflict('El resultado ya fue validado; no admite cambios');
    return ctx;
  }

  async function actualizarEstados(tx, ctx, estadoExamen) {
    const estados = await tx.solicitudes.cambiarEstadoExamen(ctx.id_examen, estadoExamen);
    await tx.solicitudes.cambiarEstado(ctx.id_solicitud, R.estadoSolicitud(estados));
  }

  return {
    async registrar(actor, idExamen, { fecha_analisis, observaciones, valores }) {
      R.noEnFuturo(fecha_analisis, 'fecha_analisis');
      return escribir(actor, 'REGISTRAR_RESULTADO', r => ({ id_paciente: r.id_paciente, recurso: 'resultados', detalle: `Examen ${idExamen}` }), async tx => {
        const ctx = await contextoEditable(tx, { id_examen: idExamen });
        const detalles = R.evaluarValores(ctx.parametros, valores);
        const id_resultado = await tx.resultados.guardar(idExamen, { fecha_analisis: fecha_analisis || new Date(), observaciones: observaciones ?? null }, detalles);
        await actualizarEstados(tx, ctx, 'Procesando');
        return { id_resultado, id_paciente: ctx.id_paciente, fuera_de_rango: detalles.filter(d => d.fuera_de_rango).length };
      });
    },

    // La bitácora de la validación la escribe el trigger de PostgreSQL (trg_resultado_validacion).
    validar(actor, idResultado) {
      return unidad.ejecutar(async tx => {
        const personal = await tx.catalogos.personalPorUsuario(actor.id);
        if (!personal || !personal.activo) throw E.badReference('El usuario no está registrado como personal activo del laboratorio');
        const ctx = await contextoEditable(tx, { id_resultado: idResultado });
        R.exigirCompleto(ctx.parametros, ctx.resultado.detalles);
        if (!(await tx.resultados.validar(idResultado, { id_personal_valida: personal.id_personal, fecha_emision: new Date() }))) {
          throw E.conflict('El resultado cambió durante la operación; vuelva a intentarlo');
        }
        await actualizarEstados(tx, ctx, 'Resultado listo');
        return { id_resultado: idResultado, estado: 'Validado' };
      });
    },

    async listar(actor, { estado, ...pag }) {
      const { limite, pagina, saltar } = paginar(pag);
      const r = await resultados.listar({ estado, limite, saltar });
      await auditar(actor, 'LISTAR_RESULTADOS', { recurso: 'resultados' });
      return { ...r, pagina, limite };
    },

    async obtener(actor, id) {
      const r = await resultados.obtener(id);
      if (!r) throw E.notFound('Resultado inexistente');
      await exigirLectura(actor, await pacientes.obtener(r.id_paciente), 'LEER_RESULTADO');
      return r;
    }
  };
}

module.exports = { crearResultadosService };
