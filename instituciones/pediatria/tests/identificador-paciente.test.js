'use strict';
// Regresión del defecto D-01 (docs/AUDITORIA_PEDIATRIA_2026-10-31.md): un id_paciente
// manual con muchos dígitos desbordaba $toInt en siguienteId y bloqueaba con 500
// todas las altas automáticas posteriores. Se prueba la API sobre el doble en memoria
// y el adaptador MongoDB sobre un mongod DESECHABLE (nunca centro_pediatrico_db).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { iniciar } = require('./helpers');
const { crearRepositoriosMemoria } = require('./doubles/memoria');
const { iniciarMongodTemporal, binarioMongod } = require('./soporte/mongodTemporal');
const { crearRepositoriosMongo, asegurarIndices } = require('../backend/adapters/mongo');
const A = require('../backend/adapters/mongo/administracionValidadores');
const { crearServicios } = require('../backend/application');

const omitir = binarioMongod() ? false : 'sin binario mongod (defina MONGOD_BIN) para la base de pruebas desechable';
const SEC = { id: 'ID-SEC', rol: 'secretaria' };
const alta = (nombres, extra = {}) => ({
  nombres, apellidos: 'Identificador', fecha_nacimiento: '2023-04-21', sexo: 'F',
  tutores: [{ dpi: 'DPI-ID-1', nombres: 'Tutora', apellidos: 'Prueba', parentesco: 'Madre', es_principal: true }],
  ...extra
});
const altaServicio = (nombres, extra = {}) => ({ ...alta(nombres, extra), fecha_nacimiento: new Date('2023-04-21T00:00:00Z') });
// Documento válido para el validador de Fase II, insertado directamente (dato heredado o importado).
const docDirecto = id_paciente => ({
  id_paciente, nombres: `Directo ${id_paciente}`, apellidos: 'Heredado', fecha_nacimiento: new Date('2020-01-01T00:00:00Z'),
  sexo: 'M', estado_historial: 'Activo', consultas: [], controles_crecimiento: [], esquema_vacunacion: [],
  tutores: [{ id_tutor: 'T1', dpi: 'DPI-H', nombres: 'Tutor', apellidos: 'Heredado', parentesco: 'Padre', es_principal: true }]
});

// Conjuntos de identificadores ya existentes y el siguiente id automático esperado.
const ESCENARIOS = [
  { nombre: 'base vacía', ids: [], esperado: 'P001' },
  { nombre: 'correlativos con huecos', ids: ['P001', 'P002', 'P007'], esperado: 'P008' },
  { nombre: 'ceros a la izquierda', ids: ['P0009'], esperado: 'P010' },
  { nombre: 'id heredado de 11 dígitos (defecto original)', ids: ['P001', 'P99999999999'], esperado: 'P002' },
  { nombre: 'id heredado de 19 dígitos', ids: ['P1234567890123456789'], esperado: 'P001' },
  { nombre: 'id de 40 caracteres', ids: [`P${'9'.repeat(39)}`], esperado: 'P001' },
  { nombre: 'ids manuales con otro formato', ids: ['HIST-2020-15', 'p12', 'PX9'], esperado: 'P001' },
  { nombre: 'último correlativo de 9 dígitos disponible', ids: ['P999999998'], esperado: 'P999999999' }
];

