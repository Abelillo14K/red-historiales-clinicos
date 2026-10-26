// Utilidades compartidas por los scripts de respaldo y restauración de MongoDB.
// Todo lo que hacen sobre una base es de SOLO LECTURA (find, listCollections,
// listIndexes). Nunca imprimen URIs, credenciales ni contenido de documentos:
// solo nombres de colecciones, conteos, identificadores y huellas SHA-256.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { BSON } = require('mongodb');

const COLECCIONES = ['pacientes', 'medicos', 'vacunas', 'bitacora_acceso'];
// Raíz del repositorio: allí están .env y respaldos/ (instituciones/pediatria/scripts/respaldo → ../../../..).
const RAIZ = path.join(__dirname, '..', '..', '..', '..');

const sha256 = datos => crypto.createHash('sha256').update(datos).digest('hex');
const sha256Archivo = archivo => sha256(fs.readFileSync(archivo));

// Ubica mongodump/mongorestore: MONGODB_TOOLS_BIN, la carpeta portátil
// ~/herramientas/mongodb-database-tools-*/bin o el PATH.
function binarioTools(nombre) {
  const exe = process.platform === 'win32' ? `${nombre}.exe` : nombre;
  const candidatos = [];
  if (process.env.MONGODB_TOOLS_BIN) candidatos.push(path.join(process.env.MONGODB_TOOLS_BIN, exe));
  const base = path.join(os.homedir(), 'herramientas');
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).filter(d => d.startsWith('mongodb-database-tools-')).sort().reverse()) {
      candidatos.push(path.join(base, d, 'bin', exe));
    }
  }
  for (const c of candidatos) if (fs.existsSync(c)) return c;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const c = path.join(dir, exe);
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`No se encontró ${exe}. Defina MONGODB_TOOLS_BIN (ver docs/RESPALDO_Y_RESTAURACION.md §1).`);
}

// Host:puerto de una URI sin credenciales (para comparar destinos sin mostrar secretos).
function destino(uri) {
  const u = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://'));
  return { host: u.hostname.replace(/^\[|\]$/g, ''), port: Number(u.port) || 27017 };
}

// Huella completa de una base, solo lectura. `docs` se usa para la integridad y no se escribe en disco.
async function huella(db) {
  const info = await db.listCollections({}, { nameOnly: false }).toArray();
  const colecciones = {};
  const docs = {};
  for (const c of info.sort((a, b) => a.name.localeCompare(b.name))) {
    if (c.name.startsWith('system.')) continue;
    const col = db.collection(c.name);
    const lista = await col.find({}).sort({ _id: 1 }).toArray();
    docs[c.name] = lista;
    const canonico = lista.map(d => BSON.EJSON.stringify(d, { relaxed: false })).join('\n');
    const indices = (await col.listIndexes().toArray())
      .map(({ v, ns, ...i }) => i)
      .sort((a, b) => a.name.localeCompare(b.name));
    const { validator, validationLevel, validationAction, ...otras } = c.options || {};
    colecciones[c.name] = {
      tipo: c.type,
      documentos: lista.length,
      sha256_documentos: sha256(canonico),
      ids: lista.map(d => BSON.EJSON.stringify(d._id, { relaxed: false })),
      estructura: estructura(lista),
      indices,
      validador: validator ? { validator: BSON.EJSON.serialize(validator, { relaxed: false }), validationLevel, validationAction } : null,
      otras_opciones: BSON.EJSON.serialize(otras, { relaxed: false })
    };
  }
  return { colecciones, integridad: integridad(docs) };
}

// Campos de primer nivel y cuántos documentos los tienen (sin valores).
function estructura(lista) {
  const campos = {};
  for (const d of lista) for (const k of Object.keys(d)) campos[k] = (campos[k] || 0) + 1;
  return Object.fromEntries(Object.entries(campos).sort(([a], [b]) => a.localeCompare(b)));
}

