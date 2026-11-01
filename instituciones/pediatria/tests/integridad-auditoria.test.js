'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, fixtures } = require('./helpers');
const { crearServicios } = require('../backend/application');
const { crearRepositoriosMemoria } = require('./doubles/memoria');
const { CASOS_NACIMIENTO, comprobarCarreraNacimiento } = require('./soporte/carrerasNacimiento');
const { asegurarIndices, exigirIndicesEsenciales } = require('../backend/adapters/mongo');

const SEC = { id: 'REG-SEC', rol: 'secretaria' };
const MED = { id: 'REG-MED', rol: 'medico' };
const nuevo = nombres => ({
  nombres, apellidos: 'Integridad', fecha_nacimiento: new Date('2021-01-15T00:00:00Z'), sexo: 'F',
  tutores: [{ dpi: 'DPI-REG', nombres: 'Tutor', apellidos: 'Prueba', parentesco: 'Padre', es_principal: true }]
});

describe('Identidad consistente al registrar y editar', () => {
  test('la API rechaza una edición duplicada, excluye al propio paciente y no modifica al rechazado', async () => {
    const ctx = await iniciar();
    try {
      const alta = await ctx.api('POST', '/api/pacientes', { rol: 'secretaria', body: { ...nuevo('Otra'), fecha_nacimiento: '2021-01-15' } });
      assert.equal(alta.status, 201);
      const ruta = `/api/pacientes/${alta.datos.id_paciente}`;
      const r = await ctx.api('PATCH', ruta, { rol: 'secretaria', body: { nombres: 'NIÑA', apellidos: 'FICTICIA' } });
      assert.equal(r.status, 409);
      assert.equal(r.datos.codigo, 'CONFLICTO');
      assert.equal(ctx.repos._pacientes.get(alta.datos.id_paciente).nombres, 'Otra');
      assert.equal((await ctx.api('PATCH', ruta, { rol: 'secretaria', body: { nombres: 'Otra' } })).status, 200);
    } finally { await ctx.cerrar(); }
  });

  test('dos ediciones concurrentes hacia la misma identidad solo permiten una', async () => {
    const repos = crearRepositoriosMemoria(fixtures());
    const S = crearServicios(repos);
    const ids = await Promise.all(['Primera', 'Segunda'].map(n => S.pacientes.registrar(SEC, nuevo(n))));
    const r = await Promise.allSettled(ids.map(({ id_paciente }) => S.pacientes.actualizarDatos(SEC, id_paciente, { nombres: 'Destino' })));
    assert.deepEqual(r.map(x => x.status).sort(), ['fulfilled', 'rejected']);
    assert.equal(r.find(x => x.status === 'rejected').reason.status, 409);
    assert.equal([...repos._pacientes.values()].filter(p => p.nombres === 'Destino').length, 1);
  });

  test('el alta y la edición comparten la exclusión para la misma identidad destino', async () => {
    const repos = crearRepositoriosMemoria(fixtures());
    const S = crearServicios(repos);
    const { id_paciente } = await S.pacientes.registrar(SEC, nuevo('Inicial'));
    const r = await Promise.allSettled([
      S.pacientes.actualizarDatos(SEC, id_paciente, { nombres: 'Destino' }),
      S.pacientes.registrar(SEC, nuevo('Destino'))
    ]);
    assert.deepEqual(r.map(x => x.status).sort(), ['fulfilled', 'rejected']);
    assert.equal([...repos._pacientes.values()].filter(p => p.nombres === 'Destino').length, 1);
  });

  test('dos ediciones parciales del mismo paciente no combinan identidades leídas antes del cambio', async () => {
    const repos = crearRepositoriosMemoria(fixtures());
    const S = crearServicios(repos);
    const r = await Promise.allSettled([
      S.pacientes.actualizarDatos(SEC, 'P001', { nombres: 'Nombre nuevo' }),
      S.pacientes.actualizarDatos(SEC, 'P001', { apellidos: 'Apellido nuevo' })
    ]);
    assert.deepEqual(r.map(x => x.status).sort(), ['fulfilled', 'rejected']);
    assert.equal(r.find(x => x.status === 'rejected').reason.status, 409);
  });
});

