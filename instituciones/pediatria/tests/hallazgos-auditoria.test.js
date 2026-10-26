'use strict';
// Regresión de los cinco hallazgos de la auditoría técnica (24/10/2026), sobre el
// doble en memoria. Las variantes con MongoDB real están en mongo.integration.test.js.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { iniciar, fixtures } = require('./helpers');
const { crearApp } = require('../backend/app');
const { crearServicios } = require('../backend/application');
const { crearRepositoriosMemoria } = require('./doubles/memoria');

const nuevoPaciente = (extra = {}) => ({
  nombres: 'Concurrente', apellidos: 'Ficticio', fecha_nacimiento: '2024-01-01', sexo: 'M',
  tutores: [{ dpi: 'DPI-CONC-1', nombres: 'Tutor', apellidos: 'Ficticio', parentesco: 'Padre', es_principal: true }],
  ...extra
});
const SEC = { id: 'USR-secretaria', rol: 'secretaria' };
const medicamento = { nombre: 'Ficticio', dosis: 'N/A', frecuencia: 'N/A', duracion: 'N/A', via_administracion: 'N/A' };

describe('Hallazgo 1: /auth/dev-login solo desde el propio equipo', () => {
  let ctx;
  before(async () => { ctx = await iniciar(); });
  after(async () => { await ctx.cerrar(); });

  test('la demo local sigue obteniendo token', async () => {
    const r = await ctx.api('POST', '/auth/dev-login', { body: { rol: 'administrador' } });
    assert.equal(r.status, 200);
    assert.ok(r.datos.token);
    assert.equal((await ctx.api('GET', '/auth/config')).datos.dev_login, true);
  });

  test('un cliente remoto detrás de un proxy local no obtiene token ni ve el acceso', async () => {
    // trust proxy 'loopback': req.ip toma X-Forwarded-For solo si el par inmediato es local.
    const remoto = { headers: { 'X-Forwarded-For': '192.168.1.50' } };
    const r = await ctx.api('POST', '/auth/dev-login', { ...remoto, body: { rol: 'administrador' } });
    assert.equal(r.status, 403);
    assert.equal(r.datos.token, undefined);
    assert.equal((await ctx.api('GET', '/auth/config', remoto)).datos.dev_login, false);
  });

  const ipLan = Object.values(os.networkInterfaces()).flat()
    .find(i => i && i.family === 'IPv4' && !i.internal)?.address;
  test('una conexión real por la interfaz de red del equipo no obtiene token', { skip: ipLan ? false : 'sin interfaz IPv4 externa' }, async () => {
    const app = crearApp(crearServicios(crearRepositoriosMemoria()), { frontendDist: null });
    const server = await new Promise(r => { const s = app.listen(0, '0.0.0.0', () => r(s)); });
    try {
      const res = await fetch(`http://${ipLan}:${server.address().port}/auth/dev-login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rol: 'administrador' })
      });
      assert.equal(res.status, 403);
    } finally { await new Promise(r => server.close(r)); }
  });
});

describe('Hallazgo 2: altas concurrentes del mismo paciente', () => {
  // Por HTTP el doble en memoria termina cada alta antes de leer la siguiente
  // petición; llamando al caso de uso en paralelo se intercalan como con MongoDB.
  test('cinco altas simultáneas con los mismos datos crean un solo paciente', async () => {
    const repos = crearRepositoriosMemoria(fixtures());
    const S = crearServicios(repos);
    const datos = () => ({ ...nuevoPaciente(), fecha_nacimiento: new Date('2024-01-01T00:00:00Z') });
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => S.pacientes.registrar(SEC, datos())));
    assert.deepEqual(r.map(x => x.status).sort(), ['fulfilled', 'rejected', 'rejected', 'rejected', 'rejected']);
    assert.ok(r.filter(x => x.status === 'rejected').every(x => x.reason.status === 409));
    assert.equal([...repos._pacientes.values()].filter(p => p.nombres === 'Concurrente').length, 1);
  });

  test('la comparación ignora mayúsculas como buscarDuplicado', async () => {
    const S = crearServicios(crearRepositoriosMemoria(fixtures()));
    const datos = nombres => ({ ...nuevoPaciente({ nombres }), fecha_nacimiento: new Date('2024-01-01T00:00:00Z') });
    const r = await Promise.allSettled([S.pacientes.registrar(SEC, datos('Concurrente')), S.pacientes.registrar(SEC, datos('CONCURRENTE'))]);
    assert.deepEqual(r.map(x => x.status).sort(), ['fulfilled', 'rejected']);
  });

  test('altas simultáneas de pacientes distintos siguen funcionando', async () => {
    const ctx = await iniciar();
    try {
      const r = await Promise.all(['Uno', 'Dos', 'Tres'].map(n =>
        ctx.api('POST', '/api/pacientes', { rol: 'secretaria', body: nuevoPaciente({ nombres: n }) })));
      assert.deepEqual(r.map(x => x.status), [201, 201, 201]);
      assert.equal(new Set(r.map(x => x.datos.id_paciente)).size, 3);
    } finally { await ctx.cerrar(); }
  });
});

describe('Hallazgo 3: fecha de nacimiento frente a la vacunación registrada', () => {
  let ctx, id;
  before(async () => {
    ctx = await iniciar();
    id = (await ctx.api('POST', '/api/pacientes', { rol: 'secretaria', body: nuevoPaciente({ nombres: 'Vacunado' }) })).datos.id_paciente;
    const prog = await ctx.api('POST', `/api/pacientes/${id}/vacunacion`, { rol: 'medico', body: { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: '2024-03-01T00:00:00Z' } });
    assert.equal(prog.status, 201);
    const ap = await ctx.api('PATCH', `/api/pacientes/${id}/vacunacion/${prog.datos.id_esquema}/aplicar`, { rol: 'medico', body: { fecha_aplicacion: '2024-03-02T10:00:00Z', lote: 'L-1', id_medico: 'M001' } });
    assert.equal(ap.status, 200);
    await ctx.api('POST', `/api/pacientes/${id}/vacunacion`, { rol: 'medico', body: { id_vacuna: 'V002', numero_dosis: 1, fecha_programada: '2024-09-01T00:00:00Z' } });
  });
  after(async () => { await ctx.cerrar(); });
  const cambiar = fecha => ctx.api('PATCH', `/api/pacientes/${id}`, { rol: 'secretaria', body: { fecha_nacimiento: fecha } });

  test('rechaza una fecha posterior a una dosis aplicada', async () => {
    const r = await cambiar('2024-03-02');
    assert.equal(r.status, 400);
    assert.match(r.datos.error, /vacunaci/);
  });

  test('rechaza una fecha posterior a una dosis programada', async () => {
    assert.equal((await cambiar('2024-08-01')).status, 400);
  });

  test('admite una fecha anterior a todos los registros', async () => {
    assert.equal((await cambiar('2023-12-15')).status, 200);
    assert.equal(+ctx.repos._pacientes.get(id).fecha_nacimiento, +new Date('2023-12-15T00:00:00Z'));
  });
});

describe('Hallazgo 4: regla temporal de prescripciones', () => {
  let ctx;
  before(async () => { ctx = await iniciar(); });
  after(async () => { await ctx.cerrar(); });
  const consulta = prescripciones => ({ id_medico: 'M001', fecha_hora: '2026-02-10T15:00:00Z', motivo: 'Control', prescripciones });

  test('al crear la consulta, una receta anterior a la consulta se rechaza', async () => {
    const r = await ctx.api('POST', '/api/pacientes/P001/consultas', {
      rol: 'medico', body: consulta([{ fecha_emision: '2026-02-09T15:00:00Z', medicamentos: [medicamento] }])
    });
    assert.equal(r.status, 400);
    assert.match(r.datos.error, /anterior a la consulta/);
  });

  test('al agregar la receta después, se aplica la misma regla', async () => {
    const r = await ctx.api('POST', '/api/pacientes/P001/consultas/C001/prescripciones', {
      rol: 'medico', body: { fecha_emision: '2026-01-09T15:00:00Z', medicamentos: [medicamento] }
    });
    assert.equal(r.status, 400);
    assert.match(r.datos.error, /anterior a la consulta/);
  });

  test('recetas en la fecha de la consulta o después se aceptan en ambos casos', async () => {
    const c = await ctx.api('POST', '/api/pacientes/P001/consultas', {
      rol: 'medico', body: consulta([{ medicamentos: [medicamento] }, { fecha_emision: '2026-02-10T16:00:00Z', medicamentos: [medicamento] }])
    });
    assert.equal(c.status, 201);
    const rx = await ctx.api('POST', `/api/pacientes/P001/consultas/${c.datos.id_consulta}/prescripciones`, {
      rol: 'medico', body: { fecha_emision: '2026-02-10T15:00:00Z', medicamentos: [medicamento] }
    });
    assert.equal(rx.status, 201);
  });
});

// La garantía real (alta revertida si la bitácora falla) se comprueba con el
// replica set desechable en mongo.integration.test.js.
describe('Hallazgo 5: altas de catálogo y su evento de auditoría', () => {
  const ADM = { id: 'USR-administrador', rol: 'administrador' };
  const medico = { id_medico: 'M010', colegiado: 'COL-T10', nombres: 'Nuevo', apellidos: 'Ficticio', especialidad: { id_especialidad: 'E001', nombre: 'Pediatría General' } };

  test('el alta y su evento pasan juntos por la unidad de trabajo', async () => {
    const repos = crearRepositoriosMemoria(fixtures());
    const eventos = [];
    const ejecutar = repos.unidad.ejecutar.bind(repos.unidad);
    repos.unidad.ejecutar = (fn, evento) => { eventos.push(evento?.accion); return ejecutar(fn, evento); };
    const S = crearServicios(repos);
    await S.catalogos.crearMedico(ADM, medico);
    await S.catalogos.crearVacuna(ADM, { id_vacuna: 'V010', nombre: 'Vacuna ficticia C' });
    assert.deepEqual(eventos, ['CREAR_MEDICO', 'CREAR_VACUNA']);
    assert.deepEqual(repos._bitacora.map(e => [e.accion, e.referencia, e.recurso]),
      [['CREAR_MEDICO', 'M010', 'medicos'], ['CREAR_VACUNA', 'V010', 'vacunas']]);
  });

  test('un alta rechazada no deja evento de éxito', async () => {
    const repos = crearRepositoriosMemoria(fixtures());
    const S = crearServicios(repos);
    await assert.rejects(S.catalogos.crearMedico(ADM, { ...medico, id_medico: 'M001' }), { status: 409 });
    assert.equal(repos._bitacora.filter(e => e.accion === 'CREAR_MEDICO').length, 0);
  });
});
