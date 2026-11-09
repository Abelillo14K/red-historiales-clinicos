'use strict';
// API HTTP del laboratorio (router real + doble en memoria) detrás del enrutador por institución.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { iniciar } = require('./helpers');

let ctx;
before(async () => { ctx = await iniciar(); });
after(async () => { await ctx.cerrar(); });

const pacienteBody = (extra = {}) => ({ nombres: 'Ana', apellidos: 'Ficticia', fecha_nacimiento: '1990-01-01', sexo: 'F', ...extra });
async function crear(ruta, rol, body) {
  const r = await ctx.api('POST', ruta, { rol, body });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  return Object.values(r.datos)[0];
}

test('GET /api/sesion cumple el contrato común', async () => {
  const { status, datos } = await ctx.api('GET', '/api/sesion', { rol: 'tecnico', usuario: 'TEC-9' });
  assert.equal(status, 200);
  assert.equal(datos.usuario, 'TEC-9');
  assert.equal(datos.institucion, 'laboratorio_clinico');
  assert.equal(datos.institucion_nombre, 'Laboratorio Clínico');
  assert.equal(datos.motor, 'PostgreSQL');
  assert.ok(datos.permisos.includes('laboratorio.resultados.registrar'));
  assert.ok(Date.parse(datos.expira) > Date.now());
  assert.deepEqual(datos.capacidades, { prescripciones: false });
});

test('exige token válido, de la institución, con rol del laboratorio y vigente', async () => {
  const firmar = (payload, opciones = {}) => jwt.sign(payload, process.env.JWT_SECRET,
    { subject: 'U-1', expiresIn: '1h', issuer: 'centro-pediatrico-dev', audience: 'centro-pediatrico-api', ...opciones });
  const casos = [
    [undefined, 401, 'NO_AUTENTICADO'],
    ['token.no.valido.abcdefghijklmnop', 401, 'TOKEN_INVALIDO'],
    [firmar({ rol: 'tecnico', institucion: 'laboratorio_clinico' }, { expiresIn: -10 }), 401, 'TOKEN_EXPIRADO'],
    [firmar({ rol: 'tecnico', institucion: 'laboratorio_clinico' }, { audience: 'otra-api' }), 401, 'TOKEN_INVALIDO'],
    [firmar({ rol: 'medico', institucion: 'centro_pediatrico' }), 403, 'INSTITUCION_NO_REGISTRADA'],
    [firmar({ rol: 'medico', institucion: 'laboratorio_clinico' }), 403, 'INSTITUCION_NO_AUTORIZADA']
  ];
  for (const [bearer, status, codigo] of casos) {
    const r = await ctx.api('GET', '/api/sesion', { bearer });
    assert.deepEqual([r.status, r.datos.codigo], [status, codigo], `${status} ${codigo}`);
  }
});

test('flujo completo por HTTP: paciente, solicitud, resultado, validación y archivo', async () => {
  const { id_tipo_examen, numerico, texto } = ctx.catalogo;
  const pac = await crear('/api/pacientes', 'recepcion', pacienteBody({ documento_identidad: '' }));
  const sol = await crear(`/api/pacientes/${pac}/solicitudes`, 'recepcion', { prioridad: 'Urgente', examenes: [{ id_tipo_examen, codigo_muestra: 'HTTP-1' }] });
  const ex = (await ctx.api('GET', `/api/solicitudes/${sol}`, { rol: 'tecnico' })).datos.examenes[0].id_examen;

  const reg = await ctx.api('PUT', `/api/examenes/${ex}/resultado`, { rol: 'tecnico', body: { valores: [{ id_parametro: numerico, valor: 25 }, { id_parametro: texto, valor: 'Normal' }] } });
  assert.equal(reg.status, 200);
  assert.equal(reg.datos.fuera_de_rango, 1);
  const recepcion = (await ctx.api('GET', `/api/solicitudes/${sol}`, { rol: 'recepcion' })).datos;
  assert.deepEqual(recepcion.examenes[0].resultado, { estado: 'Preliminar' }, 'recepción no ve valores');

  const val = await ctx.api('PATCH', `/api/resultados/${reg.datos.id_resultado}/validar`, { rol: 'bioquimico', usuario: 'BIOQUIMICO-1' });
  assert.deepEqual(val.datos, { id_resultado: reg.datos.id_resultado, estado: 'Validado' });
  const detalle = (await ctx.api('GET', `/api/resultados/${reg.datos.id_resultado}`, { rol: 'tecnico' })).datos;
  assert.equal(detalle.detalles.find(d => d.id_parametro === numerico).fuera_de_rango, true);

  const historial = (await ctx.api('GET', `/api/pacientes/${pac}`, { rol: 'tecnico' })).datos;
  assert.equal(historial.solicitudes[0].estado, 'Completada');
  assert.equal(historial.documento_identidad, null);

  assert.equal((await ctx.api('PATCH', `/api/pacientes/${pac}/archivar`, { rol: 'administrador', body: { motivo_archivado: 'Traslado' } })).datos.estado_historial, 'Archivado');
  const otra = await ctx.api('POST', `/api/pacientes/${pac}/solicitudes`, { rol: 'recepcion', body: { examenes: [{ id_tipo_examen }] } });
  assert.deepEqual([otra.status, otra.datos.codigo], [409, 'CONFLICTO']);
  assert.equal((await ctx.api('GET', `/api/pacientes/${pac}`, { rol: 'tecnico' })).status, 403);
});

