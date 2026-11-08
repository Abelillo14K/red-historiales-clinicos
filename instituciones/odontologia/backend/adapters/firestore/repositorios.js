'use strict';
// Repositorios Cloud Firestore de la clínica odontológica.
//   pacientes/{OD000001}                datos, contacto, antecedentes y odontograma (mapa piezas)
//   pacientes/{id}/consultas/{auto}     consulta con diagnósticos, tratamientos y recetas embebidos
//   citas/{auto}                        agenda, con nombre de paciente y odontólogo copiados
//   odontologos/{colegiado} · procedimientos/{codigo}   catálogos (el id garantiza la unicidad)
//   documentos_paciente/{documento}     guarda de unicidad del documento de identidad
//   contadores/pacientes · bitacora/{auto}
// Dentro de una transacción (tx) las lecturas usan tx.get y las escrituras se acumulan en `pendientes`
// para aplicarlas al final, porque Firestore exige leer todo antes de escribir.
// Las consultas usan solo índices de un campo (los automáticos); el resto se filtra en memoria.
const { Timestamp } = require('firebase-admin/firestore');
const E = require('../../domain/errors');
const R = require('../../domain/reglas');

const ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
const LIMITE_LECTURA = 1000;

// Timestamp → Date en todo el documento.
function aJs(v) {
  if (v instanceof Timestamp) return v.toDate();
  if (Array.isArray(v)) return v.map(aJs);
  if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, aJs(x)]));
  return v;
}
const porNombre = (a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es');

function crearRepositorios(db, tx = null, pendientes = null) {
  const leer = ref => (tx ? tx.get(ref) : ref.get());
  const escribir = op => {
    if (!tx) throw new Error('Escritura fuera de una unidad de trabajo');
    pendientes.push(op);
  };
  const doc = async ref => {
    const s = await leer(ref);
    return s.exists ? aJs(s.data()) : null;
  };
  const docs = async consulta => (await leer(consulta)).docs.map(s => ({ ...aJs(s.data()), _id: s.id }));
  const sinId = ({ _id, ...x }) => x;

  const P = id => db.collection('pacientes').doc(id);
  const C = (idP, idC) => P(idP).collection('consultas').doc(idC);

  const pacientes = {
    async siguienteId() {
      const ref = db.collection('contadores').doc('pacientes');
      const n = ((await doc(ref))?.valor || 0) + 1;
      escribir(t => t.set(ref, { valor: n }));
      return R.idPaciente(n);
    },
    async reservarDocumento(documento, idPaciente) {
      const ref = db.collection('documentos_paciente').doc(R.claveDocumento(documento));
      if (await doc(ref)) throw E.conflict('Ya existe un paciente con ese documento de identidad');
      escribir(t => t.create(ref, { id_paciente: idPaciente }));
    },
    async crear(p) { escribir(t => t.create(P(p.id_paciente), p)); },
    obtener: id => (ID_VALIDO.test(String(id)) ? doc(P(String(id))) : Promise.resolve(null)),

    // Sin texto: igualdad por estado. Con texto: el documento exacto o el prefijo de la primera palabra
    // (array-contains); el estado y las demás palabras se filtran en memoria.
    async listar({ texto, estado, limite, saltar }) {
      const t = R.normalizar(texto);
      const col = db.collection('pacientes');
      let lista;
      if (!t) {
        lista = await docs(estado && estado !== 'Todos' ? col.where('estado_historial', '==', estado).limit(LIMITE_LECTURA) : col.limit(LIMITE_LECTURA));
      } else {
        const palabras = t.split(/\s+/).map(p => p.slice(0, 15)).filter(p => p.length >= 2);
        const [porTermino, porDocumento] = await Promise.all([
          palabras.length ? docs(col.where('terminos', 'array-contains', palabras[0]).limit(LIMITE_LECTURA)) : [],
          docs(col.where('documento_identidad', '==', String(texto).trim()).limit(5))
        ]);
        const vistos = new Set();
        lista = [...porDocumento, ...porTermino.filter(p => palabras.every(w => p.terminos.includes(w)))]
          .filter(p => !vistos.has(p._id) && vistos.add(p._id))
          .filter(p => !estado || estado === 'Todos' || p.estado_historial === estado);
      }
      lista = lista.map(sinId).map(({ terminos, ...p }) => p).sort(porNombre);
      return { items: lista.slice(saltar, saltar + limite), total: lista.length };
    },
    async actualizar(id, cambios) { escribir(t => t.update(P(id), cambios)); },
    async resumen() {
      const col = db.collection('pacientes');
      const [a, b] = await Promise.all(['Activo', 'Archivado'].map(e => col.where('estado_historial', '==', e).count().get()));
      return { pacientes_activos: a.data().count, pacientes_archivados: b.data().count };
    }
  };

  const consultas = {
    nuevoId: () => db.collection('pacientes').doc('_').collection('consultas').doc().id,
    async crear(idP, id, c) { escribir(t => t.create(C(idP, id), c)); },
    async obtener(idP, idC) {
      if (!ID_VALIDO.test(String(idP)) || !ID_VALIDO.test(String(idC))) return null;
      const c = await doc(C(idP, idC));
      return c && { ...c, id_consulta: idC };
    },
    async listar(idP) {
      if (!ID_VALIDO.test(String(idP))) return [];
      return (await docs(P(idP).collection('consultas').orderBy('fecha_hora', 'desc'))).map(({ _id, ...c }) => ({ ...c, id_consulta: _id }));
    },
    async actualizar(idP, idC, cambios) { escribir(t => t.update(C(idP, idC), cambios)); },
    contar: async () => (await db.collectionGroup('consultas').count().get()).data().count
  };

  const citas = {
    nuevoId: () => db.collection('citas').doc().id,
    async crear(id, c) { escribir(t => t.create(db.collection('citas').doc(id), c)); },
    async obtener(id) {
      if (!ID_VALIDO.test(String(id))) return null;
      const c = await doc(db.collection('citas').doc(String(id)));
      return c && { ...c, id_cita: String(id) };
    },
    // Por paciente: igualdad. Por fechas: rango y orden sobre el mismo campo. El resto, en memoria.
    async listar({ desde, hasta, estado, id_paciente, limite = 500 } = {}) {
      const col = db.collection('citas');
      let q;
      if (id_paciente) q = col.where('id_paciente', '==', String(id_paciente));
      else {
        q = col.orderBy('fecha_hora');
        if (desde) q = q.where('fecha_hora', '>=', desde);
        if (hasta) q = q.where('fecha_hora', '<=', hasta);
      }
      return (await docs(q.limit(LIMITE_LECTURA)))
        .map(({ _id, ...c }) => ({ ...c, id_cita: _id }))
        .filter(c => (!estado || c.estado === estado) && (!desde || c.fecha_hora >= desde) && (!hasta || c.fecha_hora <= hasta))
        .sort((a, b) => a.fecha_hora - b.fecha_hora)
        .slice(0, limite);
    },
    async actualizar(id, cambios) { escribir(t => t.update(db.collection('citas').doc(id), cambios)); }
  };

  const catalogo = (coleccion, clave, orden) => ({
    listar: async () => (await docs(db.collection(coleccion).limit(LIMITE_LECTURA))).map(sinId).sort(orden),
    obtener: id => (ID_VALIDO.test(String(id)) ? doc(db.collection(coleccion).doc(String(id))) : Promise.resolve(null)),
    async crear(d) { escribir(t => t.create(db.collection(coleccion).doc(d[clave]), d)); }
  });
  const odontologos = catalogo('odontologos', 'id_odontologo', porNombre);
  const procedimientos = catalogo('procedimientos', 'id_procedimiento', (a, b) => a.codigo.localeCompare(b.codigo));
  const catalogos = {
    odontologos: odontologos.listar, obtenerOdontologo: odontologos.obtener, crearOdontologo: odontologos.crear,
    procedimientos: procedimientos.listar, obtenerProcedimiento: procedimientos.obtener, crearProcedimiento: procedimientos.crear
  };

  const auditoria = {
    async registrar(e) {
      const ref = db.collection('bitacora').doc();
      if (tx) escribir(t => t.create(ref, e));
      else await ref.create(e);
    },
    // Un solo filtro de igualdad en el servidor; el otro y el orden, en memoria.
    async listar({ id_paciente, accion, limite = 100 } = {}) {
      const col = db.collection('bitacora');
      const q = id_paciente ? col.where('id_paciente', '==', String(id_paciente)).limit(LIMITE_LECTURA)
        : accion ? col.where('accion', '==', accion).limit(LIMITE_LECTURA)
          : col.orderBy('fecha_hora', 'desc').limit(limite);
      return (await docs(q)).map(({ _id, ...e }) => ({ ...e, id_evento: _id }))
        .filter(e => !accion || e.accion === accion)
        .sort((a, b) => b.fecha_hora - a.fecha_hora)
        .slice(0, limite);
    }
  };

  return { pacientes, consultas, citas, catalogos, auditoria };
}

module.exports = { crearRepositorios };
