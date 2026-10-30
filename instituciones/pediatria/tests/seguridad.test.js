'use strict';
// Seguridad y reglas de Fase II sobre la API HTTP (doble en memoria).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { iniciar, token } = require('./helpers');
const { autenticarPeticion } = require('../backend/security');

const conToken = t => ({ headers: { Authorization: `Bearer ${t}` } });
const firmar = (payload, opciones = {}) => jwt.sign(payload, process.env.JWT_SECRET, {
  algorithm: 'HS256', subject: 'X', expiresIn: '5m', issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE, ...opciones
});

describe('Tokens JWT', () => {
  let ctx;
  before(async () => { ctx = await iniciar(); });
  after(async () => { await ctx.cerrar(); });

  test('rechaza alg none, sin expiración, emisor o audiencia ajenos y token alterado', async () => {
    const pedir = t => ctx.api('GET', '/api/medicos', conToken(t));
    const sinFirma = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'X', rol: 'administrador', institucion: 'centro_pediatrico', exp: 9999999999 })).toString('base64url')}.`;
    assert.equal((await pedir(sinFirma)).status, 401);
    const sinExp = jwt.sign({ rol: 'medico', institucion: 'centro_pediatrico', sub: 'X' }, process.env.JWT_SECRET,
      { algorithm: 'HS256', issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE });
    assert.equal((await pedir(sinExp)).status, 401);
    assert.equal((await pedir(firmar({ rol: 'medico', institucion: 'centro_pediatrico' }, { issuer: 'otro' }))).status, 401);
    assert.equal((await pedir(firmar({ rol: 'medico', institucion: 'centro_pediatrico' }, { audience: 'otra' }))).status, 401);
    const valido = token('medico');
    const [h, , f] = valido.split('.');
    const escalado = Buffer.from(JSON.stringify({ ...jwt.decode(valido), rol: 'administrador' })).toString('base64url');
    assert.equal((await pedir(`${h}.${escalado}.${f}`)).status, 401, 'cambiar el rol invalida la firma');
    assert.equal((await pedir('x'.repeat(5000))).status, 401);
    assert.equal((await pedir(valido)).status, 200);
  });

  test('el inicio de sesión de desarrollo valida rol y usuario', async () => {
    assert.equal((await ctx.api('POST', '/auth/dev-login', { body: { rol: 'administrador', usuario: 'a b' } })).status, 400);
    assert.equal((await ctx.api('POST', '/auth/dev-login', { body: { rol: 'medico', extra: 1 } })).status, 400);
    const previo = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = '';
      const r = autenticarPeticion({ headers: {} });
      assert.equal(r.status, 503);
      assert.equal(r.cuerpo.codigo, 'AUTENTICACION_NO_DISPONIBLE');
    } finally { process.env.JWT_SECRET = previo; }
  });
});

describe('Protección de datos personales y clínicos', () => {
  let ctx;
  before(async () => { ctx = await iniciar(); });
  after(async () => { await ctx.cerrar(); });

  test('el médico ve el DPI del tutor enmascarado; secretaría y administración lo ven completo', async () => {
    const medico = await ctx.api('GET', '/api/pacientes/P001', { rol: 'medico' });
    assert.equal(medico.datos.tutores[0].dpi, '•••-T-1');
    const adm = await ctx.api('GET', '/api/pacientes/P001/administrativo', { rol: 'medico' });
    assert.equal(adm.datos.tutores[0].dpi, '•••-T-1');
    assert.equal((await ctx.api('GET', '/api/pacientes/P001/administrativo', { rol: 'secretaria' })).datos.tutores[0].dpi, 'DPI-T-1');
    assert.equal((await ctx.api('GET', '/api/pacientes/P001', { rol: 'administrador' })).datos.tutores[0].dpi, 'DPI-T-1');
  });

  test('solo los roles administrativos pueden buscar por DPI', async () => {
    const porDpi = rol => ctx.api('GET', '/api/pacientes?q=DPI-T-1', { rol });
    assert.deepEqual((await porDpi('secretaria')).datos.items.map(p => p.id_paciente), ['P001']);
    assert.equal((await porDpi('medico')).datos.items.length, 0);
  });

  test('la secretaría no accede a ninguna ruta clínica', async () => {
    for (const ruta of ['/api/pacientes/P001', '/api/pacientes/P001/consultas', '/api/pacientes/P001/crecimiento',
      '/api/pacientes/P001/vacunacion', '/api/pacientes/P001/prescripciones', '/api/pacientes/P001/diagnosticos',
      '/api/vacunacion/pendientes', '/api/auditoria']) {
      assert.equal((await ctx.api('GET', ruta, { rol: 'secretaria' })).status, 403, ruta);
    }
  });

  test('errores internos no revelan detalles y los parámetros malformados se rechazan', async () => {
    const r = await ctx.api('GET', '/api/pacientes?limite=99999', { rol: 'medico' });
    assert.equal(r.status, 400);
    assert.equal((await ctx.api('GET', '/api/pacientes?pagina=-1', { rol: 'medico' })).status, 400);
    assert.equal((await ctx.api('GET', '/api/pacientes?estado=Todos&estado=Activo', { rol: 'administrador' })).status, 400);
    assert.equal((await ctx.api('POST', '/api/pacientes/P001/consultas', { rol: 'medico', raw: '[1,2]' })).status, 400);
  });
});

describe('Reglas de Fase II', () => {
  test('perímetro cefálico opcional cuando el validador lo permite y obligatorio si no', async () => {
    for (const perimetroOpcional of [true, false]) {
      const ctx = await iniciar({ perimetroOpcional });
      try {
        const ses = await ctx.api('GET', '/api/sesion', { rol: 'medico' });
        assert.equal(ses.datos.capacidades.perimetro_cefalico_opcional, perimetroOpcional);
        const r = await ctx.api('POST', '/api/pacientes/P001/crecimiento', { rol: 'medico', body: { id_consulta: 'C001', peso_kg: 12, talla_cm: 85 } });
        assert.equal(r.status, perimetroOpcional ? 201 : 400);
        if (!perimetroOpcional) assert.match(r.datos.error, /validador/);
        const conPerimetro = await ctx.api('POST', '/api/pacientes/P001/crecimiento', { rol: 'medico', body: { id_consulta: 'C001', peso_kg: 12, talla_cm: 85, perimetro_cefalico_cm: 47 } });
        assert.equal(conPerimetro.status, 201);
      } finally { await ctx.cerrar(); }
    }
  });

  test('actualizar un tratamiento conserva la versión anterior', async () => {
    const ctx = await iniciar();
    try {
      const ruta = '/api/pacientes/P001/consultas/C001/tratamiento';
      assert.equal((await ctx.api('PUT', ruta, { rol: 'medico', body: { descripcion: 'Primera' } })).status, 200);
      assert.equal((await ctx.api('PUT', ruta, { rol: 'medico', body: { descripcion: 'Segunda', recomendaciones: 'R' } })).status, 200);
      const [c] = (await ctx.api('GET', '/api/pacientes/P001/consultas', { rol: 'medico' })).datos;
      assert.equal(c.tratamiento.descripcion, 'Segunda');
      assert.deepEqual(c.tratamientos_anteriores.map(t => t.descripcion), ['Primera']);
      assert.ok(c.tratamientos_anteriores[0].reemplazado_por.fecha);
    } finally { await ctx.cerrar(); }
  });

  test('un evento que no pudo escribirse en la bitácora se entrega al consultar la auditoría', async () => {
    const ctx = await iniciar();
    try {
      ctx.repos.auditoria.fallar = true;
      const r = await ctx.api('POST', '/api/pacientes/P001/consultas', { rol: 'medico', body: { id_medico: 'M001', fecha_hora: '2026-02-01T10:00:00Z', motivo: 'Pendiente' } });
      ctx.repos.auditoria.fallar = false;
      assert.equal(r.status, 201);
      assert.equal(ctx.repos._pendientes.length, 1);
      const aud = await ctx.api('GET', '/api/auditoria?accion=REGISTRAR_CONSULTA', { rol: 'administrador' });
      assert.equal(aud.datos.length, 1);
      assert.ok(aud.datos[0].id_evento);
      assert.equal(ctx.repos._pendientes.length, 0);
    } finally { await ctx.cerrar(); }
  });
});
