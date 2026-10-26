'use strict';
// Contrato de módulos institucionales del frontend: registro, rutas y navegación
// según permisos, estados de sesión y migas de pan (sin navegador).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PERMISOS_POR_ROL } = require('../instituciones/pediatria/backend/permisos');

const ruta = r => pathToFileURL(path.join(__dirname, '..', 'apps', 'web', 'src', r)).href;
let C, pediatria;
before(async () => {
  C = await import(ruta('plataforma/modulos/contrato.js'));
  pediatria = (await import(pathToFileURL(path.join(__dirname, '..', 'instituciones', 'pediatria', 'frontend', 'modulo.js')).href)).default;
});
const sesion = rol => ({ usuario: 'U', rol, institucion: 'centro_pediatrico', permisos: PERMISOS_POR_ROL[rol] });
// Módulo mínimo de ejemplo (no representa a ninguna institución real).
const ejemplo = extra => ({
  contrato: 1, institucion: 'institucion_ejemplo', nombre: 'Ejemplo', roles: { r: 'R' }, crearApi: () => ({}),
  rutas: [{ path: '', cargar: async () => ({}) }, { path: 'cosas', titulo: 'Cosas', permiso: 'pacientes.listar', cargar: async () => ({}) }],
  navegacion: [{ to: '/cosas', etiqueta: 'Cosas', permiso: 'pacientes.listar' }], ...extra
});

test('el módulo pediátrico cumple el contrato y sus permisos existen en el backend', () => {
  assert.doesNotThrow(() => C.validarModulo(pediatria));
  const conocidos = new Set(Object.values(PERMISOS_POR_ROL).flat());
  for (const x of [...pediatria.rutas, ...pediatria.navegacion]) {
    if (x.permiso) assert.ok(conocidos.has(x.permiso), `permiso sin respaldo en el backend: ${x.permiso}`);
  }
  assert.deepEqual(Object.keys(pediatria.roles).sort(), Object.keys(PERMISOS_POR_ROL).sort());
});

test('el contrato rechaza manifiestos incompletos o inconsistentes', () => {
  assert.throws(() => C.validarModulo(ejemplo({ contrato: 2 })), /contrato/);
  assert.throws(() => C.validarModulo(ejemplo({ institucion: 'Con Espacios' })), /institucion/);
  assert.throws(() => C.validarModulo(ejemplo({ rutas: [{ path: '/abs', cargar: () => {} }] })), /relativo/);
  assert.throws(() => C.validarModulo(ejemplo({ navegacion: [{ to: '/no-existe', etiqueta: 'X' }] })), /ninguna ruta/);
  assert.throws(() => C.validarModulo(ejemplo({ rutas: [{ path: 'x', cargar: () => {} }] })), /inicio del módulo/);
  assert.throws(() => C.validarModulo(ejemplo({ rutas: [{ path: '', cargar: () => {}, permiso: 'MAL' }] })), /recurso\.accion/);
  assert.throws(() => C.crearRegistro([ejemplo(), ejemplo()]), /dos veces/);
});

test('un registro con varias instituciones resuelve solo la que informa el backend', () => {
  const registro = C.crearRegistro([pediatria, ejemplo()]);
  assert.deepEqual(registro.instituciones(), ['centro_pediatrico', 'institucion_ejemplo']);
  assert.equal(C.resolverSesion(registro, sesion('medico')).modulo.institucion, 'centro_pediatrico');
  assert.equal(C.resolverSesion(registro, { ...sesion('medico'), institucion: 'institucion_ejemplo' }).modulo.nombre, 'Ejemplo');
  assert.deepEqual(C.resolverSesion(registro, { ...sesion('medico'), institucion: 'hospital_general' }), { estado: 'institucion_sin_interfaz', institucion: 'hospital_general' });
  assert.equal(C.resolverSesion(registro, { ...sesion('medico'), permisos: undefined }).estado, 'sesion_incompleta');
  assert.equal(C.resolverSesion(registro, null).estado, 'sin_sesion');
  // Una clave heredada no es una institución registrada.
  assert.equal(C.resolverSesion(registro, { ...sesion('medico'), institucion: 'constructor' }).estado, 'institucion_sin_interfaz');
});

test('navegación y rutas visibles según los permisos de cada rol', () => {
  const nav = rol => C.navegacionPara(pediatria, sesion(rol)).map(n => n.to);
  assert.deepEqual(nav('secretaria'), ['/', '/pacientes', '/vacunacion', '/medicos']);
  assert.deepEqual(nav('medico'), ['/', '/pacientes', '/vacunacion', '/medicos']);
  assert.deepEqual(nav('administrador'), ['/', '/pacientes', '/vacunacion', '/medicos', '/archivados', '/auditoria']);
  const rutas = rol => C.rutasPara(pediatria, sesion(rol)).map(r => r.path);
  assert.ok(!rutas('medico').includes('pacientes/nuevo'));
  assert.ok(rutas('medico').includes('pacientes/:id/consultas/nueva'));
  assert.ok(!rutas('secretaria').includes('pacientes/:id/consultas/nueva'));
  assert.ok(!rutas('secretaria').includes('auditoria'));
  assert.equal(C.puede(null, 'auditoria.leer'), false);
});

test('migas de pan desde los títulos del manifiesto', () => {
  const migas = p => C.migasPara(pediatria, p).map(m => m.titulo);
  assert.deepEqual(migas('/'), []);
  assert.deepEqual(migas('/pacientes'), ['Pacientes']);
  assert.deepEqual(migas('/pacientes/nuevo'), ['Pacientes', 'Registrar paciente']);
  assert.deepEqual(migas('/pacientes/P001/crecimiento'), ['Pacientes', 'P001', 'Crecimiento']);
  assert.deepEqual(migas('/pacientes/P001/consultas/nueva'), ['Pacientes', 'P001', 'Consultas', 'Nueva consulta']);
  assert.deepEqual(C.migasPara(pediatria, '/pacientes/P001').map(m => m.to), ['/pacientes', '/pacientes/P001']);
});

test('la ruta del expediente comparte una sola función de carga (no se vuelve a montar al cambiar de pestaña)', () => {
  const a = pediatria.rutas.find(r => r.path === 'pacientes/:id').cargar;
  const b = pediatria.rutas.find(r => r.path === 'pacientes/:id/:seccion').cargar;
  assert.equal(a, b);
});
