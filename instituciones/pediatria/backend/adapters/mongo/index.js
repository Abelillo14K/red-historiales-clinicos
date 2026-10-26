'use strict';
const R = require('./repositorios');
const { crearUnidadDeTrabajo } = require('./unidadDeTrabajo');

// Índices no destructivos (createIndex es idempotente con la misma definición).
const INDICES = [
  ['pacientes', { id_paciente: 1 }, { unique: true }],
  ['pacientes', { 'tutores.dpi': 1 }, {}],
  ['pacientes', { estado_historial: 1, apellidos: 1, nombres: 1 }, {}],
  // Localiza eventos de auditoría pendientes de entrega (outbox, ver unidadDeTrabajo.js).
  ['pacientes', { 'bitacora_pendiente.id_evento': 1 }, { sparse: true }],
  ['medicos', { id_medico: 1 }, { unique: true }],
  ['medicos', { colegiado: 1 }, { unique: true }],
  ['vacunas', { id_vacuna: 1 }, { unique: true }],
  ['bitacora_acceso', { id_paciente: 1, fecha_hora: -1 }, {}],
  ['bitacora_acceso', { fecha_hora: -1 }, {}],
  // Entrega idempotente de eventos; parcial para no exigirlo a eventos anteriores a Fase II.
  ['bitacora_acceso', { id_evento: 1 }, { unique: true, partialFilterExpression: { id_evento: { $type: 'string' } } }]
];

async function asegurarIndices(db) {
  const resultados = [];
  for (const [coleccion, clave, opciones] of INDICES) {
    try {
      resultados.push({ coleccion, indice: await db.collection(coleccion).createIndex(clave, opciones), ok: true });
    } catch (e) {
      resultados.push({ coleccion, indice: JSON.stringify(clave), ok: false, error: e.codeName || e.message });
    }
  }
  return resultados;
}

// Lee (sin modificar) el validador instalado en `pacientes` para saber si el
// perímetro cefálico ya es opcional. Requiere solo listCollections (readWrite).
async function detectarCapacidades(db) {
  const [info] = await db.listCollections({ name: 'pacientes' }).toArray();
  const requeridos = info?.options?.validator?.$jsonSchema?.properties?.controles_crecimiento?.items?.required || [];
  return { perimetro_cefalico_opcional: !requeridos.includes('perimetro_cefalico_cm') };
}

// Caché breve para reflejar un cambio de validador sin reiniciar la API.
function capacidadesConCache(db, ttlMs = 60_000) {
  let valor = null, hasta = 0;
  return async () => {
    if (!valor || Date.now() > hasta) { valor = await detectarCapacidades(db); hasta = Date.now() + ttlMs; }
    return valor;
  };
}

function crearRepositoriosMongo(client, db) {
  return {
    pacientes: R.crearPacienteRepository(db),
    medicos: R.crearMedicoRepository(db),
    vacunas: R.crearVacunaRepository(db),
    auditoria: R.crearAuditoriaRepository(db),
    unidad: crearUnidadDeTrabajo(client, db),
    capacidades: capacidadesConCache(db)
  };
}

module.exports = { crearRepositoriosMongo, asegurarIndices, detectarCapacidades, INDICES };
