'use strict';
// Enrutamiento por usuario: la institución del token decide el módulo (y el motor).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { token, iniciar } = require('./helpers');
const { crearEnrutadorInstituciones } = require('../backend/app');

// Módulos ficticios: solo registran qué institución/motor atendió la petición.
function moduloFalso(nombre) {
  const r = express.Router();
  r.get('/quien', (req, res) => res.json({ modulo: nombre, ...req.modulo }));
  return r;
}

async function servidor(app) {
  const s = await new Promise(resolve => { const x = app.listen(0, '127.0.0.1', () => resolve(x)); });
  return { base: `http://127.0.0.1:${s.address().port}`, cerrar: () => new Promise(r => s.close(r)) };
}

test('despacha cada usuario al módulo de su institución sin cambiar la lógica', async () => {
  const app = express();
  app.use('/api', crearEnrutadorInstituciones({
    centro_pediatrico: { nombre: 'Centro Médico Pediátrico', motor: 'MongoDB', router: moduloFalso('pediatria') },
    hospital_general: { motor: 'OtroMotor', router: moduloFalso('hospital') }
  }));
  const { base, cerrar } = await servidor(app);
  try {
    const pedir = inst => fetch(`${base}/api/quien`, { headers: { Authorization: `Bearer ${token('medico', { institucion: inst })}` } });
    assert.deepEqual(await (await pedir('centro_pediatrico')).json(), { modulo: 'pediatria', institucion: 'centro_pediatrico', nombre: 'Centro Médico Pediátrico', motor: 'MongoDB' });
    assert.deepEqual(await (await pedir('hospital_general')).json(), { modulo: 'hospital', institucion: 'hospital_general', nombre: 'hospital_general', motor: 'OtroMotor' });
    const ajena = await pedir('laboratorio_clinico');
    assert.equal(ajena.status, 403);
    assert.equal((await ajena.json()).codigo, 'INSTITUCION_NO_REGISTRADA');
    // Una clave heredada de Object.prototype no debe tratarse como institución registrada.
    assert.equal((await pedir('constructor')).status, 403);
    assert.equal((await fetch(`${base}/api/quien`)).status, 401);
  } finally { await cerrar(); }
});

test('la API pediátrica informa institución y motor en la sesión', async () => {
  const ctx = await iniciar();
  try {
    const ses = await ctx.api('GET', '/api/sesion', { rol: 'medico' });
    assert.equal(ses.datos.institucion, 'centro_pediatrico');
    assert.equal(ses.datos.motor, 'MongoDB');
    const otra = await ctx.api('GET', '/api/pacientes', { headers: { Authorization: `Bearer ${token('medico', { institucion: 'hospital_general' })}` } });
    assert.equal(otra.datos.codigo, 'INSTITUCION_NO_REGISTRADA');
  } finally { await ctx.cerrar(); }
});

test('historial de consultas filtrado por rango de fechas', async () => {
  const ctx = await iniciar();
  try {
    const crear = (fecha_hora, motivo) => ctx.api('POST', '/api/pacientes/P001/consultas',
      { rol: 'medico', body: { id_medico: 'M001', fecha_hora, motivo } });
    assert.equal((await crear('2026-03-05T10:00:00Z', 'Consulta de marzo')).status, 201);
    assert.equal((await crear('2026-04-20T10:00:00Z', 'Consulta de abril')).status, 201);
    const rango = await ctx.api('GET', '/api/pacientes/P001/consultas?desde=2026-03-01T00:00:00Z&hasta=2026-03-31T23:59:59Z', { rol: 'medico' });
    assert.equal(rango.status, 200);
    assert.deepEqual(rango.datos.map(c => c.motivo), ['Consulta de marzo']);
    const desde = await ctx.api('GET', '/api/pacientes/P001/consultas?desde=2026-03-01T00:00:00Z', { rol: 'medico' });
    assert.deepEqual(desde.datos.map(c => c.motivo), ['Consulta de abril', 'Consulta de marzo']);
    assert.equal((await ctx.api('GET', '/api/pacientes/P001/consultas', { rol: 'medico' })).datos.length, 3);
    const invertido = await ctx.api('GET', '/api/pacientes/P001/consultas?desde=2026-05-01T00:00:00Z&hasta=2026-01-01T00:00:00Z', { rol: 'medico' });
    assert.equal(invertido.status, 400);
    assert.equal((await ctx.api('GET', '/api/pacientes/P001/consultas?desde=ayer', { rol: 'medico' })).status, 400);
  } finally { await ctx.cerrar(); }
});
