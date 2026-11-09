'use strict';
// Casos de uso sobre el doble en memoria; la misma batería corre contra el emulador en firestore.integration.test.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearRepositoriosMemoria } = require('./doubles/memoria');
const { crearServicios } = require('../backend/application');
const { pruebasFlujo, REC, paciente } = require('./soporte/flujoComun');
const { pruebasAcceso } = require('./soporte/flujoAcceso');

pruebasFlujo('Memoria', async () => crearRepositoriosMemoria());
pruebasAcceso('Memoria', async () => crearRepositoriosMemoria());

test('Memoria: si la bitácora falla, la escritura no se aplica y la lectura no se entrega', async () => {
  const repos = crearRepositoriosMemoria();
  const s = crearServicios(repos);
  repos.fallarAuditoria(true);
  await assert.rejects(s.pacientes.registrar(REC, paciente()));
  assert.deepEqual([Object.keys(repos.estado().pacientes).length, repos.estado().contador], [0, 0]);
  await assert.rejects(s.pacientes.listar(REC, {}), e => e.code === 'AUDITORIA_NO_DISPONIBLE' && e.status === 503);
});

test('los repositorios deben cumplir los puertos', () => {
  const repos = crearRepositoriosMemoria();
  assert.throws(() => crearServicios({ ...repos, citas: { listar() {} } }), /CitaRepository incompleto/);
});
