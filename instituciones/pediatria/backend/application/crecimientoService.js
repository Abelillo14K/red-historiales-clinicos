'use strict';
// Casos de uso: controles de crecimiento (historial de mediciones, nunca se sobrescriben).
const E = require('../domain/errors');
const R = require('../domain/reglas');
const { traza } = require('./comun');

function crearCrecimientoService({ pacientes }, comun) {
  const { leerHistorial, cargarActivo, escribir, prepararMedicion } = comun;

  async function registrar(actor, id, datos) {
    const p = await cargarActivo(id);
    const consulta = (p.consultas || []).find(c => c.id_consulta === datos.id_consulta);
    if (!consulta) throw E.badReference(`La consulta ${datos.id_consulta} no existe en el historial`);
    const fecha = datos.fecha || new Date(consulta.fecha_hora);
    R.noEnFuturo(fecha, 'fecha');
    R.noAntesDeNacimiento(fecha, p, 'fecha');
    const control = {
      id_control: datos.id_control || R.nuevoId('CR'), id_consulta: datos.id_consulta, fecha,
      ...(await prepararMedicion(datos)),
      registrado_por: traza(actor)
    };
    await escribir(actor, 'REGISTRAR_CRECIMIENTO', { id_paciente: id, recurso: 'controles_crecimiento', referencia: control.id_control },
      () => pacientes.agregarControl(id, control), 'Identificador de control repetido o consulta inexistente');
    return { id_control: control.id_control };
  }

  // Orden cronológico ascendente y edad en meses para las gráficas del frontend.
  async function historial(actor, id) {
    const p = await leerHistorial(actor, id, 'LEER_CRECIMIENTO');
    return (p.controles_crecimiento || [])
      .map(c => ({ ...c, edad_meses: R.edadEnMeses(p.fecha_nacimiento, c.fecha) }))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }

  return { registrar, historial };
}

module.exports = { crearCrecimientoService };
