'use strict';
// Integración REAL del adaptador MongoDB sobre una instancia mongod desechable
// (tests/soporte/mongodTemporal.js). Nunca se conecta a centro_pediatrico_db.
// Se omite si no hay binario mongod (variable MONGOD_BIN o instalación estándar).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const { iniciarMongodTemporal, binarioMongod } = require('./soporte/mongodTemporal');
const INSTALADO = require('./soporte/validadorInstalado');
const { crearRepositoriosMongo, asegurarIndices, detectarCapacidades } = require('../backend/adapters/mongo');
const A = require('../backend/adapters/mongo/administracionValidadores');
const { crearServicios } = require('../backend/application');

const omitir = binarioMongod() ? false : 'sin binario mongod (defina MONGOD_BIN) para la base de pruebas desechable';
const BASE = 'centro_pediatrico_test';
const SEC = { id: 'INT-SEC', rol: 'secretaria' };
const MED = { id: 'INT-MED', rol: 'medico' };
const ADM = { id: 'INT-ADM', rol: 'administrador' };
const fechaD = s => new Date(s);
const consultaBase = (extra = {}) => ({
  id_medico: 'M001', fecha_hora: fechaD('2026-01-10T10:00:00Z'), motivo: 'Control ficticio',
  diagnosticos: [], prescripciones: [], ...extra
});
const pacienteNuevo = nombre => ({
  nombres: nombre, apellidos: 'Integración', fecha_nacimiento: fechaD('2023-01-01T00:00:00Z'), sexo: 'F',
  tutores: [{ dpi: '1234567890101', nombres: 'Tutora', apellidos: 'Prueba', parentesco: 'Madre', es_principal: true }]
});

// Datos con la forma exacta de los documentos existentes (registrados desde mongosh, sin trazas Fase II).
async function sembrar(db, { validadorPacientes }) {
  await db.createCollection('pacientes', { validator: { $jsonSchema: validadorPacientes }, validationLevel: 'strict', validationAction: 'error' });
  for (const c of ['medicos', 'vacunas', 'bitacora_acceso']) await db.createCollection(c);
  await asegurarIndices(db);
  await db.collection('medicos').insertOne({ id_medico: 'M001', colegiado: 'COL-T1', nombres: 'Médica', apellidos: 'Ficticia', especialidad: { id_especialidad: 'E001', nombre: 'Pediatría General' } });
  await db.collection('vacunas').insertOne({ id_vacuna: 'V001', nombre: 'Vacuna ficticia', descripcion: 'Solo pruebas' });
  await db.collection('bitacora_acceso').insertOne({ id_evento: 'AUD001', id_usuario: 'USR001', id_paciente: 'P001', accion: 'REGISTRAR_CONSULTA', recurso: 'consultas', referencia: 'C001', fecha_hora: new Date(), resultado: 'EXITOSO', descripcion: 'Registro académico' });
  await db.collection('pacientes').insertOne({
    id_paciente: 'P001', nombres: 'Heredado', apellidos: 'Mongosh', fecha_nacimiento: fechaD('2020-05-12T00:00:00Z'), sexo: 'M', estado_historial: 'Activo',
    tutores: [{ id_tutor: 'T001', dpi: '1000000000001', nombres: 'María', apellidos: 'Ficticia', telefono: '5555-1001', correo: 'm@example.com', direccion: 'Ciudad', parentesco: 'Madre', es_principal: true }],
    consultas: [{
      id_consulta: 'C001', id_medico: 'M001', fecha_hora: fechaD('2026-01-05T15:00:00Z'), motivo: 'Control', observaciones: 'Ficticio',
      diagnosticos: [{ codigo: 'Z00.1', descripcion: 'Examen de rutina' }],
      tratamiento: { descripcion: 'Seguimiento', recomendaciones: 'Controles' },
      prescripciones: [{ id_prescripcion: 'RX001', fecha_emision: fechaD('2026-01-05T15:30:00Z'), indicaciones_generales: 'Demo',
        medicamentos: [{ id_medicamento: 'MED001', nombre: 'Ficticio A', dosis: 'N/A', frecuencia: 'N/A', duracion: 'N/A', via_administracion: 'N/A' }] }]
    }],
    controles_crecimiento: [{ id_control: 'CR001', id_consulta: 'C001', fecha: fechaD('2026-01-05T15:00:00Z'), peso_kg: 20.5, talla_cm: 114, perimetro_cefalico_cm: 51 }],
    esquema_vacunacion: [
      { id_esquema: 'EV001', id_vacuna: 'V001', numero_dosis: 1, fecha_programada: fechaD('2026-01-10T00:00:00Z'), fecha_aplicacion: fechaD('2026-01-10T16:00:00Z'), estado: 'Aplicada', lote: 'L-1', id_medico: 'M001' }
    ]
  });
}

