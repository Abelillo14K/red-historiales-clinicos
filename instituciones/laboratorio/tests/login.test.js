'use strict';
// Inicio de sesión común (POST /auth/login del servidor compartido) con cuentas del laboratorio.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers');
const { crearApp } = require('../../pediatria/backend/app');
const { crearServicios: serviciosPediatria } = require('../../pediatria/backend/application');
const { crearRepositoriosMemoria: memoriaPediatria } = require('../../pediatria/tests/doubles/memoria');
const { crearRouterLaboratorio } = require('../backend/app');
const { crearServicios } = require('../backend/application');
const { crearAutenticador } = require('../backend');
const { crearRepositoriosMemoria } = require('./doubles/memoria');

const CLAVE = 'clave-de-prueba-123';
let server, base;

before(async () => {
  const servicios = crearServicios(crearRepositoriosMemoria());
  await servicios.acceso.crearCuenta({ id: 'script-usuarios', rol: 'sistema' }, { usuario: 'lab.admin', rol: 'administrador', contrasena: CLAVE });
  const modulo = { nombre: 'Laboratorio Clínico', motor: 'PostgreSQL', prefijoUsuario: 'lab.' };
  const app = crearApp(serviciosPediatria(memoriaPediatria()), {
    frontendDist: null,
    instituciones: {
      laboratorio_clinico: { ...modulo, router: crearRouterLaboratorio(servicios), autenticar: crearAutenticador(servicios) },
      caido: { ...modulo, prefijoUsuario: 'caido.', router: crearRouterLaboratorio(servicios),
        autenticar: crearAutenticador({ acceso: { autenticar: async () => { throw new Error('connect ECONNREFUSED'); } } }) }
    }
  });
  server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(r => server.close(r)));

const entrar = async (usuario, contrasena) => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, contrasena })
  });
  return { status: res.status, datos: await res.json() };
};

test('una cuenta lab. entra por el formulario común y su token abre el laboratorio', async () => {
  const r = await entrar('lab.admin', CLAVE);
  assert.equal(r.status, 200);
  assert.equal(r.datos.rol, 'administrador');
  const sesion = await fetch(`${base}/api/sesion`, { headers: { Authorization: `Bearer ${r.datos.token}` } });
  assert.equal(sesion.status, 200);
  assert.equal((await sesion.json()).institucion, 'laboratorio_clinico');
});

test('contraseña incorrecta: 401 con el formato de error común', async () => {
  const r = await entrar('lab.admin', 'otra-clave-123');
  assert.equal(r.status, 401);
  assert.equal(r.datos.codigo, 'CREDENCIALES_INVALIDAS');
});

test('si la base del módulo no responde: 503 MOTOR_NO_DISPONIBLE', async () => {
  const r = await entrar('caido.admin', CLAVE);
  assert.equal(r.status, 503);
  assert.equal(r.datos.codigo, 'MOTOR_NO_DISPONIBLE');
});
