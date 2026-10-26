'use strict';
// Adaptadores MongoDB de los puertos definidos en src/ports.
// Toda mutación sobre un historial es un único updateOne con filtro
// condicional: la condición y el cambio se evalúan atómicamente en el
// documento del paciente, sin ventanas de carrera entre lectura y escritura.
const { DomainError, conflict } = require('../../domain/errors');
const { opcionesSesion: ses, tomarEventoPendiente } = require('./unidadDeTrabajo');

const SIN_ID = { _id: 0 };
// La bandeja de auditoría pendiente (outbox) es interna: nunca se devuelve.
const HISTORIAL = { _id: 0, bitacora_pendiente: 0 };
const ACTIVO = 'Activo';
const escaparRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function traducir(err) {
  if (err?.code === 11000) return conflict('Identificador duplicado');
  if (err?.code === 121) {
    return new DomainError('Documento rechazado por el validador $jsonSchema de MongoDB', 422, 'VALIDACION_MONGODB');
  }
  return err;
}
const seguro = fn => async (...args) => {
  try { return await fn(...args); } catch (e) { throw traducir(e); }
};
const aplicado = r => r.modifiedCount === 1;

// Sin transacciones, el evento de auditoría viaja en la MISMA operación atómica
// que el cambio clínico (ver unidadDeTrabajo.js). Con transacciones no se embebe.
function conEvento(update) {
  const evento = tomarEventoPendiente();
  if (!evento) return update;
  return { ...update, $push: { ...(update.$push || {}), bitacora_pendiente: evento } };
}