// Referencias del modelo (docs/MODELO_Y_DECISIONES.md §2) e integridad del historial y su auditoría.
function integridad(docs) {
  const pacientes = docs.pacientes || [], medicos = docs.medicos || [], vacunas = docs.vacunas || [], bitacora = docs.bitacora_acceso || [];
  const idsMedicos = new Set(medicos.map(m => m.id_medico));
  const idsVacunas = new Set(vacunas.map(v => v.id_vacuna));
  const idsPacientes = new Set(pacientes.map(p => p.id_paciente));
  const r = {
    pacientes_ids_unicos: idsPacientes.size === pacientes.length,
    consultas: 0, controles_crecimiento: 0, dosis: 0, prescripciones: 0, eventos_bitacora: bitacora.length,
    consultas_con_medico_inexistente: [], controles_con_consulta_inexistente: [], dosis_con_vacuna_inexistente: [],
    dosis_con_medico_inexistente: [], ids_repetidos_en_historial: [], eventos_con_paciente_inexistente: 0,
    eventos_id_evento_repetido: 0, eventos_pendientes_embebidos: 0
  };
  for (const p of pacientes) {
    const consultas = p.consultas || [], controles = p.controles_crecimiento || [], esquema = p.esquema_vacunacion || [];
    const idsConsulta = new Set(consultas.map(c => c.id_consulta));
    r.consultas += consultas.length; r.controles_crecimiento += controles.length; r.dosis += esquema.length;
    for (const c of consultas) {
      r.prescripciones += (c.prescripciones || []).length;
      if (!idsMedicos.has(c.id_medico)) r.consultas_con_medico_inexistente.push(`${p.id_paciente}/${c.id_consulta}`);
    }
    for (const c of controles) if (!idsConsulta.has(c.id_consulta)) r.controles_con_consulta_inexistente.push(`${p.id_paciente}/${c.id_control}`);
    for (const d of esquema) {
      if (!idsVacunas.has(d.id_vacuna)) r.dosis_con_vacuna_inexistente.push(`${p.id_paciente}/${d.id_esquema}`);
      if (d.id_medico && !idsMedicos.has(d.id_medico)) r.dosis_con_medico_inexistente.push(`${p.id_paciente}/${d.id_esquema}`);
    }
    for (const [lista, campo] of [[consultas, 'id_consulta'], [controles, 'id_control'], [esquema, 'id_esquema'], [p.tutores || [], 'id_tutor']]) {
      if (new Set(lista.map(x => x[campo])).size !== lista.length) r.ids_repetidos_en_historial.push(`${p.id_paciente}.${campo}`);
    }
    r.eventos_pendientes_embebidos += (p.bitacora_pendiente || []).length;
  }
  const idsEvento = bitacora.map(e => e.id_evento).filter(x => typeof x === 'string');
  r.eventos_id_evento_repetido = idsEvento.length - new Set(idsEvento).size;
  r.eventos_con_paciente_inexistente = bitacora.filter(e => e.id_paciente && !idsPacientes.has(e.id_paciente)).length;
  return r;
}

// Diferencias entre dos huellas (vacío = idénticas en todo lo comparado).
function comparar(origen, destinoH) {
  const dif = [];
  const a = origen.colecciones, b = destinoH.colecciones;
  const nombres = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const n of nombres) {
    if (!a[n]) { dif.push(`${n}: solo existe en el destino`); continue; }
    if (!b[n]) { dif.push(`${n}: falta en el destino`); continue; }
    for (const campo of ['tipo', 'documentos', 'sha256_documentos', 'ids', 'estructura', 'indices', 'validador', 'otras_opciones']) {
      if (JSON.stringify(a[n][campo]) !== JSON.stringify(b[n][campo])) dif.push(`${n}.${campo} difiere`);
    }
  }
  if (JSON.stringify(origen.integridad) !== JSON.stringify(destinoH.integridad)) dif.push('integridad difiere');
  return dif;
}

const marcaTiempo = () => new Date().toISOString().replace(/[:.]/g, '-');

module.exports = { COLECCIONES, RAIZ, sha256, sha256Archivo, binarioTools, destino, huella, comparar, marcaTiempo };
