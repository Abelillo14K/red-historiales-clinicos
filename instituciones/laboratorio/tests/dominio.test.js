'use strict';
// Reglas de negocio puras del laboratorio (sin motor de base de datos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../backend/domain/reglas');

const numerico = { id_parametro: '1', nombre: 'Numérico', tipo_dato: 'Numerico', valor_ref_min: 10, valor_ref_max: 20 };
const texto = { id_parametro: '2', nombre: 'Texto', tipo_dato: 'Texto', valor_ref_texto: 'Normal' };

test('evalúa valores numéricos contra el rango de referencia (límites incluidos)', () => {
  assert.equal(R.evaluarValor(numerico, 10).fuera_de_rango, false);
  assert.equal(R.evaluarValor(numerico, 20).fuera_de_rango, false);
  assert.equal(R.evaluarValor(numerico, 9.99).fuera_de_rango, true);
  assert.equal(R.evaluarValor(numerico, '20,5').valor_numerico, 20.5);
  assert.equal(R.evaluarValor({ ...numerico, valor_ref_max: null }, 1000).fuera_de_rango, false);
  for (const malo of ['abc', '', null, undefined, 'Infinity']) assert.throws(() => R.evaluarValor(numerico, malo), /numérico/);
});

test('evalúa valores de texto contra la referencia sin distinguir mayúsculas', () => {
  assert.deepEqual(R.evaluarValor(texto, ' normal '), { id_parametro: '2', valor_numerico: null, valor_texto: 'normal', fuera_de_rango: false });
  assert.equal(R.evaluarValor(texto, 'Turbio').fuera_de_rango, true);
  assert.equal(R.evaluarValor({ ...texto, valor_ref_texto: null }, 'Lo que sea').fuera_de_rango, false);
  assert.throws(() => R.evaluarValor(texto, '   '), /obligatorio/);
  assert.throws(() => R.evaluarValor(texto, 'x'.repeat(81)), /80/);
});

test('solo acepta parámetros del tipo de examen, una vez cada uno', () => {
  assert.equal(R.evaluarValores([numerico, texto], [{ id_parametro: 1, valor: 15 }]).length, 1);
  assert.throws(() => R.evaluarValores([numerico], [{ id_parametro: '2', valor: 'x' }]), /no pertenece/);
  assert.throws(() => R.evaluarValores([numerico], [{ id_parametro: '1', valor: 1 }, { id_parametro: '1', valor: 2 }]), /repetido/);
  assert.throws(() => R.evaluarValores([numerico], []), /al menos/);
});

test('un resultado completo tiene todos los parámetros de su tipo', () => {
  assert.doesNotThrow(() => R.exigirCompleto([numerico, texto], [{ id_parametro: '1' }, { id_parametro: '2' }]));
  assert.throws(() => R.exigirCompleto([numerico, texto], [{ id_parametro: '1' }]), /Faltan parámetros por registrar: Texto/);
});

test('el estado de la solicitud se deriva de sus exámenes', () => {
  assert.equal(R.estadoSolicitud(['Pendiente', 'Pendiente']), 'Pendiente');
  assert.equal(R.estadoSolicitud(['Pendiente', 'Muestra tomada']), 'En proceso');
  assert.equal(R.estadoSolicitud(['Resultado listo', 'Procesando']), 'En proceso');
  assert.equal(R.estadoSolicitud(['Resultado listo', 'Resultado listo']), 'Completada');
  assert.equal(R.estadoSolicitud([]), 'Pendiente');
});

test('historial activo, fechas futuras y repetidos', () => {
  assert.throws(() => R.exigirActivo(null), e => e.code === 'NO_ENCONTRADO');
  assert.throws(() => R.exigirActivo({ estado_historial: 'Archivado' }), e => e.code === 'CONFLICTO');
  assert.doesNotThrow(() => R.noEnFuturo(new Date(Date.now() + 60_000), 'fecha'));
  assert.throws(() => R.noEnFuturo(new Date(Date.now() + 864e5), 'fecha'), /futuro/);
  assert.throws(() => R.sinRepetidos(['1', 1], 'Tipo'), /Tipo repetido: 1/);
});
