'use strict';
// Pruebas de las cuentas de acceso que corren igual sobre el doble en memoria y sobre el motor real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../helpers');
const { crearServicios } = require('../../backend/application');
const { verificarToken } = require('../../backend/security');
const { crearAutenticador } = require('../../backend');

const SISTEMA = { id: 'script-usuarios', rol: 'sistema' };
const CLAVE = 'clave-de-prueba-123';
const codigo = c => e => e.code === c;

function pruebasAcceso(nombre, nuevosRepos) {
  async function preparar() {
    const repos = await nuevosRepos();
    const s = crearServicios(repos);
    await s.acceso.crearCuenta(SISTEMA, { usuario: 'demo.admin', rol: 'administrador', contrasena: CLAVE });
    return { s, repos };
  }

  test(`${nombre}: inicia sesión con usuario y contraseña, y la contraseña solo se guarda cifrada`, async () => {
    const { s, repos } = await preparar();
    assert.deepEqual(await s.acceso.autenticar('  Demo.Admin ', CLAVE), { usuario: 'demo.admin', rol: 'administrador' });
    const guardada = await repos.cuentas.obtener('demo.admin');
    assert.match(guardada.hash_contrasena, /^scrypt\$/);
    assert.ok(!guardada.hash_contrasena.includes(CLAVE));
    const eventos = await repos.auditoria.listar({ accion: 'INICIO_SESION' });
    assert.equal(eventos[0].usuario, 'demo.admin');
    assert.equal(eventos[0].resultado, 'PERMITIDO');
    assert.equal((await repos.auditoria.listar({ accion: 'CREAR_CUENTA' })).length, 1);
  });

  test(`${nombre}: contraseña incorrecta y usuario inexistente responden igual y quedan en la bitácora`, async () => {
    const { s, repos } = await preparar();
    await assert.rejects(s.acceso.autenticar('demo.admin', 'otra-clave-123'), codigo('CREDENCIALES_INVALIDAS'));
    await assert.rejects(s.acceso.autenticar('no.existe', CLAVE), codigo('CREDENCIALES_INVALIDAS'));
    await assert.rejects(s.acceso.autenticar('', ''), codigo('CREDENCIALES_INVALIDAS'));
    await assert.rejects(s.acceso.autenticar('demo.admin', undefined), codigo('CREDENCIALES_INVALIDAS'));
    const denegados = (await repos.auditoria.listar({ accion: 'INICIO_SESION' })).filter(e => e.resultado === 'DENEGADO');
    assert.equal(denegados.length, 4);
    assert.ok(denegados.some(e => e.detalle === 'Contraseña incorrecta'));
    assert.ok(denegados.some(e => e.detalle === 'Usuario inexistente'));
  });

  test(`${nombre}: no repite usuarios, valida datos y cambia la contraseña`, async () => {
    const { s } = await preparar();
    await assert.rejects(s.acceso.crearCuenta(SISTEMA, { usuario: 'demo.admin', rol: 'administrador', contrasena: CLAVE }), codigo('CONFLICTO'));
    await assert.rejects(s.acceso.crearCuenta(SISTEMA, { usuario: 'x', rol: 'administrador', contrasena: CLAVE }), /Usuario inválido/);
    await assert.rejects(s.acceso.crearCuenta(SISTEMA, { usuario: 'demo.otro', rol: 'medico', contrasena: CLAVE }), /Rol inválido/);
    await assert.rejects(s.acceso.crearCuenta(SISTEMA, { usuario: 'demo.otro', rol: 'administrador', contrasena: 'corta' }), /contraseña/);
    await s.acceso.cambiarContrasena(SISTEMA, 'demo.admin', 'nueva-clave-456');
    await assert.rejects(s.acceso.autenticar('demo.admin', CLAVE), codigo('CREDENCIALES_INVALIDAS'));
    assert.equal((await s.acceso.autenticar('demo.admin', 'nueva-clave-456')).rol, 'administrador');
    await assert.rejects(s.acceso.cambiarContrasena(SISTEMA, 'no.existe', 'nueva-clave-456'), codigo('NO_ENCONTRADO'));
  });

  test(`${nombre}: el autenticador del módulo entrega un JWT de la institución`, async () => {
    const { s } = await preparar();
    const r = await crearAutenticador(s)('demo.admin', CLAVE);
    const p = verificarToken(r.token);
    assert.equal(p.sub, 'demo.admin');
    assert.equal(p.rol, 'administrador');
    assert.equal(p.institucion, r.institucion);
  });
}

module.exports = { pruebasAcceso };