function crearPacienteRepository(db) {
  const col = db.collection('pacientes');
  const activo = (id, extra = {}) => ({ id_paciente: id, estado_historial: ACTIVO, ...extra });
  const tamano = campo => ({ $size: { $ifNull: [`$${campo}`, []] } });
  const pendientes = {
    $size: {
      $filter: { input: { $ifNull: ['$esquema_vacunacion', []] }, cond: { $eq: ['$$this.estado', 'Pendiente'] } }
    }
  };

  return {
    crear: seguro(async p => {
      const evento = tomarEventoPendiente();
      await col.insertOne(evento ? { ...p, bitacora_pendiente: [evento] } : { ...p }, ses());
    }),

    async siguienteId() {
      const [ultimo] = await col.aggregate([
        { $match: { id_paciente: { $regex: '^P[0-9]+$' } } },
        { $project: { n: { $toInt: { $substrCP: ['$id_paciente', 1, 18] } } } },
        { $sort: { n: -1 } }, { $limit: 1 }
      ], ses()).toArray();
      return `P${String((ultimo?.n || 0) + 1).padStart(3, '0')}`;
    },

    buscarDuplicado: ({ nombres, apellidos, fecha_nacimiento }) => col.findOne({
      nombres: { $regex: `^${escaparRegex(nombres)}$`, $options: 'i' },
      apellidos: { $regex: `^${escaparRegex(apellidos)}$`, $options: 'i' },
      fecha_nacimiento
    }, ses({ projection: { _id: 0, id_paciente: 1, estado_historial: 1 } })),

    async listar({ texto, estado, sexo, limite = 25, saltar = 0, buscarDpi = true }) {
      const filtro = {};
      if (estado && estado !== 'Todos') filtro.estado_historial = estado;
      if (sexo) filtro.sexo = sexo;
      if (texto) {
        const re = { $regex: escaparRegex(texto), $options: 'i' };
        filtro.$or = [{ id_paciente: re }, { nombres: re }, { apellidos: re },
          { 'tutores.nombres': re }, { 'tutores.apellidos': re }];
        // DPI (dato restringido): coincidencia exacta y solo para roles administrativos.
        if (buscarDpi) filtro.$or.push({ 'tutores.dpi': texto });
      }
      const projection = {
        _id: 0, id_paciente: 1, nombres: 1, apellidos: 1, fecha_nacimiento: 1, sexo: 1,
        estado_historial: 1, fecha_archivado: 1, motivo_archivado: 1, fecha_registro: 1,
        tutor_principal: {
          $first: { $filter: { input: { $ifNull: ['$tutores', []] }, cond: { $eq: ['$$this.es_principal', true] } } }
        },
        total_consultas: tamano('consultas'),
        ultima_consulta: { $max: '$consultas.fecha_hora' },
        dosis_pendientes: pendientes
      };
      const [items, total] = await Promise.all([
        col.find(filtro, ses({ projection })).sort({ apellidos: 1, nombres: 1, id_paciente: 1 })
          .skip(saltar).limit(limite).toArray(),
        col.countDocuments(filtro, ses())
      ]);
      for (const p of items) {
        if (p.tutor_principal) {
          const { nombres, apellidos, telefono, parentesco } = p.tutor_principal;
          p.tutor_principal = { nombres, apellidos, telefono, parentesco };
        }
      }
      return { items, total };
    },

    obtener: id => col.findOne({ id_paciente: id }, ses({ projection: HISTORIAL })),

    obtenerAdministrativo: id => col.findOne({ id_paciente: id }, ses({
      projection: {
        _id: 0, id_paciente: 1, nombres: 1, apellidos: 1, fecha_nacimiento: 1, sexo: 1,
        estado_historial: 1, tutores: 1, fecha_registro: 1, fecha_archivado: 1, motivo_archivado: 1
      }
    })),

    // Una nueva fecha de nacimiento no puede quedar después de ningún registro fechado
    // del historial; la condición va en el filtro para que no la adelante otra escritura.
    actualizarDatos: seguro(async (id, campos) => {
      const n = campos.fecha_nacimiento;
      const sinAnteriores = n ? Object.fromEntries(['consultas.fecha_hora', 'controles_crecimiento.fecha',
        'esquema_vacunacion.fecha_programada', 'esquema_vacunacion.fecha_aplicacion'].map(c => [c, { $not: { $lt: n } }])) : {};
      return aplicado(await col.updateOne(activo(id, sinAnteriores), conEvento({ $set: campos }), ses()));
    }),

    // Concurrencia optimista: solo reemplaza si los tutores no cambiaron desde la lectura.
    reemplazarTutores: seguro(async (id, previos, nuevos, traza) =>
      aplicado(await col.updateOne(activo(id, { tutores: previos }), conEvento({ $set: { tutores: nuevos, ultima_actualizacion: traza } }), ses()))),

    agregarConsulta: seguro(async (id, consulta, control) => {
      const filtro = activo(id, { 'consultas.id_consulta': { $ne: consulta.id_consulta } });
      const push = { consultas: consulta };
      if (control) {
        filtro['controles_crecimiento.id_control'] = { $ne: control.id_control };
        push.controles_crecimiento = control;
      }
      return aplicado(await col.updateOne(filtro, conEvento({ $push: push }), ses()));
    }),

    agregarDiagnostico: seguro(async (id, idConsulta, d) => aplicado(await col.updateOne(
      activo(id, { consultas: { $elemMatch: { id_consulta: idConsulta, 'diagnosticos.codigo': { $ne: d.codigo } } } }), conEvento({ $push: { 'consultas.$.diagnosticos': d } }), ses()))),

    // El tratamiento vigente se reemplaza solo si no cambió desde la lectura
    // (concurrencia optimista) y la versión anterior se conserva en el historial.
    establecerTratamiento: seguro(async (id, idConsulta, t, previo, reemplazo) => {
      const update = { $set: { 'consultas.$.tratamiento': t } };
      if (previo) update.$push = { 'consultas.$.tratamientos_anteriores': { ...previo, ...reemplazo } };
      return aplicado(await col.updateOne(
        activo(id, { consultas: { $elemMatch: { id_consulta: idConsulta, tratamiento: previo ?? null } } }),
        conEvento(update), ses()));
    }),

    agregarPrescripcion: seguro(async (id, idConsulta, rx) => aplicado(await col.updateOne(
      activo(id, {
        consultas: { $elemMatch: { id_consulta: idConsulta, 'prescripciones.id_prescripcion': { $ne: rx.id_prescripcion } } }
      }), conEvento({ $push: { 'consultas.$.prescripciones': rx } }), ses()))),

    agregarControl: seguro(async (id, c) => aplicado(await col.updateOne(
      activo(id, { 'consultas.id_consulta': c.id_consulta, 'controles_crecimiento.id_control': { $ne: c.id_control } }), conEvento({ $push: { controles_crecimiento: c } }), ses()))),

    programarDosis: seguro(async (id, d) => aplicado(await col.updateOne(
      activo(id, {
        'esquema_vacunacion.id_esquema': { $ne: d.id_esquema },
        esquema_vacunacion: {
          $not: { $elemMatch: { id_vacuna: d.id_vacuna, numero_dosis: d.numero_dosis, estado: { $ne: 'Cancelada' } } }
        }
      }), conEvento({ $push: { esquema_vacunacion: d } }), ses()))),

    // El filtro estado:'Pendiente' impide la doble aplicación aunque lleguen dos peticiones a la vez.
    aplicarDosis: seguro(async (id, idEsquema, x) => aplicado(await col.updateOne(
      activo(id, { esquema_vacunacion: { $elemMatch: { id_esquema: idEsquema, estado: 'Pendiente' } } }), conEvento({
        $set: {
          'esquema_vacunacion.$.estado': 'Aplicada',
          'esquema_vacunacion.$.fecha_aplicacion': x.fecha_aplicacion,
          'esquema_vacunacion.$.lote': x.lote,
          'esquema_vacunacion.$.id_medico': x.id_medico,
          'esquema_vacunacion.$.aplicado_por': x.aplicado_por
        }
      }), ses()))),

    cancelarDosis: seguro(async (id, idEsquema, x) => aplicado(await col.updateOne(
      activo(id, { esquema_vacunacion: { $elemMatch: { id_esquema: idEsquema, estado: 'Pendiente' } } }), conEvento({
        $set: {
          'esquema_vacunacion.$.estado': 'Cancelada',
          'esquema_vacunacion.$.motivo_cancelacion': x.motivo_cancelacion,
          'esquema_vacunacion.$.cancelado_por': x.cancelado_por
        }
      }), ses()))),

    archivar: seguro(async (id, x) => aplicado(await col.updateOne(activo(id), conEvento({
      $set: { estado_historial: 'Archivado', ...x }
    }), ses()))),

    async resumen() {
      const suma = cond => ({ $sum: { $cond: [cond, 1, 0] } });
      const contar = estado => ({
        $sum: {
          $size: {
            $filter: { input: { $ifNull: ['$esquema_vacunacion', []] }, cond: { $eq: ['$$this.estado', estado] } }
          }
        }
      });
      const [totales = {}] = await col.aggregate([{
        $group: {
          _id: null,
          pacientes_activos: suma({ $eq: ['$estado_historial', ACTIVO] }),
          pacientes_archivados: suma({ $eq: ['$estado_historial', 'Archivado'] }),
          consultas: { $sum: tamano('consultas') },
          controles_crecimiento: { $sum: tamano('controles_crecimiento') },
          // Solo historiales activos: coincide con /vacunacion/pendientes (un archivado no admite aplicar dosis).
          dosis_pendientes: { $sum: { $cond: [{ $eq: ['$estado_historial', ACTIVO] }, contar('Pendiente').$sum, 0] } },
          dosis_aplicadas: contar('Aplicada')
        }
      }, { $project: { _id: 0 } }], ses()).toArray();
      const consultas_recientes = await col.aggregate([
        { $match: { estado_historial: ACTIVO } },
        { $unwind: '$consultas' },
        { $sort: { 'consultas.fecha_hora': -1 } },
        { $limit: 6 },
        {
          $project: {
            _id: 0, id_paciente: 1, nombres: 1, apellidos: 1,
            id_consulta: '$consultas.id_consulta', fecha_hora: '$consultas.fecha_hora',
            motivo: '$consultas.motivo', id_medico: '$consultas.id_medico'
          }
        }
      ], ses()).toArray();
      return {
        pacientes_activos: 0, pacientes_archivados: 0, consultas: 0, controles_crecimiento: 0,
        dosis_pendientes: 0, dosis_aplicadas: 0, ...totales, consultas_recientes
      };
    },

    dosisPendientes: ({ limite = 20 } = {}) => col.aggregate([
      { $match: { estado_historial: ACTIVO, 'esquema_vacunacion.estado': 'Pendiente' } },
      { $unwind: '$esquema_vacunacion' },
      { $match: { 'esquema_vacunacion.estado': 'Pendiente' } },
      { $sort: { 'esquema_vacunacion.fecha_programada': 1 } },
      { $limit: limite },
      {
        $project: {
          _id: 0, id_paciente: 1, nombres: 1, apellidos: 1,
          id_esquema: '$esquema_vacunacion.id_esquema', id_vacuna: '$esquema_vacunacion.id_vacuna',
          numero_dosis: '$esquema_vacunacion.numero_dosis', fecha_programada: '$esquema_vacunacion.fecha_programada'
        }
      }
    ], ses()).toArray()
  };
}

