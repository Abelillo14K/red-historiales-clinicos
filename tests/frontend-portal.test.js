'use strict';
// Portal de instituciones (apps/web/src/plataforma/portal): estados de las tarjetas según la
// sesión que informa el backend, presentación única por institución y garantías de que el
// portal solo navega (no toca la sesión, no emite tokens ni hace peticiones).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PERMISOS_POR_ROL } = require('../instituciones/pediatria/backend/permisos');

const SRC = path.join(__dirname, '..', 'apps', 'web', 'src');
const INST = path.join(__dirname, '..', 'instituciones');
const ruta = r => pathToFileURL(path.join(SRC, r)).href;
const CARPETAS = ['pediatria', 'hospital', 'odontologia', 'laboratorio'];
const codigo = f => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let P, C, registro, presentaciones, modulos;
before(async () => {
  P = await import(ruta('plataforma/portal/portal.js'));
  C = await import(ruta('plataforma/modulos/contrato.js'));
  registro = (await import(ruta('plataforma/modulos/registro.js'))).registro;
  presentaciones = [];
  modulos = {};
  for (const carpeta of CARPETAS) {
    const base = path.join(INST, carpeta, 'frontend');
    presentaciones.push({ carpeta, ...(await import(pathToFileURL(path.join(base, 'presentacion.js')).href)).default });
    modulos[carpeta] = (await import(pathToFileURL(path.join(base, 'modulo.js')).href)).default;
  }
});
const sesion = (rol, institucion = 'centro_pediatrico') => ({ usuario: 'U', rol, institucion, permisos: PERMISOS_POR_ROL[rol] });
const estados = s => P.tarjetasPortal(presentaciones, registro, s).map(t => [t.nombre, t.estado]);

test('cada institución tiene una presentación única que su manifiesto reutiliza, sin identificador', () => {
  const nombres = new Set();
  for (const p of presentaciones) {
    for (const k of ['nombre', 'sigla', 'descripcion', 'icono']) assert.ok(p[k], `${p.carpeta}: falta ${k}`);
    assert.equal(p.institucion, undefined, `${p.carpeta}: la presentación no declara el identificador (llega a producción)`);
    assert.ok(!nombres.has(p.nombre), `nombre repetido: ${p.nombre}`);
    nombres.add(p.nombre);
    const m = modulos[p.carpeta];
    for (const k of ['nombre', 'sigla', 'descripcion', 'icono', 'orden']) assert.equal(m[k], p[k], `${p.carpeta}: ${k} del manifiesto distinto de presentacion.js`);
  }
});

test('sesión de Pediatría: Pediatría disponible y las demás pendientes, en el orden del proyecto', () => {
  for (const rol of Object.keys(PERMISOS_POR_ROL)) {
    assert.deepEqual(estados(sesion(rol)), [
      ['Centro Médico Pediátrico', 'disponible'], ['Hospital General', 'pendiente'],
      ['Clínica Odontológica', 'pendiente'], ['Laboratorio Clínico', 'pendiente']
    ], rol);
  }
  const [pediatria, ...resto] = P.tarjetasPortal(presentaciones, registro, sesion('medico'));
  assert.equal(pediatria.institucion, 'centro_pediatrico');
  for (const t of resto) assert.equal(t.institucion, null, 'un módulo sin registrar no aporta identificador ni acceso');
});

test('sin autorización del backend no hay acceso real a ninguna institución', () => {
  const pendientes = [['Hospital General', 'pendiente'], ['Clínica Odontológica', 'pendiente'], ['Laboratorio Clínico', 'pendiente']];
  // Sesión de otra institución (aunque su módulo exista en el repositorio), sin permisos o inexistente.
  for (const s of [sesion('medico', 'hospital_general'), sesion('medico', 'otra_institucion'), { usuario: 'U', rol: 'medico', institucion: 'centro_pediatrico' }, null]) {
    assert.deepEqual(estados(s), [['Centro Médico Pediátrico', 'sin_autorizacion'], ...pendientes], JSON.stringify(s));
  }
  assert.equal(P.sesionAutorizaA(sesion('medico'), 'centro_pediatrico'), true);
  assert.equal(P.sesionAutorizaA(sesion('medico'), 'hospital_general'), false);
  assert.equal(P.sesionAutorizaA(sesion('medico'), null), false);
});

test('el portal no modifica la sesión que recibe', () => {
  const s = Object.freeze({ ...sesion('administrador'), permisos: Object.freeze([...PERMISOS_POR_ROL.administrador]) });
  const copia = JSON.parse(JSON.stringify(s));
  P.tarjetasPortal(presentaciones, registro, s);
  assert.deepEqual(s, copia);
});

test('después del inicio de sesión se va al portal, salvo un enlace profundo pendiente', () => {
  assert.equal(P.destinoTrasLogin(undefined), '/instituciones');
  assert.equal(P.destinoTrasLogin('/'), '/instituciones');
  assert.equal(P.destinoTrasLogin('/login'), '/instituciones');
  assert.equal(P.destinoTrasLogin('/pacientes/P001/consultas'), '/pacientes/P001/consultas');
  assert.equal(P.destinoTrasLogin('/instituciones'), '/instituciones');
});

test('ningún módulo puede ocupar las rutas de la plataforma', () => {
  const ejemplo = path => ({ contrato: 1, institucion: 'institucion_ejemplo', nombre: 'Ejemplo', roles: {}, crearApi: () => ({}),
    rutas: [{ path: '', cargar: async () => ({}) }, { path, cargar: async () => ({}) }] });
  assert.throws(() => C.validarModulo(ejemplo('instituciones')), /ruta de la plataforma/);
  assert.throws(() => C.validarModulo(ejemplo('login/x')), /ruta de la plataforma/);
  assert.doesNotThrow(() => C.validarModulo(ejemplo('pacientes')));
});

test('el portal solo navega: no usa tokens, almacenamiento de sesión ni peticiones', () => {
  const dir = path.join(SRC, 'plataforma', 'portal');
  for (const f of fs.readdirSync(dir)) {
    const s = codigo(path.join(dir, f));
    assert.ok(!/sessionStorage|localStorage|iniciarConToken|iniciarDesarrollo|devLogin|crearHttp|fetch\(|setToken|\bapi\./.test(s), `${f} no debe tocar la sesión ni hacer peticiones`);
  }
  // La acción de vista previa del portal se carga solo en desarrollo (igual que la vista previa).
  const portal = fs.readFileSync(path.join(dir, 'Portal.jsx'), 'utf8');
  assert.match(portal, /import\.meta\.env\.DEV \? lazy\(\(\) => import\('\.\.\/vista-previa\/AccionVistaPrevia\.jsx'\)\) : null/);
  assert.ok(!/vista-previa|Vista previa|Ver diseño/.test(codigo(path.join(dir, 'Portal.jsx')).replace(/import\('\.\.\/vista-previa\/AccionVistaPrevia\.jsx'\)/, '')));
});
