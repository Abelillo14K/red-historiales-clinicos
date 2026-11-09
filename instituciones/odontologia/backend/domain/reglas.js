'use strict';
// Reglas de negocio de la clínica odontológica. No dependen del motor de base de datos.
// El estado de una pieza lo registra el odontólogo; el sistema no sugiere tratamientos.
const E = require('./errors');

const ESTADOS_HISTORIAL = ['Activo', 'Archivado'];
const ESTADOS_CITA = ['Programada', 'Atendida', 'Cancelada', 'No asistió'];
const ESTADOS_PIEZA = ['Sana', 'Caries', 'Obturada', 'Endodoncia', 'Corona', 'Ausente', 'Extracción indicada', 'Implante'];
// Numeración FDI: permanentes (11–48) y temporales (51–85).
const PIEZAS = Object.freeze([
  ...[1, 2, 3, 4].flatMap(c => [1, 2, 3, 4, 5, 6, 7, 8].map(n => `${c}${n}`)),
  ...[5, 6, 7, 8].flatMap(c => [1, 2, 3, 4, 5].map(n => `${c}${n}`))
]);
const MAX_ELEMENTOS_CONSULTA = 50;
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

// La atención no puede ser anterior al nacimiento (fecha_nacimiento es 'AAAA-MM-DD').
function despuesDeNacer(fecha, paciente, campo) {
  if (fecha instanceof Date && fecha.toISOString().slice(0, 10) < paciente.fecha_nacimiento) {
    throw E.invalid(`${campo} es anterior a la fecha de nacimiento`);
  }
}

function exigirPieza(pieza) {
  if (pieza != null && !PIEZAS.includes(String(pieza))) throw E.invalid(`Pieza ${pieza} no existe en la numeración FDI`);
}

function caben(actuales, nuevos, que) {
  if ((actuales || []).length + nuevos > MAX_ELEMENTOS_CONSULTA) throw E.invalid(`La consulta alcanzó el máximo de ${MAX_ELEMENTOS_CONSULTA} ${que}`);
}

// Una cita programada puede pasar a cualquier otro estado; los demás son finales.
function cambiarEstadoCita(actual, nuevo) {
  if (actual === nuevo) throw E.conflict(`La cita ya está ${nuevo.toLowerCase()}`);
  if (actual !== 'Programada') throw E.conflict(`Una cita ${actual.toLowerCase()} no puede cambiar de estado`);
  return nuevo;
}

// Firestore no tiene búsqueda por subcadena: se guardan prefijos normalizados de cada palabra.
const normalizar = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function terminosBusqueda(...textos) {
  const t = new Set();
  for (const palabra of normalizar(textos.join(' ')).split(/\s+/).filter(Boolean)) {
    for (let i = 2; i <= Math.min(palabra.length, 15); i++) t.add(palabra.slice(0, i));
  }
  return [...t];
}
const claveDocumento = d => String(d).replace(/\s+/g, '').toUpperCase();
const idPaciente = n => `OD${String(n).padStart(6, '0')}`;

module.exports = {
  ESTADOS_HISTORIAL, ESTADOS_CITA, ESTADOS_PIEZA, PIEZAS, MAX_ELEMENTOS_CONSULTA,
  noEnFuturo, exigirActivo, despuesDeNacer, exigirPieza, caben, cambiarEstadoCita,
  normalizar, terminosBusqueda, claveDocumento, idPaciente
};
