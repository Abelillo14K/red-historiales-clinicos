'use strict';
// La sesión entrega al frontend los mismos permisos que el backend usa para autorizar.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar } = require('./helpers');
const { PERMISOS_POR_ROL, PERMISOS, rolesCon } = require('../backend/permisos');

let ctx;
before(async () => { ctx = await iniciar(); });
after(async () => { await ctx.cerrar(); });

// Ruta representativa (de solo lectura o con cuerpo inválido) por permiso.
const SONDAS = {
  'panel.ver': ['GET', '/api/panel'],
  'pacientes.listar': ['GET', '/api/pacientes'],
  'pacientes.ver_administrativo': ['GET', '/api/pacientes/1/administrativo'],
  'pacientes.registrar': ['POST', '/api/pacientes', {}],
  'historial.leer': ['GET', '/api/pacientes/1'],
  'historial.leer_archivados': ['GET', '/api/pacientes?estado=Archivado'],
  'historial.archivar': ['PATCH', '/api/pacientes/1/archivar', {}],
  'catalogos.ver': ['GET', '/api/tipos-examen'],
  'catalogos.editar': ['POST', '/api/tipos-muestra', {}],
  'auditoria.leer': ['GET', '/api/auditoria'],
  'laboratorio.solicitudes.ver': ['GET', '/api/solicitudes'],
  'laboratorio.solicitudes.crear': ['POST', '/api/pacientes/1/solicitudes', {}],
  'laboratorio.resultados.ver': ['GET', '/api/resultados'],
  'laboratorio.resultados.registrar': ['PUT', '/api/examenes/1/resultado', {}],
  'laboratorio.resultados.validar': ['PATCH', '/api/resultados/999999/validar']
};

test('la sesión informa institución y los permisos exactos de cada rol', async () => {
  for (const rol of Object.keys(PERMISOS_POR_ROL)) {
    const s = (await ctx.api('GET', '/api/sesion', { rol })).datos;
    assert.equal(s.institucion, 'laboratorio_clinico');
    assert.equal(s.rol, rol);
    assert.deepEqual(s.permisos, PERMISOS_POR_ROL[rol]);
  }
});

test('cada permiso anunciado coincide con la autorización real del backend', async () => {
  for (const [permiso, [metodo, ruta, body]] of Object.entries(SONDAS)) {
    for (const rol of Object.keys(PERMISOS_POR_ROL)) {
      const r = await ctx.api(metodo, ruta, { rol, body });
      const permitido = PERMISOS_POR_ROL[rol].includes(permiso);
      assert.equal(r.status === 403, !permitido,`${permiso} · ${rol} · ${metodo} ${ruta} → ${r.status} ${r.datos?.codigo}`);
    }
  }
  assert.deepEqual(Object.keys(SONDAS).sort(), PERMISOS, 'todo permiso tiene sonda');
});

test('los permisos son comunes o llevan el prefijo laboratorio.', () => {
  const COMUNES = /^(panel|pacientes|historial|clinico|catalogos|auditoria)\.[a-z_]+$/;
  for (const p of PERMISOS) assert.ok(COMUNES.test(p) || /^laboratorio\.[a-z_]+\.[a-z_]+$/.test(p), p);
});

test('un permiso inexistente no puede usarse en una ruta', () => {
  assert.throws(() => rolesCon('pacientes.borrar'), /desconocido/);
});
