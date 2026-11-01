'use strict';
// Casos de uso: consultas, diagnósticos, tratamiento y prescripciones.
// El contenido clínico lo captura el médico; el sistema no genera indicaciones.
const E = require('../domain/errors');
const R = require('../domain/reglas');
const { traza, limpiar } = require('./comun');

function crearConsultasService({ pacientes, medicos }, comun) {
  const { leerHistorial, cargarActivo, escribir, prepararMedicion } = comun;

  async function exigirMedico(id) {
    const m = await medicos.obtener(id);
    if (!m) throw E.badReference(`Médico inexistente: ${id}`);
    return m;
  }

  const buscarConsulta = (p, idConsulta) => {
    const c = (p.consultas || []).find(x => x.id_consulta === idConsulta);
    if (!c) throw E.notFound('Consulta inexistente en el historial');
    return c;
  };

  // Misma regla al crear la consulta y al agregar la receta después: no en el
  // futuro y no antes de la consulta a la que pertenece.
  function prepararPrescripcion(rx, fechaDefecto, fechaConsulta) {
    const fecha_emision = rx.fecha_emision || fechaDefecto;
    R.noEnFuturo(fecha_emision, 'fecha_emision');
    if (fecha_emision < new Date(fechaConsulta)) throw E.invalid('La prescripción no puede ser anterior a la consulta');
    return limpiar({
      id_prescripcion: rx.id_prescripcion || R.nuevoId('RX'),
      fecha_emision,
      indicaciones_generales: rx.indicaciones_generales,
      medicamentos: rx.medicamentos.map(m => ({ ...m, id_medicamento: m.id_medicamento || R.nuevoId('MED') }))
    });
  }

  function sinRepetidos(lista, campo, mensaje) {
    if (new Set(lista.map(x => x[campo])).size !== lista.length) throw E.invalid(mensaje);
  }

  async function registrar(actor, id, datos) {
    await exigirMedico(datos.id_medico);
    const p = await cargarActivo(id);
    R.noEnFuturo(datos.fecha_hora, 'fecha_hora');
    R.noAntesDeNacimiento(datos.fecha_hora, p, 'fecha_hora');
    sinRepetidos(datos.diagnosticos, 'codigo', 'Código de diagnóstico repetido en la consulta');
    const id_consulta = datos.id_consulta || R.nuevoId('C');
    const prescripciones = datos.prescripciones.map(rx => prepararPrescripcion(rx, datos.fecha_hora, datos.fecha_hora));
    sinRepetidos(prescripciones, 'id_prescripcion', 'id_prescripcion repetido en la consulta');
    const consulta = limpiar({
      id_consulta, id_medico: datos.id_medico, fecha_hora: datos.fecha_hora, motivo: datos.motivo,
      observaciones: datos.observaciones || undefined, diagnosticos: datos.diagnosticos,
      tratamiento: datos.tratamiento ? limpiar(datos.tratamiento) : undefined, prescripciones, registrado_por: traza(actor)
    });
    let control = null;
    if (datos.control_crecimiento) {
      const { id_control, ...medicion } = datos.control_crecimiento;
      control = {
        id_control: id_control || R.nuevoId('CR'), id_consulta, fecha: datos.fecha_hora,
        ...(await prepararMedicion(medicion)), registrado_por: traza(actor)
      };
    }
    await escribir(actor, 'REGISTRAR_CONSULTA', { id_paciente: id, recurso: 'consultas', referencia: id_consulta },
      () => pacientes.agregarConsulta(id, consulta, control),
      'La consulta o el control ya existen, o el historial cambió durante la operación; recargue y vuelva a intentarlo');
    return { id_consulta, id_control: control?.id_control || null };
  }

  async function mapaMedicos() {
    const lista = await medicos.listar();
    return new Map(lista.map(m => [m.id_medico, m]));
  }
  const resumenMedico = m => (m ? { nombres: m.nombres, apellidos: m.apellidos, especialidad: m.especialidad?.nombre } : null);

  async function listar(actor, id, { desde, hasta } = {}) {
    const p = await leerHistorial(actor, id, 'LEER_CONSULTAS');
    const ms = await mapaMedicos();
    const enRango = c => (!desde || new Date(c.fecha_hora) >= desde) && (!hasta || new Date(c.fecha_hora) <= hasta);
    return (p.consultas || [])
      .filter(enRango)
      .map(c => ({ ...c, medico: resumenMedico(ms.get(c.id_medico)) }))
      .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  }

  async function agregarDiagnostico(actor, id, idConsulta, d) {
    const p = await cargarActivo(id);
    const c = buscarConsulta(p, idConsulta);
    if ((c.diagnosticos || []).some(x => x.codigo === d.codigo)) {
      throw E.conflict(`El diagnóstico ${d.codigo} ya está registrado en la consulta`);
    }
    await escribir(actor, 'AGREGAR_DIAGNOSTICO', { id_paciente: id, recurso: 'diagnosticos', referencia: idConsulta },
      () => pacientes.agregarDiagnostico(id, idConsulta, { ...d, registrado_por: traza(actor) }));
    return { ok: true };
  }

  // Un tratamiento modificado no se pierde: la versión anterior pasa a
  // tratamientos_anteriores en la misma operación atómica.
  async function establecerTratamiento(actor, id, idConsulta, t) {
    const p = await cargarActivo(id);
    const previo = buscarConsulta(p, idConsulta).tratamiento || null;
    await escribir(actor, previo ? 'ACTUALIZAR_TRATAMIENTO' : 'AGREGAR_TRATAMIENTO',
      { id_paciente: id, recurso: 'tratamiento', referencia: idConsulta },
      () => pacientes.establecerTratamiento(id, idConsulta, limpiar({ ...t, registrado_por: traza(actor) }),
        previo, { reemplazado_por: traza(actor) }),
      'El tratamiento fue modificado por otra operación; recargue y vuelva a intentarlo');
    return { ok: true };
  }

  async function agregarPrescripcion(actor, id, idConsulta, datos) {
    const p = await cargarActivo(id);
    const c = buscarConsulta(p, idConsulta);
    const rx = prepararPrescripcion(datos, new Date(), c.fecha_hora);
    if ((c.prescripciones || []).some(x => x.id_prescripcion === rx.id_prescripcion)) {
      throw E.conflict('id_prescripcion repetido en la consulta');
    }
    rx.registrado_por = traza(actor);
    await escribir(actor, 'REGISTRAR_PRESCRIPCION', { id_paciente: id, recurso: 'prescripciones', referencia: rx.id_prescripcion },
      () => pacientes.agregarPrescripcion(id, idConsulta, rx));
    return { id_prescripcion: rx.id_prescripcion };
  }

  // Vista plana de medicamentos recetados en todo el historial (más recientes primero).
  async function listarPrescripciones(actor, id) {
    const p = await leerHistorial(actor, id, 'LEER_PRESCRIPCIONES');
    const ms = await mapaMedicos();
    return (p.consultas || []).flatMap(c => (c.prescripciones || []).map(rx => ({
      ...rx, id_consulta: c.id_consulta, fecha_consulta: c.fecha_hora, motivo_consulta: c.motivo,
      id_medico: c.id_medico, medico: resumenMedico(ms.get(c.id_medico))
    }))).sort((a, b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
  }

  async function listarDiagnosticos(actor, id) {
    const p = await leerHistorial(actor, id, 'LEER_DIAGNOSTICOS');
    return (p.consultas || []).flatMap(c => (c.diagnosticos || []).map(d => ({
      ...d, id_consulta: c.id_consulta, fecha_consulta: c.fecha_hora, id_medico: c.id_medico
    }))).sort((a, b) => new Date(b.fecha_consulta) - new Date(a.fecha_consulta));
  }

  return {
    registrar, listar, agregarDiagnostico, establecerTratamiento, agregarPrescripcion,
    listarPrescripciones, listarDiagnosticos, exigirMedico
  };
}

module.exports = { crearConsultasService };
