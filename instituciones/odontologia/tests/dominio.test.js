'use strict';
// Reglas de negocio puras de la clínica (sin motor de base de datos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../backend/domain/reglas');

test('numeración FDI: 32 piezas permanentes y 20 temporales', () => {
  assert.equal(R.PIEZAS.length, 52);
  for (const p of ['11', '18', '48', '51', '85']) assert.doesNotThrow(() => R.exigirPieza(p));
  for (const p of ['10', '19', '49', '56', '90', 'A1']) assert.throws(() => R.exigirPieza(p), /FDI/);
  assert.doesNotThrow(() => R.exigirPieza(null), 'una consulta puede no referirse a una pieza');
});

test('términos de búsqueda: prefijos sin acentos ni mayúsculas', () => {
  const t = R.terminosBusqueda('Ana Lucía', 'López');
  for (const x of ['an', 'ana', 'lu', 'lucia', 'lo', 'lopez']) assert.ok(t.includes(x), x);
  assert.ok(!t.includes('l'), 'mínimo dos letras');
  assert.equal(R.normalizar('  Ñandú Peña '), 'nandu pena', 'sin tildes ni eñe: «pena» encuentra «Peña»');
});

test('estados de cita: solo una cita programada cambia de estado', () => {
  assert.equal(R.cambiarEstadoCita('Programada', 'Atendida'), 'Atendida');
  assert.throws(() => R.cambiarEstadoCita('Programada', 'Programada'), /ya está/);
  for (const e of ['Atendida', 'Cancelada', 'No asistió']) assert.throws(() => R.cambiarEstadoCita(e, 'Cancelada'), e => e.code === 'CONFLICTO');
});

test('expediente correlativo, documento normalizado y límites de la consulta', () => {
  assert.equal(R.idPaciente(1), 'OD000001');
  assert.equal(R.idPaciente(1234567), 'OD1234567');
  assert.equal(R.claveDocumento(' 2541 36987 0101 '), '2541369870101');
  assert.doesNotThrow(() => R.caben(new Array(49), 1, 'x'));
  assert.throws(() => R.caben(new Array(50), 1, 'diagnósticos'), /máximo de 50 diagnósticos/);
});

test('fechas: no futuras, no anteriores al nacimiento, historial activo', () => {
  assert.throws(() => R.noEnFuturo(new Date(Date.now() + 864e5), 'f'), /futuro/);
  assert.throws(() => R.despuesDeNacer(new Date('1999-12-31T23:00:00Z'), { fecha_nacimiento: '2000-01-01' }, 'f'), /nacimiento/);
  assert.doesNotThrow(() => R.despuesDeNacer(new Date('2000-01-01T08:00:00Z'), { fecha_nacimiento: '2000-01-01' }, 'f'));
  assert.throws(() => R.exigirActivo({ estado_historial: 'Archivado' }), e => e.code === 'CONFLICTO');
  assert.throws(() => R.exigirActivo(null), e => e.code === 'NO_ENCONTRADO');
});
