'use strict';
// Comunicación frontend-backend: el cliente HTTP común (plataforma/api/http.js) y la API del
// módulo pediátrico (instituciones/pediatria/frontend/api.js) que usa React, contra la API Express real.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { iniciar } = require('../instituciones/pediatria/tests/helpers');

let ctx, crearCliente, ApiError;
const ruta = r => pathToFileURL(path.join(__dirname, '..', 'apps', 'web', 'src', r)).href;
before(async () => {
  ctx = await iniciar();
  const http = await import(ruta('plataforma/api/http.js'));
  const { crearApiPediatria } = await import(pathToFileURL(path.join(__dirname, '..', 'instituciones', 'pediatria', 'frontend', 'api.js')).href);
  ApiError = http.ApiError;
  // Mismo ensamblado que SesionContext: cliente común + endpoints de plataforma + API del módulo.
  crearCliente = opciones => {
    const h = http.crearHttp(opciones);
    return { ...crearApiPediatria(h), auth: http.crearApiPlataforma(h) };
  };
});
after(async () => { await ctx.cerrar(); });

async function sesion(rol) {
  const anon = crearCliente({ base: ctx.base });
  const { token } = await anon.auth.devLogin(rol, `CLIENTE-${rol}`);
  return crearCliente({ base: ctx.base, obtenerToken: () => token });
}

test('el cliente completa el flujo clínico de la interfaz', async () => {
  const secretaria = await sesion('secretaria');
  const medico = await sesion('medico');
  const { id_paciente } = await secretaria.pacientes.crear({
    nombres: 'Cliente', apellidos: 'Frontend', fecha_nacimiento: '2024-01-01', sexo: 'M',
    tutores: [{ dpi: 'DPI-CLI', nombres: 'Tutor', apellidos: 'Cliente', parentesco: 'Padre', es_principal: true }]
  });
  const lista = await secretaria.pacientes.listar({ q: 'Frontend', limite: 20, pagina: 1, sexo: undefined });
  assert.equal(lista.items[0].id_paciente, id_paciente);

  const { id_consulta } = await medico.consultas.crear(id_paciente, {
    id_medico: 'M001', fecha_hora: '2026-02-01T10:00:00.000Z', motivo: 'Desde el cliente', diagnosticos: [], prescripciones: [],
    control_crecimiento: { peso_kg: 9.1, talla_cm: 75, perimetro_cefalico_cm: 45 }
  });
  await medico.consultas.agregarPrescripcion(id_paciente, id_consulta, {
    medicamentos: [{ nombre: 'Ficticio', dosis: 'N/A', frecuencia: 'N/A', duracion: 'N/A', via_administracion: 'N/A' }]
  });
  await medico.crecimiento.registrar(id_paciente, { id_consulta, peso_kg: 9.3, talla_cm: 75.5, perimetro_cefalico_cm: 45.2 });
  const { id_esquema } = await medico.vacunacion.programar(id_paciente, { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: '2026-03-01T00:00:00.000Z' });
  await medico.vacunacion.aplicar(id_paciente, id_esquema, { fecha_aplicacion: '2026-03-01T09:00:00.000Z', lote: 'L-1', id_medico: 'M002' });

  assert.equal((await medico.crecimiento.listar(id_paciente)).length, 2);
  assert.equal((await medico.consultas.prescripciones(id_paciente)).length, 1);
  assert.equal((await medico.vacunacion.esquema(id_paciente, 'Aplicada'))[0].lote, 'L-1');
  assert.equal((await secretaria.pacientes.administrativo(id_paciente)).consultas, undefined);
});

test('el cliente traduce errores HTTP a ApiError con detalles', async () => {
  const medico = await sesion('medico');
  await assert.rejects(medico.pacientes.obtener('P999'), e => e instanceof ApiError && e.status === 404);
  await assert.rejects(medico.crecimiento.registrar('P001', { id_consulta: 'C001', peso_kg: -1, talla_cm: 1, perimetro_cefalico_cm: 1 }),
    e => e.status === 400 && e.detalles.some(d => d.campo === 'peso_kg') && /peso_kg/.test(e.message));
  await assert.rejects(medico.pacientes.crear({}), e => e.status === 403 && e.codigo === 'ROL_SIN_PERMISO');
});

test('el cliente notifica 401 para cerrar la sesión y detecta servidor caído', async () => {
  let notificado = null;
  const c = crearCliente({ base: ctx.base, obtenerToken: () => 'token.invalido.xxxxxxxxxxxxxxxxxxxxxx', alNoAutorizado: e => { notificado = e; } });
  await assert.rejects(c.panel(), e => e.status === 401);
  assert.equal(notificado.codigo, 'TOKEN_INVALIDO');
  const caido = crearCliente({ base: 'http://127.0.0.1:1' });
  await assert.rejects(caido.auth.config(), e => e.status === 0 && e.codigo === 'SIN_CONEXION');
});

test('los identificadores se codifican en la URL', async () => {
  const llamadas = [];
  const c = crearCliente({ fetchImpl: async (url) => { llamadas.push(url); return new Response('[]', { status: 200 }); } });
  await c.consultas.listar('P/../x');
  assert.equal(llamadas[0], '/api/pacientes/P%2F..%2Fx/consultas');
});
