'use strict';
// API HTTP de la clínica (router real + doble en memoria) detrás del enrutador por institución.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { iniciar, enDias } = require('./helpers');

let ctx;
before(async () => { ctx = await iniciar(); });
after(async () => { await ctx.cerrar(); });

const pacienteBody = (extra = {}) => ({ nombres: 'Ana', apellidos: 'Ficticia', fecha_nacimiento: '1990-01-01', sexo: 'F', ...extra });
async function crear(ruta, rol, body) {
  const r = await ctx.api('POST', ruta, { rol, body });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  return Object.values(r.datos)[0];
}

test('GET /api/sesion cumple el contrato común e informa las piezas FDI', async () => {
  const { status, datos } = await ctx.api('GET', '/api/sesion', { rol: 'odontologo', usuario: 'OD-9' });
  assert.equal(status, 200);
  assert.deepEqual([datos.usuario, datos.institucion, datos.institucion_nombre, datos.motor], ['OD-9', 'clinica_odontologica', 'Clínica Odontológica', 'Cloud Firestore']);
  assert.ok(datos.permisos.includes('clinico.escribir'));
  assert.equal(datos.capacidades.prescripciones, true);
  assert.equal(datos.capacidades.piezas.length, 52);
});

test('exige token válido, de la institución, con rol de la clínica y vigente', async () => {
  const firmar = (payload, opciones = {}) => jwt.sign(payload, process.env.JWT_SECRET,
    { subject: 'U-1', expiresIn: '1h', issuer: 'centro-pediatrico-dev', audience: 'centro-pediatrico-api', ...opciones });
  const casos = [
    [undefined, 401, 'NO_AUTENTICADO'],
    [firmar({ rol: 'odontologo', institucion: 'clinica_odontologica' }, { expiresIn: -10 }), 401, 'TOKEN_EXPIRADO'],
    [firmar({ rol: 'tecnico', institucion: 'laboratorio_clinico' }), 403, 'INSTITUCION_NO_REGISTRADA'],
    [firmar({ rol: 'medico', institucion: 'clinica_odontologica' }), 403, 'INSTITUCION_NO_AUTORIZADA']
  ];
  for (const [bearer, status, codigo] of casos) {
    const r = await ctx.api('GET', '/api/sesion', { bearer });
    assert.deepEqual([r.status, r.datos.codigo], [status, codigo], `${status} ${codigo}`);
  }
});

test('flujo completo por HTTP: paciente, cita, consulta con receta, odontograma y archivo', async () => {
  const pac = await crear('/api/pacientes', 'recepcion', pacienteBody({ documento_identidad: '', contacto: { telefono: '5555-1111' }, antecedentes: { alergias: 'Látex' } }));
  assert.match(pac, /^OD\d{6}$/);
  const cita = await crear('/api/citas', 'recepcion', { id_paciente: pac, id_odontologo: 'col-1', fecha_hora: enDias(2).toISOString(), motivo: 'Dolor' });
  const consulta = await crear(`/api/pacientes/${pac}/consultas`, 'odontologo', {
    id_odontologo: 'COL-1', fecha_hora: new Date(Date.now() - 60e3).toISOString(), motivo: 'Dolor', id_cita: cita,
    diagnosticos: [{ codigo: 'K02.1', descripcion: 'Caries', pieza: '46' }],
    tratamientos: [{ pieza: '46', id_procedimiento: 'd-100' }],
    prescripcion: { medicamentos: [{ nombre: 'Ibuprofeno', dosis: '400 mg', frecuencia: 'Cada 8 h', duracion: '3 días', via_administracion: 'Oral' }] }
  });
  assert.equal((await ctx.api('PUT', `/api/pacientes/${pac}/piezas/46`, { rol: 'odontologo', body: { estado: 'Obturada' } })).datos.estado, 'Obturada');
  await crear(`/api/pacientes/${pac}/consultas/${consulta}/diagnosticos`, 'odontologo', { codigo: 'K05', descripcion: 'Gingivitis' });

  const h = (await ctx.api('GET', `/api/pacientes/${pac}`, { rol: 'odontologo' })).datos;
  assert.equal(h.antecedentes.alergias, 'Látex');
  assert.equal(h.documento_identidad, null);
  assert.equal(h.consultas[0].diagnosticos.length, 2);
  assert.equal(h.citas[0].estado, 'Atendida');
  assert.deepEqual([h.piezas['46'].estado, h.piezas['46'].ultimo_tratamiento.procedimiento], ['Obturada', 'Obturación con resina']);
  assert.equal((await ctx.api('GET', `/api/pacientes/${pac}/prescripciones`, { rol: 'odontologo' })).datos[0].nombre, 'Ibuprofeno');
  assert.equal((await ctx.api('GET', `/api/pacientes/${pac}/administrativo`, { rol: 'recepcion' })).datos.antecedentes, undefined);

  assert.equal((await ctx.api('PATCH', `/api/pacientes/${pac}/archivar`, { rol: 'administrador', body: { motivo_archivado: 'Traslado' } })).datos.estado_historial, 'Archivado');
  const otra = await ctx.api('POST', `/api/pacientes/${pac}/consultas`, { rol: 'odontologo', body: { id_odontologo: 'COL-1', fecha_hora: new Date().toISOString(), motivo: 'x' } });
  assert.deepEqual([otra.status, otra.datos.codigo], [409, 'CONFLICTO']);
  assert.equal((await ctx.api('GET', `/api/pacientes/${pac}`, { rol: 'odontologo' })).status, 403);
});