describe('MongoDB standalone (configuración actual): validadores, outbox de auditoría y operaciones', { skip: omitir }, () => {
  let mongo, client, db, S;
  const servicios = () => crearServicios(crearRepositoriosMongo(client, db));
  before(async () => {
    mongo = await iniciarMongodTemporal();
    client = new MongoClient(mongo.uri);
    await client.connect();
    db = client.db(BASE);
    await sembrar(db, { validadorPacientes: INSTALADO.pacientes });
    S = servicios();
  });
  after(async () => { await client?.close(); await mongo?.detener(); });

  test('sin transacciones disponibles; con el validador actual el perímetro sigue siendo obligatorio', async () => {
    assert.equal(await S.comun.capacidades().then(c => c.perimetro_cefalico_opcional), false);
    const { id_paciente } = await S.pacientes.registrar(SEC, pacienteNuevo('Validador'));
    const { id_consulta } = await S.consultas.registrar(MED, id_paciente, consultaBase());
    await assert.rejects(S.crecimiento.registrar(MED, id_paciente, { id_consulta, peso_kg: 10, talla_cm: 80 }),
      e => e.status === 400 && /validador/.test(e.message));
    assert.equal(await crearRepositoriosMongo(client, db).unidad.soportaTransacciones(), false);
  });

  test('validadores Fase II: verificación, respaldo, aplicación y reversión sin tocar documentos', async () => {
    const antes = await db.collection('pacientes').find({}).toArray();
    const v = await A.verificar(db);
    assert.ok(Object.values(v).every(x => x.incumplen.length === 0), JSON.stringify(v));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'respaldo-validadores-'));
    try {
      const r = await A.respaldar(db, dir);
      assert.equal(r.conteos.pacientes, antes.length);
      await A.aplicar(db);
      assert.equal((await detectarCapacidades(db)).perimetro_cefalico_opcional, true);
      assert.ok((await A.estado(db)).medicos.validator, 'medicos debe quedar con validador');
      await A.revertir(db, A.leerRespaldo(dir));
      const tras = await A.estado(db);
      assert.deepEqual(tras.pacientes.validator, { $jsonSchema: INSTALADO.pacientes });
      assert.equal(tras.medicos.validator, null);
      assert.deepEqual(await db.collection('pacientes').find({}).toArray(), antes, 'collMod no debe alterar documentos');
      await A.aplicar(db); // el resto de las pruebas usa los validadores de Fase II
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('el validador de Fase II rechaza escrituras directas que no pasan por la API', async () => {
    await assert.rejects(db.collection('pacientes').insertOne({ id_paciente: 'X1', nombres: 'A', apellidos: 'B', fecha_nacimiento: new Date(), sexo: 'X', estado_historial: 'Activo', tutores: [], consultas: [], controles_crecimiento: [], esquema_vacunacion: [] }), { code: 121 });
    await assert.rejects(db.collection('medicos').insertOne({ id_medico: 'M$', colegiado: 'C', nombres: 'N', apellidos: 'A', especialidad: { id_especialidad: 'E', nombre: 'N' } }), { code: 121 });
    await assert.rejects(db.collection('pacientes').updateOne({ id_paciente: 'P001' }, { $push: { controles_crecimiento: { id_control: 'CRX', id_consulta: 'C001', fecha: new Date(), peso_kg: -1, talla_cm: 80 } } }), { code: 121 });
  });

  test('flujo clínico completo; perímetro opcional; registros heredados compatibles', async () => {
    S = servicios(); // capacidades recién leídas: validador de Fase II instalado
    const { id_paciente } = await S.pacientes.registrar(SEC, pacienteNuevo('Flujo'));
    const { id_consulta, id_control } = await S.consultas.registrar(MED, id_paciente, consultaBase({
      diagnosticos: [{ codigo: 'DX1', descripcion: 'Ficticio' }],
      tratamiento: { descripcion: 'Seguimiento ficticio' },
      prescripciones: [{ medicamentos: [{ nombre: 'Ficticio', dosis: 'N/A', frecuencia: 'N/A', duracion: 'N/A', via_administracion: 'N/A' }] }],
      control_crecimiento: { peso_kg: 10.2, talla_cm: 80 }
    }));
    await S.crecimiento.registrar(MED, id_paciente, { id_consulta, peso_kg: 10.5, talla_cm: 81, perimetro_cefalico_cm: 46 });
    await S.consultas.agregarDiagnostico(MED, id_paciente, id_consulta, { codigo: 'DX2', descripcion: 'Otro' });
    await S.consultas.agregarPrescripcion(MED, id_paciente, id_consulta, { medicamentos: [{ nombre: 'B', dosis: 'N/A', frecuencia: 'N/A', duracion: 'N/A', via_administracion: 'N/A' }] });
    // Tratamiento: la versión anterior se conserva.
    await S.consultas.establecerTratamiento(MED, id_paciente, id_consulta, { descripcion: 'Segunda versión' });
    const { id_esquema } = await S.vacunacion.programar(MED, id_paciente, { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: fechaD('2026-02-01T00:00:00Z') });
    await assert.rejects(S.vacunacion.programar(MED, id_paciente, { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: fechaD('2026-03-01T00:00:00Z') }), { status: 409 });
    const aplicar = { fecha_aplicacion: fechaD('2026-02-01T09:00:00Z'), lote: 'L-9', id_medico: 'M001' };
    const r = await Promise.allSettled([S.vacunacion.aplicar(MED, id_paciente, id_esquema, aplicar), S.vacunacion.aplicar(MED, id_paciente, id_esquema, aplicar)]);
    assert.deepEqual(r.map(x => x.status).sort(), ['fulfilled', 'rejected'], 'una dosis no puede aplicarse dos veces');
    await assert.rejects(S.consultas.registrar(MED, id_paciente, consultaBase({ id_medico: 'M999' })), { status: 422 });

    const p = await db.collection('pacientes').findOne({ id_paciente });
    const c = p.consultas[0];
    assert.equal(c.diagnosticos.length, 2);
    assert.equal(c.prescripciones.length, 2);
    assert.equal(c.tratamiento.descripcion, 'Segunda versión');
    assert.equal(c.tratamientos_anteriores[0].descripcion, 'Seguimiento ficticio');
    assert.equal(c.tratamientos_anteriores[0].reemplazado_por.id_usuario, 'INT-MED');
    const sinPerimetro = p.controles_crecimiento.find(x => x.id_control === id_control);
    assert.equal('perimetro_cefalico_cm' in sinPerimetro, false);
    assert.equal(p.esquema_vacunacion[0].estado, 'Aplicada');
    assert.ok(p.fecha_registro instanceof Date && c.fecha_hora instanceof Date);

    // Paciente heredado (P001, creado desde mongosh) admite nuevas operaciones con el validador nuevo.
    const heredada = await S.consultas.registrar(MED, 'P001', consultaBase({ fecha_hora: fechaD('2026-02-02T10:00:00Z') }));
    assert.ok(heredada.id_consulta);
    const h = await S.crecimiento.historial(MED, id_paciente);
    assert.deepEqual(h.map(x => x.peso_kg), [10.2, 10.5]);
    assert.equal(h[0].perimetro_cefalico_cm, undefined);
  });

  test('auditoría atómica sin transacciones: cada escritura deja su evento y ninguno queda pendiente', async () => {
    const pendientes = await db.collection('pacientes').countDocuments({ 'bitacora_pendiente.0': { $exists: true } });
    assert.equal(pendientes, 0);
    const eventos = await db.collection('bitacora_acceso').find({ id_evento: { $type: 'string' }, accion: { $in: ['REGISTRAR_CONSULTA', 'APLICAR_VACUNA', 'ACTUALIZAR_TRATAMIENTO'] } }).toArray();
    assert.ok(eventos.length >= 4);
    assert.equal(new Set(eventos.map(e => e.id_evento)).size, eventos.length, 'sin duplicados');
    // El intento de doble aplicación rechazado no deja evento de éxito.
    assert.equal(await db.collection('bitacora_acceso').countDocuments({ accion: 'APLICAR_VACUNA' }), 1);
  });

  test('si bitacora_acceso falla, la escritura clínica conserva su evento y se entrega después (sin pérdidas ni duplicados)', async () => {
    const { id_paciente } = await S.pacientes.registrar(SEC, pacienteNuevo('Outbox'));
    // Simula la caída de la bitácora: un validador que rechaza toda inserción.
    await db.command({ collMod: 'bitacora_acceso', validator: { $jsonSchema: { required: ['campo_inexistente'] } } });
    const errorOriginal = console.error; console.error = () => {};
    try {
      const { id_consulta } = await S.consultas.registrar(MED, id_paciente, consultaBase({ motivo: 'Con bitácora caída' }));
      const p = await db.collection('pacientes').findOne({ id_paciente });
      assert.ok(p.consultas.some(c => c.id_consulta === id_consulta), 'la consulta se guardó');
      assert.equal(p.bitacora_pendiente.length, 1, 'su evento quedó en el mismo documento');
      assert.equal(p.bitacora_pendiente[0].accion, 'REGISTRAR_CONSULTA');
      // La API nunca devuelve la bandeja interna.
      assert.equal((await S.pacientes.obtener(MED, id_paciente)).bitacora_pendiente, undefined);
    } finally {
      console.error = errorOriginal;
      await db.command({ collMod: 'bitacora_acceso', validator: { $jsonSchema: require('../backend/adapters/mongo/validadores').VALIDADORES.bitacora_acceso } });
    }
    const unidad = crearRepositoriosMongo(client, db).unidad;
    assert.equal(await unidad.reenviarPendientes(), 1);
    assert.equal(await unidad.reenviarPendientes(), 0);
    assert.equal(await db.collection('bitacora_acceso').countDocuments({ id_paciente, accion: 'REGISTRAR_CONSULTA' }), 1);
    assert.equal((await db.collection('pacientes').findOne({ id_paciente })).bitacora_pendiente.length, 0);
  });

  test('archivado: solo lectura y DPI enmascarado para el médico', async () => {
    const { id_paciente } = await S.pacientes.registrar(SEC, pacienteNuevo('Archivo'));
    assert.equal((await S.pacientes.obtener(MED, id_paciente)).tutores[0].dpi, '•••••••••0101');
    assert.equal((await S.pacientes.obtenerAdministrativo(SEC, id_paciente)).tutores[0].dpi, '1234567890101');
    await S.vacunacion.programar(MED, id_paciente, { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: fechaD('2026-02-01T00:00:00Z') });
    const antes = await S.panel.resumen(ADM);
    await S.pacientes.archivar(ADM, id_paciente, { motivo_archivado: 'Traslado a otra institución' });
    // El contador del panel usa el mismo criterio que la lista de pendientes: solo historiales activos.
    const despues = await S.panel.resumen(ADM);
    assert.equal(despues.dosis_pendientes, antes.dosis_pendientes - 1);
    assert.equal(despues.dosis_pendientes, (await S.vacunacion.pendientes(ADM, { limite: 100 })).length);
    await assert.rejects(S.consultas.registrar(MED, id_paciente, consultaBase()), { status: 409 });
    await assert.rejects(S.pacientes.obtener(MED, id_paciente), { status: 403 });
    const p = await S.pacientes.obtener(ADM, id_paciente);
    assert.equal(p.estado_historial, 'Archivado');
    assert.ok(p.fecha_archivado instanceof Date);
    const resumen = await S.panel.resumen(ADM);
    assert.equal(resumen.pacientes_archivados, 1);
  });

  test('altas concurrentes con los mismos datos crean un solo paciente', async () => {
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => S.pacientes.registrar(SEC, pacienteNuevo('Concurrente'))));
    assert.deepEqual(r.map(x => x.status).sort(), ['fulfilled', 'rejected', 'rejected', 'rejected', 'rejected']);
    assert.equal(await db.collection('pacientes').countDocuments({ nombres: 'Concurrente', apellidos: 'Integración' }), 1);
  });

  test('la fecha de nacimiento no puede quedar después de la vacunación registrada, ni con una carrera', async () => {
    const { id_paciente } = await S.pacientes.registrar(SEC, pacienteNuevo('Nacimiento'));
    await S.vacunacion.programar(MED, id_paciente, { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: fechaD('2024-02-01T00:00:00Z') });
    await assert.rejects(S.pacientes.actualizarDatos(SEC, id_paciente, { fecha_nacimiento: fechaD('2024-03-01T00:00:00Z') }), { status: 400 });
    // Aunque la verificación previa leyera un historial anterior, el filtro del updateOne lo impide.
    const repo = crearRepositoriosMongo(client, db).pacientes;
    assert.equal(await repo.actualizarDatos(id_paciente, { fecha_nacimiento: fechaD('2024-03-01T00:00:00Z') }), false);
    assert.equal(await repo.actualizarDatos(id_paciente, { fecha_nacimiento: fechaD('2022-12-01T00:00:00Z') }), true);
  });
});