test('listados paginados con { items, total }', async () => {
  await crear('/api/pacientes', 'recepcion', pacienteBody({ nombres: 'Listado', apellidos: 'Uno' }));
  await crear('/api/pacientes', 'recepcion', pacienteBody({ nombres: 'Listado', apellidos: 'Dos' }));
  const r = await ctx.api('GET', '/api/pacientes?q=listado&limite=1&pagina=2', { rol: 'recepcion' });
  assert.equal(r.datos.total, 2);
  assert.equal(r.datos.items.length, 1);
  assert.deepEqual([r.datos.pagina, r.datos.limite], [2, 1]);
  for (const ruta of ['/api/solicitudes', '/api/resultados']) {
    const x = await ctx.api('GET', ruta, { rol: 'tecnico' });
    assert.ok(Array.isArray(x.datos.items) && typeof x.datos.total === 'number', ruta);
  }
});

test('valida la entrada: campos desconocidos, formatos, rangos y fechas', async () => {
  const casos = [
    ['POST', '/api/pacientes', pacienteBody({ extra: 1 })],
    ['POST', '/api/pacientes', pacienteBody({ fecha_nacimiento: '01/01/1990' })],
    ['POST', '/api/pacientes', pacienteBody({ sexo: 'X' })],
    ['POST', '/api/pacientes', pacienteBody({ correo: 'no-es-correo' })],
    ['GET', '/api/pacientes?limite=1000'],
    ['GET', '/api/pacientes?estado=Borrado'],
    ['POST', '/api/pacientes/1/solicitudes', { examenes: [] }],
    ['POST', '/api/pacientes/1/solicitudes', { examenes: [{ id_tipo_examen: 'abc' }] }],
    ['POST', '/api/pacientes/1/solicitudes', { prioridad: 'Normal', examenes: [{ id_tipo_examen: '1' }] }]
  ];
  for (const [metodo, ruta, body] of casos) {
    const r = await ctx.api(metodo, ruta, { rol: 'recepcion', body });
    assert.deepEqual([r.status, r.datos.codigo], [400, 'VALIDACION'], `${metodo} ${ruta} ${JSON.stringify(body)}`);
    if (body) assert.ok(r.datos.detalles?.length, 'trae detalles por campo');
  }
  const rango = await ctx.api('POST', '/api/tipos-examen', { rol: 'administrador', body: {
    nombre: 'Rango malo', categoria: 'X', id_tipo_muestra: ctx.catalogo.id_tipo_muestra, tiempo_entrega_horas: 1, precio: 1,
    parametros: [{ id_parametro: ctx.catalogo.numerico, valor_ref_min: 5, valor_ref_max: 1, orden_presentacion: 1 }]
  } });
  assert.equal(rango.datos.detalles[0].campo, 'parametros.0.valor_ref_min');
});

test('toda respuesta de error trae { error, codigo } estable y sin detalles internos', async () => {
  const casos = [
    ['GET', '/api/pacientes/abc!', 'tecnico', 400, 'VALIDACION'],
    ['GET', '/api/pacientes/999999', 'tecnico', 404, 'NO_ENCONTRADO'],
    ['GET', '/api/resultados/999999', 'tecnico', 404, 'NO_ENCONTRADO'],
    ['GET', '/api/no-existe', 'tecnico', 404, 'RUTA_NO_ENCONTRADA'],
    ['POST', '/api/tipos-muestra', 'tecnico', 403, 'ROL_SIN_PERMISO']
  ];
  for (const [metodo, ruta, rol, status, codigo] of casos) {
    const r = await ctx.api(metodo, ruta, { rol, body: metodo === 'POST' ? { nombre: 'X' } : undefined });
    assert.deepEqual([r.status, r.datos.codigo], [status, codigo], `${metodo} ${ruta}`);
    assert.equal(typeof r.datos.error, 'string');
    assert.ok(!JSON.stringify(r.datos).match(/laboratorio\.|SELECT|stack/i), 'no filtra SQL ni trazas');
  }
});

test('los accesos denegados quedan en la bitácora y solo el administrador la consulta', async () => {
  await ctx.api('PATCH', '/api/pacientes/1/archivar', { rol: 'tecnico', usuario: 'TEC-DENEGADO', body: { motivo_archivado: 'x' } });
  assert.equal((await ctx.api('GET', '/api/auditoria', { rol: 'tecnico' })).datos.codigo, 'ROL_SIN_PERMISO');
  const eventos = (await ctx.api('GET', '/api/auditoria?accion=ACCESO_DENEGADO&limite=500', { rol: 'administrador' })).datos;
  const e = eventos.find(x => x.usuario === 'TEC-DENEGADO');
  assert.equal(e.resultado, 'DENEGADO');
  assert.equal(e.id_paciente, '1');
  assert.match(e.detalle, /PATCH \/api\/pacientes\/1\/archivar/);
});

test('catálogos: listar con catalogos.ver y crear con catalogos.editar', async () => {
  for (const ruta of ['/api/tipos-muestra', '/api/parametros', '/api/tipos-examen', '/api/medicos', '/api/personal']) {
    const r = await ctx.api('GET', ruta, { rol: 'recepcion' });
    assert.equal(r.status, 200, ruta);
    assert.ok(r.datos.length >= 1, ruta);
  }
  const t = (await ctx.api('GET', `/api/tipos-examen/${ctx.catalogo.id_tipo_examen}`, { rol: 'tecnico' })).datos;
  assert.equal(t.parametros.length, 2);
  assert.equal((await ctx.api('POST', '/api/medicos', { rol: 'recepcion', body: { nombre_completo: 'X', numero_colegiado: 'C-9' } })).status, 403);
  assert.equal((await ctx.api('POST', '/api/medicos', { rol: 'administrador', body: { nombre_completo: 'Médico Nuevo', numero_colegiado: 'C-9' } })).status, 201);
});