test('agenda: rango por defecto, cruce de horarios y cambio de estado', async () => {
  const pac = await crear('/api/pacientes', 'recepcion', pacienteBody({ nombres: 'Agenda' }));
  const cuerpo = { id_paciente: pac, id_odontologo: 'COL-2', fecha_hora: enDias(5, 9).toISOString(), duracion_min: 60, motivo: 'Endodoncia' };
  const id = await crear('/api/citas', 'recepcion', cuerpo);
  const choque = await ctx.api('POST', '/api/citas', { rol: 'recepcion', body: { ...cuerpo, fecha_hora: enDias(5, 9).toISOString() } });
  assert.deepEqual([choque.status, choque.datos.codigo], [409, 'CONFLICTO']);
  const agenda = (await ctx.api('GET', '/api/citas', { rol: 'recepcion' })).datos;
  assert.ok(agenda.some(c => c.id_cita === id), 'los próximos 30 días por defecto');
  assert.equal((await ctx.api('PATCH', `/api/citas/${id}/estado`, { rol: 'recepcion', body: { estado: 'Cancelada' } })).datos.estado, 'Cancelada');
  assert.equal((await ctx.api('PATCH', `/api/citas/${id}/estado`, { rol: 'recepcion', body: { estado: 'Programada' } })).status, 400);
});

test('valida la entrada: campos desconocidos, piezas FDI, recetas y fechas', async () => {
  const casos = [
    ['POST', '/api/pacientes', pacienteBody({ extra: 1 })],
    ['POST', '/api/pacientes', pacienteBody({ contacto: { correo: 'no-es-correo' } })],
    ['POST', '/api/pacientes', pacienteBody({ documento_identidad: 'a/b' })],
    ['POST', '/api/pacientes/OD000001/consultas', { id_odontologo: 'COL-1', fecha_hora: new Date().toISOString(), motivo: 'x', diagnosticos: [{ codigo: 'X', descripcion: 'y', pieza: '19' }] }],
    ['POST', '/api/pacientes/OD000001/consultas', { id_odontologo: 'COL-1', fecha_hora: new Date().toISOString(), motivo: 'x', prescripcion: { medicamentos: [] } }],
    ['POST', '/api/pacientes/OD000001/consultas/X/tratamientos', { pieza: '11' }],
    ['GET', '/api/citas?desde=2026-02-01T00:00:00Z&hasta=2026-01-01T00:00:00Z']
  ];
  for (const [metodo, ruta, body] of casos) {
    const r = await ctx.api(metodo, ruta, { rol: ruta === '/api/pacientes' ? 'recepcion' : 'odontologo', body });
    assert.deepEqual([r.status, r.datos.codigo], [400, 'VALIDACION'], `${metodo} ${ruta} ${JSON.stringify(body)}`);
  }
});

test('toda respuesta de error trae { error, codigo } estable', async () => {
  const casos = [
    ['GET', '/api/pacientes/abc!', 'odontologo', 400, 'VALIDACION'],
    ['GET', '/api/pacientes/OD999999', 'odontologo', 404, 'NO_ENCONTRADO'],
    ['GET', '/api/no-existe', 'odontologo', 404, 'RUTA_NO_ENCONTRADA'],
    ['POST', '/api/odontologos', 'recepcion', 403, 'ROL_SIN_PERMISO'],
    ['POST', '/api/odontologos', 'administrador', 409, 'CONFLICTO']
  ];
  for (const [metodo, ruta, rol, status, codigo] of casos) {
    const r = await ctx.api(metodo, ruta, { rol, body: metodo === 'POST' ? { colegiado: 'COL-1', nombres: 'X', apellidos: 'Y' } : undefined });
    assert.deepEqual([r.status, r.datos.codigo], [status, codigo], `${metodo} ${ruta}`);
    assert.equal(typeof r.datos.error, 'string');
  }
});

test('los accesos denegados quedan en la bitácora', async () => {
  await ctx.api('PATCH', '/api/pacientes/OD000001/archivar', { rol: 'odontologo', usuario: 'OD-DENEGADO', body: { motivo_archivado: 'x' } });
  const eventos = (await ctx.api('GET', '/api/auditoria?accion=ACCESO_DENEGADO&limite=500', { rol: 'administrador' })).datos;
  const e = eventos.find(x => x.usuario === 'OD-DENEGADO');
  assert.deepEqual([e.resultado, e.id_paciente], ['DENEGADO', 'OD000001']);
});