describe('MongoDB replica set (plan de migración): transacciones reales', { skip: omitir }, () => {
  let mongo, client, db, S;
  before(async () => {
    mongo = await iniciarMongodTemporal({ replicaSet: true });
    client = new MongoClient(mongo.uri);
    await client.connect();
    db = client.db(BASE);
    await sembrar(db, { validadorPacientes: require('../backend/adapters/mongo/validadores').VALIDADORES.pacientes });
    S = crearServicios(crearRepositoriosMongo(client, db));
  });
  after(async () => { await client?.close(); await mongo?.detener(); });

  test('escritura clínica y bitácora se confirman juntas en una transacción', async () => {
    assert.equal(await crearRepositoriosMongo(client, db).unidad.soportaTransacciones(), true);
    const { id_paciente } = await S.pacientes.registrar(SEC, pacienteNuevo('Transaccion'));
    await S.consultas.registrar(MED, id_paciente, consultaBase());
    const p = await db.collection('pacientes').findOne({ id_paciente });
    assert.equal(p.bitacora_pendiente, undefined, 'con transacciones no se usa la bandeja embebida');
    assert.equal(await db.collection('bitacora_acceso').countDocuments({ id_paciente, accion: 'REGISTRAR_CONSULTA' }), 1);
  });

  test('si la bitácora falla, la transacción revierte también la escritura clínica', async () => {
    const { id_paciente } = await S.pacientes.registrar(SEC, pacienteNuevo('Revierte'));
    await db.command({ collMod: 'bitacora_acceso', validator: { $jsonSchema: { required: ['campo_inexistente'] } } });
    try {
      await assert.rejects(S.consultas.registrar(MED, id_paciente, consultaBase({ motivo: 'No debe quedar' })));
    } finally {
      await db.command({ collMod: 'bitacora_acceso', validator: {} });
    }
    const p = await db.collection('pacientes').findOne({ id_paciente });
    assert.equal(p.consultas.length, 0, 'sin bitácora no hay escritura clínica');
  });

  test('las altas de médicos y vacunas se confirman o revierten junto con su evento', async () => {
    const medico = { id_medico: 'M020', colegiado: 'COL-T20', nombres: 'Médico', apellidos: 'Transaccional', especialidad: { id_especialidad: 'E001', nombre: 'Pediatría General' } };
    const vacuna = { id_vacuna: 'V020', nombre: 'Vacuna transaccional', descripcion: 'Solo pruebas' };
    await db.command({ collMod: 'bitacora_acceso', validator: { $jsonSchema: { required: ['campo_inexistente'] } } });
    try {
      await assert.rejects(S.catalogos.crearMedico(ADM, medico));
      await assert.rejects(S.catalogos.crearVacuna(ADM, vacuna));
    } finally {
      await db.command({ collMod: 'bitacora_acceso', validator: {} });
    }
    assert.equal(await db.collection('medicos').countDocuments({ id_medico: 'M020' }), 0, 'sin evento no queda el médico');
    assert.equal(await db.collection('vacunas').countDocuments({ id_vacuna: 'V020' }), 0, 'sin evento no queda la vacuna');
    await S.catalogos.crearMedico(ADM, medico);
    assert.equal(await db.collection('bitacora_acceso').countDocuments({ accion: 'CREAR_MEDICO', referencia: 'M020' }), 1);
  });
});
