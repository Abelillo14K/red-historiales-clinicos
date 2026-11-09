'use strict';
// Integración REAL del adaptador Firestore sobre el emulador oficial (tests/soporte/firestoreTemporal.js).
// Nunca se conecta al proyecto real. Se omite si no hay Java 21+ o el emulador no está descargado.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarFirestoreTemporal, motivoOmision } = require('./soporte/firestoreTemporal');
const { pruebasFlujo, REC, OD, paciente, consulta } = require('./soporte/flujoComun');
const { pruebasAcceso } = require('./soporte/flujoAcceso');
const { sembrarCatalogo, iniciar, enDias } = require('./helpers');

const omitir = motivoOmision();

describe('Firestore (emulador)', { skip: omitir }, () => {
  let emu, db, crearRepositoriosFirestore, crearServicios;
  before(async () => {
    emu = await iniciarFirestoreTemporal();
    // El cliente se conecta al emulador por FIRESTORE_EMULATOR_HOST, nunca a la nube.
    process.env.FIRESTORE_EMULATOR_HOST = emu.host;
    delete process.env.ODONTOLOGIA_FIREBASE_CREDENCIALES;
    db = require('../backend/db').crearFirestore({ proyecto: emu.proyecto });
    ({ crearRepositoriosFirestore } = require('../backend/adapters/firestore'));
    ({ crearServicios } = require('../backend/application'));
  });
  after(async () => {
    await db?.terminate();
    await emu?.detener();
  });
  const nuevos = async () => { await emu.vaciar(); return crearRepositoriosFirestore(db); };

  pruebasFlujo('Firestore', nuevos);
  pruebasAcceso('Firestore', nuevos);

  test('las fechas vuelven como Date y el odontograma se actualiza por ruta de campo', async () => {
    const s = crearServicios(await nuevos());
    await sembrarCatalogo(s);
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    await s.pacientes.actualizarPieza(OD, id_paciente, '16', { estado: 'Caries' });
    await s.pacientes.actualizarPieza(OD, id_paciente, '17', { estado: 'Sana' });
    const snap = (await db.collection('pacientes').doc(id_paciente).get()).data();
    assert.deepEqual(Object.keys(snap.piezas).sort(), ['16', '17'], 'cada pieza es un campo del mapa, sin pisar las demás');
    const h = await s.pacientes.obtener(OD, id_paciente);
    assert.ok(h.fecha_registro instanceof Date);
    assert.ok(h.piezas['16'].actualizado instanceof Date);
  });

  test('altas simultáneas reciben números de expediente distintos (contador transaccional)', async () => {
    const s = crearServicios(await nuevos());
    const ids = await Promise.all(Array.from({ length: 5 }, (_, i) => s.pacientes.registrar(REC, paciente({ nombres: `P${i}` }))));
    assert.deepEqual(ids.map(x => x.id_paciente).sort(), ['OD000001', 'OD000002', 'OD000003', 'OD000004', 'OD000005']);
  });

  test('si la bitácora no se puede escribir, la transacción no confirma nada', async () => {
    const repos = await nuevos();
    const s = crearServicios({ ...repos, unidad: { ejecutar: fn => repos.unidad.ejecutar(tx => fn({ ...tx, auditoria: { ...tx.auditoria, registrar: async () => { throw new Error('bitácora caída'); } } })) } });
    await assert.rejects(s.pacientes.registrar(REC, paciente({ documento_identidad: 'DOC-X' })));
    assert.equal((await db.collection('pacientes').get()).size, 0);
    assert.equal((await db.collection('documentos_paciente').get()).size, 0, 'tampoco queda reservado el documento');
    assert.equal((await db.collection('contadores').doc('pacientes').get()).exists, false);
  });

  test('una consulta con cita la marca atendida en la misma transacción', async () => {
    const s = crearServicios(await nuevos());
    await sembrarCatalogo(s);
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    const { id_cita } = await s.citas.programar(REC, { id_paciente, id_odontologo: 'COL-1', fecha_hora: enDias(1), duracion_min: 30, motivo: 'Control' });
    const { id_consulta } = await s.consultas.registrar(OD, id_paciente, consulta({ id_cita }));
    const c = (await db.collection('citas').doc(id_cita).get()).data();
    assert.deepEqual([c.estado, c.id_consulta], ['Atendida', id_consulta]);
  });

});

// Motor caído o que no responde: un db simulado evita dejar reintentos de red vivos tras la prueba.
describe('Firestore no disponible', () => {
  const { crearRepositoriosFirestore } = require('../backend/adapters/firestore');
  const consulta = get => ({ limit: () => consulta(get), where: () => consulta(get), orderBy: () => consulta(get), get });
  const dbFalso = get => ({ collection: () => ({ ...consulta(get), doc: () => ({ get }) }) });

  for (const [caso, get, ms] of [
    ['responde UNAVAILABLE', () => Promise.reject(Object.assign(new Error('14 UNAVAILABLE: sin conexión'), { code: 14 })), 15_000],
    ['no responde (tiempo máximo)', () => new Promise(() => {}), 300]
  ]) {
    test(`la API responde 503 si Firestore ${caso}, sin caerse`, async () => {
      const ctx = await iniciar(crearRepositoriosFirestore(dbFalso(get), { tiempoMaximoMs: ms }), { sembrar: false });
      try {
        const r = await ctx.api('GET', '/api/odontologos', { rol: 'recepcion' });
        assert.deepEqual([r.status, r.datos.codigo], [503, 'MOTOR_NO_DISPONIBLE']);
        assert.equal((await ctx.api('GET', '/api/sesion', { rol: 'recepcion' })).status, 200, 'la sesión no depende del motor');
      } finally {
        await ctx.cerrar();
      }
    });
  }
});