describe('Nacimiento vigente en la escritura clínica', () => {
  for (const caso of CASOS_NACIMIENTO) {
    test(`rechaza la carrera de ${caso.nombre}`, { timeout: 10000 }, async () => {
      const repos = crearRepositoriosMemoria(fixtures());
      await comprobarCarreraNacimiento(repos, crearServicios(repos), 'P001', MED, SEC, caso);
    });
  }
});

describe('Lecturas auditadas y fallo temporal de bitácora', () => {
  test('panel, pendientes y listado registran actor y recurso sin copiar búsquedas ni datos clínicos', async () => {
    const ctx = await iniciar();
    try {
      for (const ruta of ['/api/panel', '/api/vacunacion/pendientes', '/api/pacientes?q=DPI-T-1']) {
        assert.equal((await ctx.api('GET', ruta, { rol: 'medico' })).status, 200);
      }
      for (const [accion, recurso] of [['LEER_PANEL', 'panel'], ['LEER_VACUNACION_PENDIENTE', 'vacunacion'], ['LISTAR_PACIENTES', 'pacientes']]) {
        const e = ctx.repos._bitacora.find(x => x.accion === accion);
        assert.ok(e, accion);
        assert.equal(e.id_usuario, 'USR-medico');
        assert.equal(e.recurso, recurso);
        assert.equal(e.resultado, 'EXITOSO');
        assert.equal(e.detalle, undefined);
      }
      assert.equal((await ctx.api('GET', '/api/panel', { rol: 'secretaria' })).status, 200);
      assert.ok(ctx.repos._bitacora.some(e => e.accion === 'LEER_PANEL' && e.rol === 'secretaria'));
    } finally { await ctx.cerrar(); }
  });

  test('sin bitácora no se devuelven lecturas ni token de desarrollo; se recuperan sin reiniciar', async t => {
    t.mock.method(console, 'error', () => {});
    const ctx = await iniciar();
    try {
      ctx.repos.auditoria.fallar = true;
      for (const ruta of ['/api/panel', '/api/vacunacion/pendientes', '/api/pacientes', '/api/pacientes/P001',
        '/api/pacientes/P001/administrativo', '/api/pacientes/P001/consultas', '/api/pacientes/P001/crecimiento',
        '/api/pacientes/P001/vacunacion', '/api/pacientes/P001/prescripciones', '/api/pacientes/P001/diagnosticos']) {
        const r = await ctx.api('GET', ruta, { rol: 'medico' });
        assert.equal(r.status, 503, ruta);
        assert.equal(r.datos.codigo, 'AUDITORIA_NO_DISPONIBLE');
        assert.deepEqual(Object.keys(r.datos).sort(), ['codigo', 'error']);
      }
      const login = await ctx.api('POST', '/auth/dev-login', { body: { rol: 'medico' } });
      assert.equal(login.status, 503);
      assert.equal(login.datos.token, undefined);
      // La caída de auditoría tampoco convierte una denegación en acceso permitido.
      assert.equal((await ctx.api('GET', '/api/pacientes/P003', { rol: 'medico' })).status, 403);
      assert.equal((await ctx.api('GET', '/api/pacientes/P001', { rol: 'secretaria' })).status, 403);
      ctx.repos.auditoria.fallar = false;
      assert.equal((await ctx.api('GET', '/api/pacientes/P001', { rol: 'medico' })).status, 200);
      assert.ok(ctx.repos._bitacora.some(e => e.accion === 'LEER_HISTORIAL'));
    } finally { await ctx.cerrar(); }
  });
});

describe('Índices indispensables para arrancar', () => {
  const simular = fallar => ({ collection: coleccion => ({
    async createIndex(clave, opciones) {
      if (fallar(coleccion, clave, opciones)) throw Object.assign(new Error('Fallo simulado'), { codeName: 'IndexOptionsConflict' });
      return Object.keys(clave).join('_');
    }
  }) });

  test('cada índice único fallido se trata como esencial, incluido el identificador del outbox', async () => {
    const r = await asegurarIndices(simular((_c, _k, o) => o.unique === true));
    assert.equal(r.filter(x => x.esencial && !x.ok).length, 5);
    assert.throws(() => exigirIndicesEsenciales(r), /bitacora_acceso/);
  });

  test('los fallos de índices de rendimiento no se confunden con pérdida de unicidad', async () => {
    const r = await asegurarIndices(simular((_c, _k, o) => !o.unique));
    assert.ok(r.some(x => !x.ok && !x.esencial));
    assert.doesNotThrow(() => exigirIndicesEsenciales(r));
  });
});
