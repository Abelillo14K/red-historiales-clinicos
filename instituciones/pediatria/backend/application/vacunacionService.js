'use strict';
// Casos de uso: esquema de vacunación. El sistema no define calendarios oficiales;
// solo registra las dosis que el personal programa y aplica.
const E = require('../domain/errors');
const R = require('../domain/reglas');
const { traza } = require('./comun');

function crearVacunacionService({ pacientes, vacunas, medicos }, comun) {
  const { leerHistorial, cargarActivo, escribir } = comun;

  async function catalogos() {
    const [vs, ms] = await Promise.all([vacunas.listar(), medicos.listar()]);
    return { vs: new Map(vs.map(v => [v.id_vacuna, v])), ms: new Map(ms.map(m => [m.id_medico, m])) };
  }

  async function esquema(actor, id, { estado } = {}) {
    const p = await leerHistorial(actor, id, 'LEER_VACUNACION');
    const { vs, ms } = await catalogos();
    return (p.esquema_vacunacion || [])
      .filter(d => !estado || d.estado === estado)
      .map(d => ({
        ...d,
        vacuna: vs.get(d.id_vacuna)?.nombre || null,
        medico: d.id_medico && ms.get(d.id_medico) ? `${ms.get(d.id_medico).nombres} ${ms.get(d.id_medico).apellidos}` : null
      }))
      .sort((a, b) => new Date(a.fecha_programada) - new Date(b.fecha_programada));
  }

  async function programar(actor, id, datos) {
    if (datos.estado && datos.estado !== 'Pendiente') throw E.invalid('La programación inicial debe estar Pendiente');
    if (!await vacunas.obtener(datos.id_vacuna)) throw E.badReference(`Vacuna inexistente: ${datos.id_vacuna}`);
    const p = await cargarActivo(id);
    R.noAntesDeNacimiento(datos.fecha_programada, p, 'fecha_programada');
    if (R.dosisDuplicada(p.esquema_vacunacion, datos.id_vacuna, datos.numero_dosis)) {
      throw E.conflict(`La dosis ${datos.numero_dosis} de ${datos.id_vacuna} ya está programada o aplicada`);
    }
    const dosis = {
      id_esquema: datos.id_esquema || R.nuevoId('EV'), id_vacuna: datos.id_vacuna, numero_dosis: datos.numero_dosis,
      fecha_programada: datos.fecha_programada, fecha_aplicacion: null, estado: 'Pendiente', lote: null,
      id_medico: null, programado_por: traza(actor)
    };
    await escribir(actor, 'PROGRAMAR_VACUNA', { id_paciente: id, recurso: 'esquema_vacunacion', referencia: dosis.id_esquema },
      () => pacientes.programarDosis(id, dosis), 'Dosis duplicada: identificador o vacuna/número de dosis ya registrado');
    return { id_esquema: dosis.id_esquema };
  }

  function exigirPendiente(p, idEsquema) {
    const d = (p.esquema_vacunacion || []).find(x => x.id_esquema === idEsquema);
    if (!d) throw E.notFound('Dosis inexistente en el esquema del paciente');
    if (d.estado !== 'Pendiente') throw E.conflict(`La dosis ya está en estado ${d.estado}; no puede modificarse`);
    return d;
  }

  async function aplicar(actor, id, idEsquema, datos) {
    if (!await medicos.obtener(datos.id_medico)) throw E.badReference(`Médico inexistente: ${datos.id_medico}`);
    const p = await cargarActivo(id);
    exigirPendiente(p, idEsquema);
    R.noEnFuturo(datos.fecha_aplicacion, 'fecha_aplicacion');
    R.noAntesDeNacimiento(datos.fecha_aplicacion, p, 'fecha_aplicacion');
    await escribir(actor, 'APLICAR_VACUNA', { id_paciente: id, recurso: 'esquema_vacunacion', referencia: idEsquema },
      () => pacientes.aplicarDosis(id, idEsquema, { ...datos, aplicado_por: traza(actor) }),
      'La dosis dejó de estar pendiente (posible doble aplicación)');
    return { ok: true };
  }

  async function cancelar(actor, id, idEsquema, { motivo_cancelacion }) {
    const p = await cargarActivo(id);
    exigirPendiente(p, idEsquema);
    await escribir(actor, 'CANCELAR_VACUNA', { id_paciente: id, recurso: 'esquema_vacunacion', referencia: idEsquema, detalle: motivo_cancelacion },
      () => pacientes.cancelarDosis(id, idEsquema, { motivo_cancelacion, cancelado_por: traza(actor) }),
      'La dosis dejó de estar pendiente');
    return { ok: true };
  }

  async function pendientes(_actor, { limite = 20 } = {}) {
    const [lista, { vs }] = await Promise.all([pacientes.dosisPendientes({ limite }), catalogos()]);
    return lista.map(d => ({ ...d, vacuna: vs.get(d.id_vacuna)?.nombre || null }));
  }

  return { esquema, programar, aplicar, cancelar, pendientes };
}

module.exports = { crearVacunacionService };