describe('D-01: identificador de paciente (API sobre doble en memoria)', () => {
  let ctx;
  before(async () => { ctx = await iniciar(); }); // fixtures: P001 y P003
  after(async () => { await ctx.cerrar(); });
  const api = (...a) => ctx.api(...a);

  test('registro automático normal: siguiente correlativo', async () => {
    const r = await api('POST', '/api/pacientes', { rol: 'secretaria', body: alta('Automático') });
    assert.equal(r.status, 201);
    assert.equal(r.datos.id_paciente, 'P004');
  });

  test('registro con identificador manual válido y rechazo de su duplicado', async () => {
    const r = await api('POST', '/api/pacientes', { rol: 'secretaria', body: alta('Manual', { id_paciente: 'HIST-2020-15' }) });
    assert.equal(r.status, 201);
    assert.equal(r.datos.id_paciente, 'HIST-2020-15');
    const dup = await api('POST', '/api/pacientes', { rol: 'secretaria', body: alta('Manual otro', { id_paciente: 'HIST-2020-15' }) });
    assert.equal(dup.status, 409);
    assert.equal(dup.datos.codigo, 'CONFLICTO');
  });

  test('un id manual con formato automático (P + dígitos) se rechaza con 400 y no altera la secuencia', async () => {
    for (const id of ['P99999999999', 'P1234567890123456789', 'P005', 'p77', 'P0']) {
      const r = await api('POST', '/api/pacientes', { rol: 'secretaria', body: alta(`Reservado ${id}`, { id_paciente: id }) });
      assert.equal(r.status, 400, id);
      assert.equal(r.datos.codigo, 'REGLA_NEGOCIO', id);
      assert.match(r.datos.error, /asigna el sistema/);
    }
    const r = await api('POST', '/api/pacientes', { rol: 'secretaria', body: alta('Después del largo') });
    assert.equal(r.status, 201);
    assert.equal(r.datos.id_paciente, 'P005');
  });

  test('identificadores con formato inválido: 400 de validación, nunca 500', async () => {
    for (const id of ['P 1', 'x'.repeat(41), '$ne', 'P-1/2', '']) {
      const r = await api('POST', '/api/pacientes', { rol: 'secretaria', body: alta(`Inválido ${id.length}`, { id_paciente: id }) });
      assert.equal(r.status, 400, JSON.stringify(id));
      assert.equal(r.datos.codigo, 'VALIDACION');
    }
    const tipo = await api('POST', '/api/pacientes', { rol: 'secretaria', body: alta('Numérico', { id_paciente: 99999999999 }) });
    assert.equal(tipo.status, 400);
  });

  test('altas automáticas simultáneas: ids distintos y consecutivos', async () => {
    const c = await iniciar();
    try {
      const r = await Promise.all(['A', 'B', 'C', 'D', 'E', 'F'].map(n =>
        c.api('POST', '/api/pacientes', { rol: 'secretaria', body: alta(`Simultáneo ${n}`) })));
      assert.deepEqual(r.map(x => x.status), Array(6).fill(201));
      assert.deepEqual(r.map(x => x.datos.id_paciente).sort(), ['P004', 'P005', 'P006', 'P007', 'P008', 'P009']);
    } finally { await c.cerrar(); }
  });

  test('con un id heredado de 11 dígitos la secuencia sigue funcionando', async () => {
    const c = await iniciar({ pacientes: [docDirecto('P99999999999')] });
    try {
      const r = await c.api('POST', '/api/pacientes', { rol: 'secretaria', body: alta('Tras heredado') });
      assert.equal(r.status, 201);
      assert.equal(r.datos.id_paciente, 'P001');
    } finally { await c.cerrar(); }
  });

  test('secuencia agotada (P999999999): 409 controlado sin crear paciente', async () => {
    const c = await iniciar({ pacientes: [docDirecto('P999999999')] });
    try {
      const r = await c.api('POST', '/api/pacientes', { rol: 'secretaria', body: alta('Sin correlativo') });
      assert.equal(r.status, 409);
      assert.equal(r.datos.codigo, 'CONFLICTO');
      assert.match(r.datos.error, /agot/);
      assert.equal((await c.api('GET', '/api/pacientes?q=Sin%20correlativo', { rol: 'secretaria' })).datos.total, 0);
    } finally { await c.cerrar(); }
  });

  test('el doble en memoria calcula el siguiente id de cada escenario', async () => {
    for (const e of ESCENARIOS) {
      const repos = crearRepositoriosMemoria({ pacientes: e.ids.map(docDirecto) });
      assert.equal(await repos.pacientes.siguienteId(), e.esperado, e.nombre);
    }
  });
});

