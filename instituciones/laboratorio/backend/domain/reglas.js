'use strict';
// Reglas de negocio del laboratorio. No dependen del motor de base de datos.
// Marcar un valor fuera del rango de referencia del catálogo no es una indicación clínica.
const E = require('./errors');

const ESTADOS_HISTORIAL = ['Activo', 'Archivado'];
const PRIORIDADES = ['Rutina', 'Urgente'];
const ESTADOS_SOLICITUD = ['Pendiente', 'En proceso', 'Completada', 'Anulada'];
const ESTADOS_EXAMEN = ['Pendiente', 'Muestra tomada', 'Procesando', 'Resultado listo'];
const ESTADOS_RESULTADO = ['Preliminar', 'Validado'];
// Tolerancia para relojes desincronizados entre cliente y servidor.
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

function noEnFuturo(fecha, campo) {
  if (fecha instanceof Date && fecha.getTime() > Date.now() + TOLERANCIA_FUTURO_MS) {
    throw E.invalid(`${campo} no puede estar en el futuro`);
  }
}

function exigirActivo(paciente) {
  if (!paciente) throw E.notFound('Paciente inexistente');
  if (paciente.estado_historial !== 'Activo') throw E.conflict('El historial está archivado; no admite modificaciones');
  return paciente;
}

function sinRepetidos(valores, nombre) {
  const vistos = new Set();
  for (const v of valores.map(String)) {
    if (vistos.has(v)) throw E.invalid(`${nombre} repetido: ${v}`);
    vistos.add(v);
  }
}

// Convierte el valor según el tipo del parámetro y lo compara con su referencia del catálogo.
function evaluarValor(parametro, valor) {
  const base = { id_parametro: String(parametro.id_parametro), valor_numerico: null, valor_texto: null };
  if (parametro.tipo_dato === 'Numerico') {
    const n = typeof valor === 'number' ? valor : Number(String(valor ?? '').trim().replace(',', '.'));
    if (valor === null || valor === undefined || String(valor).trim() === '' || !Number.isFinite(n)) {
      throw E.invalid(`${parametro.nombre}: el valor debe ser numérico`);
    }
    const min = parametro.valor_ref_min == null ? null : Number(parametro.valor_ref_min);
    const max = parametro.valor_ref_max == null ? null : Number(parametro.valor_ref_max);
    return { ...base, valor_numerico: n, fuera_de_rango: (min !== null && n < min) || (max !== null && n > max) };
  }
  const texto = String(valor ?? '').trim();
  if (!texto) throw E.invalid(`${parametro.nombre}: el valor es obligatorio`);
  if (texto.length > 80) throw E.invalid(`${parametro.nombre}: máximo 80 caracteres`);
  const ref = parametro.valor_ref_texto;
  return { ...base, valor_texto: texto, fuera_de_rango: ref ? texto.toLowerCase() !== ref.toLowerCase() : false };
}

// Solo se aceptan parámetros del tipo de examen, cada uno una vez.
function evaluarValores(parametrosDelTipo, valores) {
  if (!valores.length) throw E.invalid('Registre al menos un parámetro');
  sinRepetidos(valores.map(v => v.id_parametro), 'Parámetro');
  const porId = new Map(parametrosDelTipo.map(p => [String(p.id_parametro), p]));
  return valores.map(v => {
    const p = porId.get(String(v.id_parametro));
    if (!p) throw E.invalid(`El parámetro ${v.id_parametro} no pertenece al tipo de examen`);
    return evaluarValor(p, v.valor);
  });
}

// Un resultado solo se valida con todos los parámetros de su tipo de examen.
function exigirCompleto(parametrosDelTipo, detalles) {
  const registrados = new Set(detalles.map(d => String(d.id_parametro)));
  const faltan = parametrosDelTipo.filter(p => !registrados.has(String(p.id_parametro))).map(p => p.nombre);
  if (faltan.length) throw E.invalid(`Faltan parámetros por registrar: ${faltan.join(', ')}`);
}

// El estado de la solicitud se deriva del de sus exámenes.
function estadoSolicitud(estadosExamen) {
  if (estadosExamen.length && estadosExamen.every(e => e === 'Resultado listo')) return 'Completada';
  if (estadosExamen.some(e => e !== 'Pendiente')) return 'En proceso';
  return 'Pendiente';
}

module.exports = {
  ESTADOS_HISTORIAL, PRIORIDADES, ESTADOS_SOLICITUD, ESTADOS_EXAMEN, ESTADOS_RESULTADO,
  noEnFuturo, exigirActivo, sinRepetidos, evaluarValor, evaluarValores, exigirCompleto, estadoSolicitud
};