function crearMedicoRepository(db) {
  const col = db.collection('medicos');
  return {
    listar: ({ especialidad } = {}) => col.find(especialidad ? { 'especialidad.nombre': especialidad } : {},
      ses({ projection: SIN_ID })).sort({ id_medico: 1 }).toArray(),
    obtener: id => col.findOne({ id_medico: id }, ses({ projection: SIN_ID })),
    crear: seguro(async m => { await col.insertOne({ ...m }, ses()); })
  };
}

function crearVacunaRepository(db) {
  const col = db.collection('vacunas');
  return {
    listar: () => col.find({}, ses({ projection: SIN_ID })).sort({ id_vacuna: 1 }).toArray(),
    obtener: id => col.findOne({ id_vacuna: id }, ses({ projection: SIN_ID })),
    crear: seguro(async v => { await col.insertOne({ ...v }, ses()); })
  };
}

function crearAuditoriaRepository(db) {
  const col = db.collection('bitacora_acceso');
  return {
    registrar: async evento => { await col.insertOne({ ...evento }, ses()); },
    listar: ({ id_paciente, accion, limite = 100 } = {}) => {
      const filtro = {};
      if (id_paciente) filtro.id_paciente = id_paciente;
      if (accion) filtro.accion = accion;
      return col.find(filtro, ses({ projection: SIN_ID })).sort({ fecha_hora: -1 }).limit(limite).toArray();
    }
  };
}

module.exports = {
  crearPacienteRepository, crearMedicoRepository, crearVacunaRepository, crearAuditoriaRepository
};
