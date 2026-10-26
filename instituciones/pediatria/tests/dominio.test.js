'use strict';
// Reglas de dominio y contratos de puertos (sin HTTP ni base de datos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../backend/domain/reglas');
const { verificarPuerto, verificarRepositorios } = require('../backend/ports');
const { crearRepositoriosMemoria } = require('./doubles/memoria');
const { crearRepositoriosMongo } = require('../backend/adapters/mongo');
const { crearUnidadDeTrabajo } = require('../backend/adapters/mongo/unidadDeTrabajo');

test('exactamente un tutor principal y sin DPI repetido', () => {
  const t = (id, dpi, p) => ({ id_tutor: id, dpi, es_principal: p });
  assert.doesNotThrow(() => R.validarTutores([t('A', '1', true), t('B', '2', false)]));
  assert.throws(() => R.validarTutores([t('A', '1', false)]), /principal/);
  assert.throws(() => R.validarTutores([t('A', '1', true), t('B', '2', true)]), /principal/);
  assert.throws(() => R.validarTutores([t('A', '1', true), t('B', '1', false)]), /DPI/);
});

test('una dosis cancelada no bloquea reprogramar; una pendiente o aplicada sí', () => {
  const esquema = [{ id_vacuna: 'V1', numero_dosis: 1, estado: 'Cancelada' }, { id_vacuna: 'V2', numero_dosis: 1, estado: 'Aplicada' }];
  assert.equal(R.dosisDuplicada(esquema, 'V1', 1), false);
  assert.equal(R.dosisDuplicada(esquema, 'V2', 1), true);
  assert.equal(R.dosisDuplicada(esquema, 'V2', 2), false);
});

test('fechas: no futuras y no anteriores al nacimiento; edad en meses', () => {
  assert.throws(() => R.noEnFuturo(new Date(Date.now() + 3600e3), 'x'));
  assert.doesNotThrow(() => R.noEnFuturo(new Date(Date.now() + 60e3), 'x'));
  assert.throws(() => R.noAntesDeNacimiento(new Date('2020-01-01'), { fecha_nacimiento: new Date('2021-01-01') }, 'x'));
  assert.equal(R.edadEnMeses('2020-05-12T00:00:00Z', '2026-10-23T15:00:00Z'), 77);
  assert.equal(R.edadEnMeses('2020-05-31T00:00:00Z', '2020-06-30T00:00:00Z'), 0);
});

test('identificadores generados cumplen el formato de la API', () => {
  const id = R.nuevoId('C');
  assert.match(id, /^C-[0-9A-F]{10}$/);
  assert.notEqual(id, R.nuevoId('C'));
});

test('el adaptador MongoDB y el doble de prueba implementan los mismos puertos', () => {
  const dbFalsa = { collection: () => ({}), command: async () => ({}) };
  assert.doesNotThrow(() => verificarRepositorios(crearRepositoriosMongo({ startSession() {} }, dbFalsa)));
  assert.doesNotThrow(() => verificarRepositorios(crearRepositoriosMemoria()));
  assert.throws(() => verificarPuerto('VacunaRepository', { listar() {} }), /obtener, crear/);
});

test('unidad de trabajo: sin replica set ejecuta directo; con replica set usa transacción', async () => {
  const standalone = crearUnidadDeTrabajo({ startSession: () => assert.fail('no debe abrir sesión') }, { command: async () => ({ isWritablePrimary: true }) });
  assert.equal(await standalone.soportaTransacciones(), false);
  assert.equal(await standalone.ejecutar(async () => 7), 7);

  let transaccion = 0, finalizada = false;
  const sesion = { withTransaction: async fn => { transaccion++; await fn(); }, endSession: async () => { finalizada = true; } };
  const replica = crearUnidadDeTrabajo({ startSession: () => sesion }, { command: async () => ({ setName: 'rs0' }) });
  assert.equal(await replica.soportaTransacciones(), true);
  assert.equal(await replica.ejecutar(async () => 'ok'), 'ok');
  assert.equal(transaccion, 1);
  assert.equal(finalizada, true);
});
