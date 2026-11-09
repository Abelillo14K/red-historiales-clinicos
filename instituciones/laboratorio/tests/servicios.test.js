'use strict';
// Casos de uso sobre el doble en memoria; la misma batería corre contra PostgreSQL en postgres.integration.test.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearRepositoriosMemoria } = require('./doubles/memoria');
const { crearServicios } = require('../backend/application');
const { pruebasFlujo, REC, paciente } = require('./soporte/flujoComun');
const { pruebasAcceso } = require('./soporte/flujoAcceso');

pruebasFlujo('Memoria', async () => crearRepositoriosMemoria());
pruebasAcceso('Memoria', async () => crearRepositoriosMemoria());

test('Memoria: si la bitácora falla, la escritura se revierte y la lectura no se entrega', async () => {
  const repos = crearRepositoriosMemoria();
  const s = crearServicios(repos);
  repos.fallarAuditoria(true);
  await assert.rejects(s.pacientes.registrar(REC, paciente()));
  assert.equal(repos.estado().pacientes.length, 0);
  await assert.rejects(s.pacientes.listar(REC, {}), e => e.code === 'AUDITORIA_NO_DISPONIBLE' && e.status === 503);
});

test('los repositorios deben cumplir los puertos', () => {
  const repos = crearRepositoriosMemoria();
  assert.throws(() => crearServicios({ ...repos, resultados: { obtener() {} } }), /ResultadoRepository incompleto/);
});
