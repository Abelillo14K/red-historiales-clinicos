'use strict';
// Doble en memoria de los puertos de la clínica, con la misma semántica que el adaptador Firestore:
// en una unidad de trabajo las lecturas ven el estado previo y las escrituras se aplican todas al final.
const E = require('../../backend/domain/errors');
const R = require('../../backend/domain/reglas');

const copia = x => structuredClone(x);
const porNombre = (a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es');

// Aplica cambios con rutas 'a.b.c' como lo hace update() de Firestore.
function aplicarCambios(objeto, cambios) {
  for (const [ruta, valor] of Object.entries(cambios)) {
    const partes = ruta.split('.');
    let o = objeto;
    for (const p of partes.slice(0, -1)) o = o[p] ??= {};
    o[partes.at(-1)] = copia(valor);
  }
}

function crearRepositoriosMemoria({ fallarAuditoria = false } = {}) {
  let db = { contador: 0, auto: 0, pacientes: {}, documentos: {}, consultas: {}, citas: {}, odontologos: {}, procedimientos: {}, bitacora: [] };
  const autoId = () => `AUTO${String(++db.auto).padStart(6, '0')}`;

  function repos(pendientes) {
    const escribir = op => {
      if (!pendientes) throw new Error('Escritura fuera de una unidad de trabajo');
      pendientes.push(op);
    };
    const crearEn = (tabla, clave, valor, mensaje) => escribir(() => {
      if (db[tabla][clave]) throw E.conflict(mensaje);
      db[tabla][clave] = copia(valor);
    });

    const pacientes = {
      async siguienteId() {
        if (!pendientes) throw new Error('siguienteId requiere una unidad de trabajo');
        const n = db.contador + 1;
        escribir(() => { db.contador = n; });
        return R.idPaciente(n);
      },
      async reservarDocumento(documento, id) {
        const k = R.claveDocumento(documento);
        if (db.documentos[k]) throw E.conflict('Ya existe un paciente con ese documento de identidad');
        crearEn('documentos', k, { id_paciente: id }, 'Ya existe un paciente con ese documento de identidad');
      },
      async crear(p) { crearEn('pacientes', p.id_paciente, p, 'Registro duplicado'); },
      async obtener(id) { return copia(db.pacientes[id] || null); },
      async listar({ texto, estado, limite, saltar }) {
        const t = R.normalizar(texto);
        const palabras = t.split(/\s+/).map(p => p.slice(0, 15)).filter(p => p.length >= 2);
        const items = Object.values(db.pacientes)
          .filter(p => !estado || estado === 'Todos' || p.estado_historial === estado)
          .filter(p => !t || p.documento_identidad === String(texto).trim() || (palabras.length && palabras.every(w => p.terminos.includes(w))))
          .map(({ terminos, ...p }) => p)
          .sort(porNombre);
        return copia({ items: items.slice(saltar, saltar + limite), total: items.length });
      },
      async actualizar(id, cambios) {
        escribir(() => {
          if (!db.pacientes[id]) throw E.notFound('El registro ya no existe');
          aplicarCambios(db.pacientes[id], cambios);
        });
      },
      async resumen() {
        const n = e => Object.values(db.pacientes).filter(p => p.estado_historial === e).length;
        return { pacientes_activos: n('Activo'), pacientes_archivados: n('Archivado') };
      }
    };

    const consultas = {
      nuevoId: autoId,
      async crear(idP, id, c) { crearEn('consultas', `${idP}/${id}`, { ...c, _paciente: idP }, 'Registro duplicado'); },
      async obtener(idP, idC) {
        const c = db.consultas[`${idP}/${idC}`];
        if (!c) return null;
        const { _paciente, ...resto } = copia(c);
        return { ...resto, id_consulta: idC };
      },
      async listar(idP) {
        return Object.entries(db.consultas).filter(([k]) => k.startsWith(`${idP}/`))
          .map(([k, { _paciente, ...c }]) => ({ ...copia(c), id_consulta: k.split('/')[1] }))
          .sort((a, b) => b.fecha_hora - a.fecha_hora);
      },
      async actualizar(idP, idC, cambios) {
        escribir(() => {
          if (!db.consultas[`${idP}/${idC}`]) throw E.notFound('El registro ya no existe');
          aplicarCambios(db.consultas[`${idP}/${idC}`], cambios);
        });
      },
      async contar() { return Object.keys(db.consultas).length; }
    };

    const citas = {
      nuevoId: autoId,
      async crear(id, c) { crearEn('citas', id, c, 'Registro duplicado'); },
      async obtener(id) { return db.citas[id] ? { ...copia(db.citas[id]), id_cita: id } : null; },
      async listar({ desde, hasta, estado, id_paciente, limite = 500 } = {}) {
        return Object.entries(db.citas).map(([id, c]) => ({ ...copia(c), id_cita: id }))
          .filter(c => (!id_paciente || c.id_paciente === id_paciente) && (!estado || c.estado === estado) &&
            (!desde || c.fecha_hora >= desde) && (!hasta || c.fecha_hora <= hasta))
          .sort((a, b) => a.fecha_hora - b.fecha_hora).slice(0, limite);
      },
      async actualizar(id, cambios) { escribir(() => aplicarCambios(db.citas[id], cambios)); }
    };

    const catalogos = {
      async odontologos() { return copia(Object.values(db.odontologos)).sort(porNombre); },
      async obtenerOdontologo(id) { return copia(db.odontologos[id] || null); },
      async crearOdontologo(d) { crearEn('odontologos', d.id_odontologo, d, 'Ya existe un odontólogo con ese número de colegiado'); },
      async procedimientos() { return copia(Object.values(db.procedimientos)).sort((a, b) => a.codigo.localeCompare(b.codigo)); },
      async obtenerProcedimiento(id) { return copia(db.procedimientos[id] || null); },
      async crearProcedimiento(d) { crearEn('procedimientos', d.id_procedimiento, d, 'Ya existe un procedimiento con ese código'); }
    };

    const auditoria = {
      async registrar(e) {
        if (fallarAuditoria) throw new Error('bitácora no disponible');
        const fila = { ...copia(e), id_evento: autoId() };
        if (pendientes) escribir(() => db.bitacora.push(fila));
        else db.bitacora.push(fila);
      },
      async listar({ id_paciente, accion, limite = 100 } = {}) {
        return copia(db.bitacora.filter(e => (!id_paciente || e.id_paciente === id_paciente) && (!accion || e.accion === accion))
          .sort((a, b) => b.fecha_hora - a.fecha_hora).slice(0, limite));
      }
    };

    return { pacientes, consultas, citas, catalogos, auditoria };
  }

  const unidad = {
    async ejecutar(fn) {
      const pendientes = [];
      const r = await fn(repos(pendientes));
      // Como un commit: si alguna escritura falla, no queda ninguna.
      const respaldo = copia(db);
      try {
        for (const op of pendientes) op();
      } catch (e) {
        db = respaldo;
        throw e;
      }
      return r;
    }
  };

  return { ...repos(null), unidad, estado: () => db, fallarAuditoria: v => { fallarAuditoria = v; } };
}

module.exports = { crearRepositoriosMemoria };
