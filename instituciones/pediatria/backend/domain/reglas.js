'use strict';
// Reglas de negocio del historial pediátrico. No dependen del motor de base de datos.
// No contienen reglas clínicas (dosis, calendarios ni recomendaciones terapéuticas).
const { randomUUID } = require('node:crypto');
const E = require('./errors');

const ESTADOS_HISTORIAL = ['Activo', 'Archivado'];
const ESTADOS_DOSIS = ['Pendiente', 'Aplicada', 'Cancelada'];
// Tolerancia para relojes desincronizados entre cliente y servidor.
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

function nuevoId(prefijo) {
  return `${prefijo}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

// Identificadores automáticos de paciente: "P" + correlativo de hasta 9 dígitos
// (cabe en un entero de 32 bits, sin desbordar $toInt en MongoDB). La forma
// "P" + dígitos queda reservada al sistema: un id manual no puede usarla, así
// que ningún alta manual adelanta, agota ni ocupa la secuencia automática.
// Los ids heredados con más de 9 dígitos se ignoran al calcular la secuencia.
const ID_PACIENTE_AUTOMATICO = /^P\d{1,9}$/;
const MAX_CORRELATIVO_PACIENTE = 999999999;
const esIdPacienteReservado = id => /^P\d+$/i.test(id);

// ultimo: mayor correlativo existente entre los ids que cumplen ID_PACIENTE_AUTOMATICO.
function siguienteIdPaciente(ultimo) {
  if (ultimo >= MAX_CORRELATIVO_PACIENTE) {
    throw E.conflict('Se agotó la secuencia automática de identificadores de paciente; contacte al administrador');
  }
  return `P${String(ultimo + 1).padStart(3, '0')}`;
}

function validarTutores(tutores) {
  const principales = tutores.filter(t => t.es_principal).length;
  if (principales !== 1) throw E.invalid('Debe existir exactamente un tutor principal');
  const ids = new Set(tutores.map(t => t.id_tutor));
  if (ids.size !== tutores.length) throw E.invalid('id_tutor repetido dentro del paciente');
  const dpis = new Set(tutores.map(t => t.dpi));
  if (dpis.size !== tutores.length) throw E.invalid('DPI de tutor repetido dentro del paciente');
}

function noEnFuturo(fecha, campo, ahora = new Date()) {
  if (fecha.getTime() > ahora.getTime() + TOLERANCIA_FUTURO_MS) {
    throw E.invalid(`${campo} no puede estar en el futuro`);
  }
}

function noAntesDeNacimiento(fecha, paciente, campo) {
  if (paciente.fecha_nacimiento && fecha < new Date(paciente.fecha_nacimiento)) {
    throw E.invalid(`${campo} no puede ser anterior a la fecha de nacimiento`);
  }
}

// Un historial archivado se conserva solo para lectura.
function exigirActivo(paciente) {
  if (!paciente) throw E.notFound('Paciente inexistente');
  if (paciente.estado_historial !== 'Activo') {
    throw E.conflict('El historial está archivado; no admite modificaciones');
  }
}

// Una misma vacuna y número de dosis solo puede estar programada o aplicada una vez.
function dosisDuplicada(esquema, id_vacuna, numero_dosis) {
  return (esquema || []).some(d => d.id_vacuna === id_vacuna &&
    d.numero_dosis === numero_dosis && d.estado !== 'Cancelada');
}

// DPI del tutor (información restringida en Fase I): el personal médico no lo
// necesita, por lo que se le muestra enmascarado (solo los 4 últimos caracteres).
function enmascararDpi(dpi) {
  const s = String(dpi ?? '');
  return s.length <= 4 ? '•'.repeat(s.length) : `${'•'.repeat(s.length - 4)}${s.slice(-4)}`;
}

function edadEnMeses(fechaNacimiento, fecha) {
  const n = new Date(fechaNacimiento), f = new Date(fecha);
  let meses = (f.getUTCFullYear() - n.getUTCFullYear()) * 12 + (f.getUTCMonth() - n.getUTCMonth());
  if (f.getUTCDate() < n.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

module.exports = {
  ESTADOS_HISTORIAL, ESTADOS_DOSIS, nuevoId, ID_PACIENTE_AUTOMATICO, esIdPacienteReservado, siguienteIdPaciente,
  validarTutores, noEnFuturo,
  noAntesDeNacimiento, exigirActivo, dosisDuplicada, edadEnMeses, enmascararDpi
};
