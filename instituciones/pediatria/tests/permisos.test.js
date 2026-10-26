'use strict';
// La sesión entrega al frontend los mismos permisos que el backend usa para autorizar.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar } = require('./helpers');
const { PERMISOS_POR_ROL, rolesCon } = require('../backend/permisos');

let ctx;
before(async () => { ctx = await iniciar(); });
after(async () => { await ctx.cerrar(); });

// Ruta representativa (de solo lectura o con cuerpo inválido) por permiso.
const SONDAS = {
  'panel.ver': ['GET', '/api/panel'],
  'pacientes.listar': ['GET', '/api/pacientes'],
  'pacientes.ver_administrativo': ['GET', '/api/pacientes/P001/administrativo'],
  'pacientes.registrar': ['POST', '/api/pacientes', {}],
  'pacientes.editar': ['PATCH', '/api/pacientes/P001', {}],
  'historial.leer': ['GET', '/api/pacientes/P001'],
  'historial.leer_archivados': ['GET', '/api/pacientes?estado=Archivado'],
  'historial.archivar': ['PATCH', '/api/pacientes/P001/archivar', {}],
  'clinico.escribir': ['POST', '/api/pacientes/P001/consultas', {}],
  'catalogos.ver': ['GET', '/api/medicos'],
  'catalogos.editar': ['POST', '/api/vacunas', {}],
  'auditoria.leer': ['GET', '/api/auditoria']
};

test('la sesión informa institución, nombre y permisos del rol', async () => {
  for (const rol of Object.keys(PERMISOS_POR_ROL)) {
    const s = (await ctx.api('GET', '/api/sesion', { rol })).datos;
    assert.equal(s.institucion, 'centro_pediatrico');
    assert.equal(s.institucion_nombre, 'Centro Médico Pediátrico');
    assert.deepEqual(s.permisos, PERMISOS_POR_ROL[rol]);
  }
});

test('cada permiso anunciado coincide con la autorización real del backend', async () => {
  for (const [permiso, [metodo, ruta, body]] of Object.entries(SONDAS)) {
    for (const rol of Object.keys(PERMISOS_POR_ROL)) {
      const r = await ctx.api(metodo, ruta, { rol, body });
      const permitido = PERMISOS_POR_ROL[rol].includes(permiso);
      assert.equal(r.status === 403, !permitido, `${permiso} · ${rol} · ${metodo} ${ruta} → ${r.status}`);
    }
  }
  assert.deepEqual(Object.keys(SONDAS).sort(), [...new Set(Object.values(PERMISOS_POR_ROL).flat())].sort(), 'todo permiso tiene sonda');
});

test('un permiso inexistente no puede usarse en una ruta', () => {
  assert.throws(() => rolesCon('pacientes.borrar'), /desconocido/);
});