describe('D-01: identificador de paciente (MongoDB desechable)', { skip: omitir }, () => {
  let mongo, client, db;
  before(async () => {
    mongo = await iniciarMongodTemporal();
    client = new MongoClient(mongo.uri);
    await client.connect();
    db = client.db('centro_pediatrico_test_ids');
    for (const c of ['pacientes', 'medicos', 'vacunas', 'bitacora_acceso']) await db.createCollection(c);
    await asegurarIndices(db);
    await A.aplicar(db); // validadores de Fase II, igual que la base del proyecto
  });
  after(async () => { await client?.close(); await mongo?.detener(); });
  const limpiar = () => db.collection('pacientes').deleteMany({}); // solo en la base desechable

  test('reproduce el defecto original: alta automática tras un id de 11 dígitos', async () => {
    await limpiar();
    const S = crearServicios(crearRepositoriosMongo(client, db));
    assert.equal((await S.pacientes.registrar(SEC, altaServicio('Primero'))).id_paciente, 'P001');
    await db.collection('pacientes').insertOne(docDirecto('P99999999999')); // registro aceptado por la versión anterior
    // Antes de la corrección: MongoServerError 241 (Overflow en $convert) → HTTP 500.
    const r = await S.pacientes.registrar(SEC, altaServicio('Segundo'));
    assert.equal(r.id_paciente, 'P002');
  });

  test('el adaptador calcula el mismo siguiente id que el doble en cada escenario', async () => {
    const repoMongo = crearRepositoriosMongo(client, db).pacientes;
    for (const e of ESCENARIOS) {
      await limpiar();
      if (e.ids.length) await db.collection('pacientes').insertMany(e.ids.map(docDirecto));
      const memoria = await crearRepositoriosMemoria({ pacientes: e.ids.map(docDirecto) }).pacientes.siguienteId();
      assert.equal(await repoMongo.siguienteId(), e.esperado, e.nombre);
      assert.equal(memoria, e.esperado, e.nombre);
    }
  });

  test('un id manual reservado se rechaza sin escribir; uno válido se acepta y su duplicado da 409', async () => {
    await limpiar();
    const S = crearServicios(crearRepositoriosMongo(client, db));
    await assert.rejects(S.pacientes.registrar(SEC, altaServicio('Reservado', { id_paciente: 'P99999999999' })),
      e => e.status === 400 && e.code === 'REGLA_NEGOCIO');
    assert.equal(await db.collection('pacientes').countDocuments(), 0);
    assert.equal((await S.pacientes.registrar(SEC, altaServicio('Manual', { id_paciente: 'HIST-2020-15' }))).id_paciente, 'HIST-2020-15');
    await assert.rejects(S.pacientes.registrar(SEC, altaServicio('Manual otro', { id_paciente: 'HIST-2020-15' })),
      e => e.status === 409 && e.code === 'CONFLICTO');
    assert.equal((await S.pacientes.registrar(SEC, altaServicio('Automático'))).id_paciente, 'P001');
  });

  test('altas automáticas simultáneas en MongoDB: ids únicos y consecutivos', async () => {
    await limpiar();
    const S = crearServicios(crearRepositoriosMongo(client, db));
    const r = await Promise.allSettled(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => S.pacientes.registrar(SEC, altaServicio(`Concurrente ${n}`))));
    assert.deepEqual(r.map(x => x.status), Array(8).fill('fulfilled'), JSON.stringify(r.map(x => x.reason?.message)));
    const ids = r.map(x => x.value.id_paciente).sort();
    assert.deepEqual(ids, ['P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008']);
    assert.equal(await db.collection('pacientes').countDocuments(), 8);
  });

  test('dos instancias del servicio sobre la misma base: el índice único impide ids repetidos', async () => {
    await limpiar();
    const [S1, S2] = [crearServicios(crearRepositoriosMongo(client, db)), crearServicios(crearRepositoriosMongo(client, db))];
    const r = await Promise.allSettled(['A', 'B', 'C'].flatMap(n => [S1, S2].map((S, i) => S.pacientes.registrar(SEC, altaServicio(`Instancia ${i} ${n}`)))));
    assert.deepEqual(r.map(x => x.status), Array(6).fill('fulfilled'), JSON.stringify(r.map(x => x.reason?.message)));
    const ids = r.map(x => x.value.id_paciente);
    assert.equal(new Set(ids).size, 6);
    assert.equal(await db.collection('pacientes').countDocuments(), 6);
  });

  test('secuencia agotada: 409 controlado, sin insertar ni reintentar indefinidamente', async () => {
    await limpiar();
    await db.collection('pacientes').insertOne(docDirecto('P999999999'));
    const S = crearServicios(crearRepositoriosMongo(client, db));
    await assert.rejects(S.pacientes.registrar(SEC, altaServicio('Sin correlativo')),
      e => e.status === 409 && e.code === 'CONFLICTO' && /agot/.test(e.message));
    assert.equal(await db.collection('pacientes').countDocuments(), 1);
  });
});
