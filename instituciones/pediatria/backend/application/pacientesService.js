'use strict';
// Casos de uso: registro, búsqueda, datos administrativos, tutores y archivo.
const E = require('../domain/errors');
const R = require('../domain/reglas');
const { traza, limpiar } = require('./comun');

const CAMPOS_CLINICOS_LISTADO = ['total_consultas', 'ultima_consulta', 'dosis_pendientes'];

function crearPacientesService({ pacientes }, comun) {
  const { auditar, leerHistorial, cargarActivo, escribir, protegerTutores } = comun;

  const normalizarTutores = lista => lista.map(t => limpiar({ ...t, id_tutor: t.id_tutor || R.nuevoId('T') }));

  // Sin índice único sobre nombres+apellidos+nacimiento (no existe en la base
  // principal), buscar el duplicado y escribir no es atómico. Altas y ediciones
  // con la misma identidad destino se serializan en este servicio; no
  // cubre varias instancias simultáneas (docs/OPERACION_MONGODB.md §4).
  const identidadesEnCurso = new Map();
  async function enExclusion(clave, fn) {
    const actual = (identidadesEnCurso.get(clave) || Promise.resolve()).then(fn);
    const cola = actual.catch(() => {});
    identidadesEnCurso.set(clave, cola);
    try { return await actual; } finally { if (identidadesEnCurso.get(clave) === cola) identidadesEnCurso.delete(clave); }
  }
  // Misma comparación que buscarDuplicado: sin distinguir mayúsculas.
  const identidadDe = p => ({ nombres: p.nombres, apellidos: p.apellidos, fecha_nacimiento: p.fecha_nacimiento });
  const claveDuplicado = d => JSON.stringify([d.nombres.toLowerCase(), d.apellidos.toLowerCase(), d.fecha_nacimiento.toISOString()]);

  async function registrar(actor, datos) {
    R.noEnFuturo(datos.fecha_nacimiento, 'fecha_nacimiento');
    const tutores = normalizarTutores(datos.tutores);
    R.validarTutores(tutores);
    return enExclusion(claveDuplicado(datos), () => insertarSinDuplicar(actor, datos, tutores));
  }

  async function insertarSinDuplicar(actor, datos, tutores) {
    const existente = await pacientes.buscarDuplicado(datos);
    if (existente) {
      throw E.conflict(`Ya existe un paciente con los mismos nombres, apellidos y fecha de nacimiento (${existente.id_paciente})`);
    }
    // Con id automático se reintenta si otra petición tomó el mismo correlativo.
    for (let intento = 0; intento < 5; intento++) {
      const id_paciente = datos.id_paciente || await pacientes.siguienteId();
      const doc = {
        id_paciente, nombres: datos.nombres, apellidos: datos.apellidos,
        fecha_nacimiento: datos.fecha_nacimiento, sexo: datos.sexo, estado_historial: 'Activo',
        tutores, consultas: [], controles_crecimiento: [], esquema_vacunacion: [],
        fecha_registro: new Date(), registrado_por: traza(actor)
      };
      try {
        await escribir(actor, 'CREAR_PACIENTE', { id_paciente, recurso: 'pacientes', referencia: id_paciente },
          async () => { await pacientes.crear(doc); return true; });
        return { id_paciente };
      } catch (e) {
        if (datos.id_paciente || e.code !== 'CONFLICTO') {
          if (e.code === 'CONFLICTO') throw E.conflict(`Ya existe el paciente ${id_paciente}`);
          throw e;
        }
      }
    }
    throw E.conflict('No fue posible asignar un identificador; vuelva a intentarlo');
  }

  async function listar(actor, { q, estado, sexo, limite, pagina }) {
    if (estado !== 'Activo' && actor.rol !== 'administrador') {
      throw E.forbidden('Solo el administrador puede consultar historiales archivados');
    }
    const r = await pacientes.listar({ texto: q, estado, sexo, limite, saltar: (pagina - 1) * limite, buscarDpi: actor.rol !== 'medico' });
    if (actor.rol === 'secretaria') {
      for (const p of r.items) for (const c of CAMPOS_CLINICOS_LISTADO) delete p[c];
    }
    await auditar(actor, estado === 'Activo' ? 'LISTAR_PACIENTES' : 'LISTAR_ARCHIVADOS', { recurso: 'pacientes' });
    return { ...r, pagina, limite };
  }

  const obtener = (actor, id) => leerHistorial(actor, id, 'LEER_HISTORIAL');

  async function obtenerAdministrativo(actor, id) {
    const p = await pacientes.obtenerAdministrativo(id);
    if (!p) throw E.notFound('Paciente inexistente');
    if (p.estado_historial !== 'Activo' && actor.rol !== 'administrador') {
      throw E.forbidden('Historial archivado: solo el administrador puede consultarlo');
    }
    await auditar(actor, 'LEER_ADMINISTRATIVO', { id_paciente: id });
    return protegerTutores(p, actor);
  }

  async function actualizarDatos(actor, id, campos) {
    const p = await cargarActivo(id);
    if (campos.fecha_nacimiento) R.noEnFuturo(campos.fecha_nacimiento, 'fecha_nacimiento');
    const nacimiento = campos.fecha_nacimiento || p.fecha_nacimiento;
    const anterior = (p.controles_crecimiento || []).some(c => new Date(c.fecha) < nacimiento) ||
      (p.consultas || []).some(c => new Date(c.fecha_hora) < nacimiento);
    if (anterior) throw E.invalid('La fecha de nacimiento sería posterior a registros clínicos existentes');
    // Misma regla que programar/aplicar dosis (noAntesDeNacimiento), incluidas las canceladas.
    const vacunaAnterior = (p.esquema_vacunacion || []).some(d => new Date(d.fecha_programada) < nacimiento ||
      (d.fecha_aplicacion && new Date(d.fecha_aplicacion) < nacimiento));
    if (vacunaAnterior) throw E.invalid('La fecha de nacimiento sería posterior a registros de vacunación existentes');
    const previa = identidadDe(p);
    const destino = identidadDe({ ...p, ...campos });
    return enExclusion(claveDuplicado(destino), async () => {
      const existente = await pacientes.buscarDuplicado(destino, id);
      if (existente) throw E.conflict(`Ya existe un paciente con los mismos nombres, apellidos y fecha de nacimiento (${existente.id_paciente})`);
      await escribir(actor, 'ACTUALIZAR_PACIENTE', { id_paciente: id, recurso: 'pacientes', detalle: Object.keys(campos).join(',') },
        () => pacientes.actualizarDatos(id, { ...campos, ultima_actualizacion: traza(actor) }, previa),
        'El historial cambió durante la operación; recargue y vuelva a intentarlo');
      return { ok: true };
    });
  }

  async function guardarTutores(actor, id, previos, nuevos, accion, referencia) {
    R.validarTutores(nuevos);
    await escribir(actor, accion, { id_paciente: id, recurso: 'tutores', referencia },
      () => pacientes.reemplazarTutores(id, previos, nuevos, traza(actor)),
      'Los tutores fueron modificados por otra operación; recargue y vuelva a intentarlo');
  }

  async function reemplazarTutores(actor, id, lista) {
    const p = await cargarActivo(id);
    await guardarTutores(actor, id, p.tutores || [], normalizarTutores(lista), 'ACTUALIZAR_TUTORES', null);
    return { ok: true };
  }

  // Si el nuevo tutor es principal, el anterior deja de serlo.
  async function agregarTutor(actor, id, tutor) {
    const p = await cargarActivo(id);
    const [nuevo] = normalizarTutores([tutor]);
    const previos = p.tutores || [];
    const lista = [...previos.map(t => (nuevo.es_principal ? { ...t, es_principal: false } : t)), nuevo];
    if (lista.length > 10) throw E.invalid('Máximo 10 tutores por paciente');
    await guardarTutores(actor, id, previos, lista, 'AGREGAR_TUTOR', nuevo.id_tutor);
    return { id_tutor: nuevo.id_tutor };
  }

  async function actualizarTutor(actor, id, idTutor, campos) {
    const p = await cargarActivo(id);
    const previos = p.tutores || [];
    if (!previos.some(t => t.id_tutor === idTutor)) throw E.notFound('Tutor inexistente en el paciente');
    const lista = previos.map(t => {
      if (t.id_tutor === idTutor) return limpiar({ ...t, ...campos });
      return campos.es_principal ? { ...t, es_principal: false } : t;
    });
    await guardarTutores(actor, id, previos, lista, 'ACTUALIZAR_TUTOR', idTutor);
    return { ok: true };
  }

  async function archivar(actor, id, { motivo_archivado }) {
    await cargarActivo(id);
    await escribir(actor, 'ARCHIVAR_HISTORIAL', { id_paciente: id, recurso: 'pacientes', detalle: motivo_archivado },
      () => pacientes.archivar(id, { fecha_archivado: new Date(), motivo_archivado, archivado_por: traza(actor) }),
      'El historial ya fue archivado');
    return { ok: true };
  }

  return {
    registrar, listar, obtener, obtenerAdministrativo, actualizarDatos,
    reemplazarTutores, agregarTutor, actualizarTutor, archivar
  };
}

module.exports = { crearPacientesService };
