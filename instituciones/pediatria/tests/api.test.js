'use strict';
// Pruebas HTTP de la API completa sobre el doble en memoria (sin MongoDB).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, token } = require('./helpers');

let ctx;
before(async () => { ctx = await iniciar(); });
after(async () => { await ctx.cerrar(); });
const api = (...a) => ctx.api(...a);
const nuevoPaciente = (extra = {}) => ({
  nombres: 'Paciente', apellidos: 'De Prueba', fecha_nacimiento: '2023-04-21', sexo: 'F',
  tutores: [{ dpi: 'DPI-NUEVO-1', nombres: 'Tutora', apellidos: 'Prueba', parentesco: 'Madre', es_principal: true, telefono: '0000-0000' }],
  ...extra
});
const acciones = () => ctx.repos._bitacora.map(e => e.accion);

describe('Pacientes y tutores', () => {
  test('registra un paciente con id automático y lo consulta', async () => {
    const r = await api('POST', '/api/pacientes', { rol: 'secretaria', body: nuevoPaciente() });
    assert.equal(r.status, 201);
    assert.equal(r.datos.id_paciente, 'P004');
    const h = await api('GET', '/api/pacientes/P004', { rol: 'medico' });
    assert.equal(h.status, 200);
    assert.equal(h.datos.estado_historial, 'Activo');
    assert.equal(h.datos.fecha_nacimiento, '2023-04-21T00:00:00.000Z');
    assert.match(h.datos.tutores[0].id_tutor, /^T-/);
    assert.equal(h.datos.registrado_por.rol, 'secretaria');
    assert.ok(acciones().includes('CREAR_PACIENTE'));
  });

  test('rechaza duplicados por id y por datos personales', async () => {
    const porId = await api('POST', '/api/pacientes', { rol: 'secretaria', body: nuevoPaciente({ id_paciente: 'P001', nombres: 'Otro' }) });
    assert.equal(porId.status, 409);
    const porDatos = await api('POST', '/api/pacientes', { rol: 'secretaria', body: nuevoPaciente() });
    assert.equal(porDatos.status, 409);
    assert.match(porDatos.datos.error, /P004/);
  });

  test('valida datos incorrectos', async () => {
    const sinPrincipal = nuevoPaciente({ nombres: 'X', tutores: [{ ...nuevoPaciente().tutores[0], es_principal: false }] });
    assert.equal((await api('POST', '/api/pacientes', { rol: 'secretaria', body: sinPrincipal })).status, 400);
    const futuro = nuevoPaciente({ nombres: 'Y', fecha_nacimiento: '2099-01-01' });
    assert.equal((await api('POST', '/api/pacientes', { rol: 'secretaria', body: futuro })).status, 400);
    const campoExtra = await api('POST', '/api/pacientes', { rol: 'secretaria', body: { ...nuevoPaciente({ nombres: 'Z' }), estado_historial: 'Archivado' } });
    assert.equal(campoExtra.status, 400);
    assert.ok(campoExtra.datos.detalles.length > 0);
    const sexo = await api('POST', '/api/pacientes', { rol: 'secretaria', body: nuevoPaciente({ nombres: 'W', sexo: 'X' }) });
    assert.equal(sexo.status, 400);
  });

  test('rechaza operadores MongoDB, JSON malformado y cuerpos grandes', async () => {
    const op = await api('GET', '/api/pacientes?q[$ne]=x', { rol: 'medico' });
    assert.equal(op.status, 400);
    const inyeccion = await api('POST', '/api/pacientes', { rol: 'secretaria', body: nuevoPaciente({ nombres: { $gt: '' } }) });
    assert.equal(inyeccion.status, 400);
    assert.equal((await api('POST', '/api/pacientes', { rol: 'secretaria', raw: '{"nombres":' })).status, 400);
    const grande = await api('POST', '/api/pacientes', { rol: 'secretaria', raw: JSON.stringify({ x: 'a'.repeat(200_000) }) });
    assert.equal(grande.status, 413);
    assert.equal((await api('GET', '/api/pacientes/P..%24', { rol: 'medico' })).status, 400);
  });

  test('lista y busca pacientes; secretaria no ve contadores clínicos', async () => {
    const r = await api('GET', '/api/pacientes?q=ficticia', { rol: 'medico' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.datos.items.map(p => p.id_paciente), ['P001']);
    assert.equal(typeof r.datos.items[0].total_consultas, 'number');
    const s = await api('GET', '/api/pacientes', { rol: 'secretaria' });
    assert.ok(s.datos.items.every(p => p.estado_historial === 'Activo' && p.total_consultas === undefined));
  });

  test('actualiza datos administrativos y tutores', async () => {
    assert.equal((await api('PATCH', '/api/pacientes/P004', { rol: 'secretaria', body: { nombres: 'Paciente Editada' } })).status, 200);
    const nuevo = await api('POST', '/api/pacientes/P004/tutores', {
      rol: 'secretaria', body: { dpi: 'DPI-NUEVO-2', nombres: 'Tutor', apellidos: 'Dos', parentesco: 'Padre', es_principal: true }
    });
    assert.equal(nuevo.status, 201);
    const adm = await api('GET', '/api/pacientes/P004/administrativo', { rol: 'secretaria' });
    assert.equal(adm.datos.nombres, 'Paciente Editada');
    assert.equal(adm.datos.tutores.filter(t => t.es_principal).length, 1);
    assert.equal(adm.datos.tutores.find(t => t.es_principal).id_tutor, nuevo.datos.id_tutor);
    assert.equal(adm.datos.consultas, undefined);
    const dpiRepetido = await api('POST', '/api/pacientes/P004/tutores', {
      rol: 'secretaria', body: { dpi: 'DPI-NUEVO-2', nombres: 'X', apellidos: 'Y', parentesco: 'Tío', es_principal: false }
    });
    assert.equal(dpiRepetido.status, 400);
    const quitarPrincipal = await api('PUT', `/api/pacientes/P004/tutores/${nuevo.datos.id_tutor}`, { rol: 'secretaria', body: { es_principal: false } });
    assert.equal(quitarPrincipal.status, 400);
    const tel = await api('PUT', `/api/pacientes/P004/tutores/${nuevo.datos.id_tutor}`, { rol: 'secretaria', body: { telefono: '5555-0000' } });
    assert.equal(tel.status, 200);
  });
});

describe('Consultas, diagnósticos, tratamiento y prescripciones', () => {
  let idConsulta;
  test('registra una consulta completa con control de crecimiento en la misma operación', async () => {
    const r = await api('POST', '/api/pacientes/P004/consultas', {
      rol: 'medico', body: {
        id_medico: 'M001', fecha_hora: '2026-03-01T15:00:00Z', motivo: 'Control ficticio', observaciones: 'Demostración',
        diagnosticos: [{ codigo: 'DEMO-1', descripcion: 'Diagnóstico ficticio' }],
        tratamiento: { descripcion: 'Seguimiento ficticio' },
        prescripciones: [{ medicamentos: [{ nombre: 'Medicamento ficticio', dosis: 'No aplica', frecuencia: 'No aplica', duracion: 'No aplica', via_administracion: 'No aplica' }] }],
        control_crecimiento: { peso_kg: 12.5, talla_cm: 88, perimetro_cefalico_cm: 47 }
      }
    });
    assert.equal(r.status, 201);
    idConsulta = r.datos.id_consulta;
    assert.ok(r.datos.id_control);
    const lista = await api('GET', '/api/pacientes/P004/consultas', { rol: 'medico' });
    assert.equal(lista.datos[0].medico.apellidos, 'Prueba');
    assert.equal(lista.datos[0].prescripciones[0].fecha_emision, '2026-03-01T15:00:00.000Z');
    assert.equal(lista.datos[0].registrado_por.id_usuario, 'USR-medico');
  });

  test('rechaza médico inexistente, fecha futura y consulta duplicada', async () => {
    const base = { fecha_hora: '2026-03-02T15:00:00Z', motivo: 'X' };
    assert.equal((await api('POST', '/api/pacientes/P004/consultas', { rol: 'medico', body: { ...base, id_medico: 'M999' } })).status, 422);
    assert.equal((await api('POST', '/api/pacientes/P004/consultas', { rol: 'medico', body: { ...base, id_medico: 'M001', fecha_hora: '2099-01-01T00:00:00Z' } })).status, 400);
    const dup = await api('POST', '/api/pacientes/P004/consultas', { rol: 'medico', body: { ...base, id_medico: 'M001', id_consulta: idConsulta } });
    assert.equal(dup.status, 409);
    assert.equal((await api('POST', '/api/pacientes/P999/consultas', { rol: 'medico', body: { ...base, id_medico: 'M001' } })).status, 404);
  });

  test('agrega diagnóstico, tratamiento y prescripción a una consulta existente', async () => {
    const d = await api('POST', `/api/pacientes/P004/consultas/${idConsulta}/diagnosticos`, { rol: 'medico', body: { codigo: 'DEMO-2', descripcion: 'Otro ficticio' } });
    assert.equal(d.status, 201);
    assert.equal((await api('POST', `/api/pacientes/P004/consultas/${idConsulta}/diagnosticos`, { rol: 'medico', body: { codigo: 'DEMO-2', descripcion: 'Repetido' } })).status, 409);
    const t = await api('PUT', `/api/pacientes/P004/consultas/${idConsulta}/tratamiento`, { rol: 'medico', body: { descripcion: 'Ajuste ficticio', recomendaciones: 'Ninguna' } });
    assert.equal(t.status, 200);
    const rx = await api('POST', `/api/pacientes/P004/consultas/${idConsulta}/prescripciones`, {
      rol: 'medico', body: { indicaciones_generales: 'Demostración', medicamentos: [{ nombre: 'Ficticio B', dosis: 'N/A', frecuencia: 'N/A', duracion: 'N/A', via_administracion: 'N/A' }] }
    });
    assert.equal(rx.status, 201);
    assert.equal((await api('POST', '/api/pacientes/P004/consultas/C-NOEXISTE/diagnosticos', { rol: 'medico', body: { codigo: 'X', descripcion: 'Y' } })).status, 404);
    const sinMedicamentos = await api('POST', `/api/pacientes/P004/consultas/${idConsulta}/prescripciones`, { rol: 'medico', body: { medicamentos: [] } });
    assert.equal(sinMedicamentos.status, 400);
  });

  test('recupera diagnósticos y medicamentos históricos', async () => {
    const rx = await api('GET', '/api/pacientes/P004/prescripciones', { rol: 'medico' });
    assert.equal(rx.status, 200);
    assert.equal(rx.datos.length, 2);
    assert.deepEqual(rx.datos.flatMap(r => r.medicamentos.map(m => m.nombre)).sort(), ['Ficticio B', 'Medicamento ficticio']);
    const dx = await api('GET', '/api/pacientes/P004/diagnosticos', { rol: 'administrador' });
    assert.deepEqual(dx.datos.map(d => d.codigo).sort(), ['DEMO-1', 'DEMO-2']);
    const h = await api('GET', '/api/pacientes/P004', { rol: 'medico' });
    assert.equal(h.datos.consultas[0].tratamiento.descripcion, 'Ajuste ficticio');
  });
});

describe('Controles de crecimiento', () => {
  test('registra controles asociados a una consulta y los devuelve en orden cronológico', async () => {
    const r = await api('POST', '/api/pacientes/P001/crecimiento', {
      rol: 'medico', body: { id_consulta: 'C001', fecha: '2026-01-10T15:30:00Z', peso_kg: 15, talla_cm: 95, perimetro_cefalico_cm: 49 }
    });
    assert.equal(r.status, 201);
    await api('POST', '/api/pacientes/P001/consultas', { rol: 'medico', body: { id_consulta: 'C002', id_medico: 'M002', fecha_hora: '2025-06-01T10:00:00Z', motivo: 'Anterior' } });
    await api('POST', '/api/pacientes/P001/crecimiento', { rol: 'medico', body: { id_consulta: 'C002', peso_kg: 13, talla_cm: 90, perimetro_cefalico_cm: 48 } });
    const h = await api('GET', '/api/pacientes/P001/crecimiento', { rol: 'medico' });
    assert.deepEqual(h.datos.map(c => c.peso_kg), [13, 15]);
    assert.equal(h.datos[0].fecha, '2025-06-01T10:00:00.000Z');
    assert.equal(typeof h.datos[0].edad_meses, 'number');
  });

  test('rechaza control sin consulta existente o con medidas inválidas', async () => {
    assert.equal((await api('POST', '/api/pacientes/P001/crecimiento', { rol: 'medico', body: { id_consulta: 'C-NO', peso_kg: 10, talla_cm: 80, perimetro_cefalico_cm: 45 } })).status, 422);
    assert.equal((await api('POST', '/api/pacientes/P001/crecimiento', { rol: 'medico', body: { id_consulta: 'C001', peso_kg: -1, talla_cm: 80, perimetro_cefalico_cm: 45 } })).status, 400);
    assert.equal((await api('POST', '/api/pacientes/P001/crecimiento', { rol: 'medico', body: { id_consulta: 'C001', peso_kg: '10', talla_cm: 80, perimetro_cefalico_cm: 45 } })).status, 400);
  });
});

describe('Vacunación', () => {
  let idEsquema;
  test('programa una dosis y evita programarla dos veces', async () => {
    const r = await api('POST', '/api/pacientes/P001/vacunacion', { rol: 'medico', body: { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: '2026-05-01T00:00:00Z' } });
    assert.equal(r.status, 201);
    idEsquema = r.datos.id_esquema;
    const dup = await api('POST', '/api/pacientes/P001/vacunacion', { rol: 'medico', body: { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: '2026-06-01T00:00:00Z' } });
    assert.equal(dup.status, 409);
    assert.equal((await api('POST', '/api/pacientes/P001/vacunacion', { rol: 'medico', body: { id_vacuna: 'V999', numero_dosis: 1, fecha_programada: '2026-06-01T00:00:00Z' } })).status, 422);
    assert.equal((await api('POST', '/api/pacientes/P001/vacunacion', { rol: 'medico', body: { id_vacuna: 'V002', numero_dosis: 1, fecha_programada: '2026-06-01T00:00:00Z', estado: 'Aplicada' } })).status, 400);
  });

  test('consulta pendientes, aplica una sola vez (también en peticiones simultáneas)', async () => {
    const pend = await api('GET', '/api/pacientes/P001/vacunacion?estado=Pendiente', { rol: 'medico' });
    assert.equal(pend.datos.length, 1);
    assert.equal(pend.datos[0].vacuna, 'Vacuna ficticia A');
    assert.equal((await api('GET', '/api/pacientes/P001/vacunacion?estado=Otra', { rol: 'medico' })).status, 400);
    const cuerpo = { fecha_aplicacion: '2026-05-01T10:00:00Z', lote: 'LOTE-FICTICIO', id_medico: 'M001' };
    assert.equal((await api('PATCH', `/api/pacientes/P001/vacunacion/${idEsquema}/aplicar`, { rol: 'medico', body: { ...cuerpo, id_medico: 'M999' } })).status, 422);
    const [a, b] = await Promise.all([
      api('PATCH', `/api/pacientes/P001/vacunacion/${idEsquema}/aplicar`, { rol: 'medico', body: cuerpo }),
      api('PATCH', `/api/pacientes/P001/vacunacion/${idEsquema}/aplicar`, { rol: 'medico', body: cuerpo })
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const apl = await api('GET', '/api/pacientes/P001/vacunacion?estado=Aplicada', { rol: 'administrador' });
    assert.equal(apl.datos[0].lote, 'LOTE-FICTICIO');
    assert.equal(apl.datos[0].medico, 'Médica Prueba');
    assert.equal(acciones().filter(x => x === 'APLICAR_VACUNA').length, 1);
  });

  test('cancela una dosis pendiente y permite reprogramarla', async () => {
    const r = await api('POST', '/api/pacientes/P001/vacunacion', { rol: 'medico', body: { id_vacuna: 'V002', numero_dosis: 1, fecha_programada: '2026-07-01T00:00:00Z' } });
    assert.equal((await api('PATCH', `/api/pacientes/P001/vacunacion/${r.datos.id_esquema}/cancelar`, { rol: 'medico', body: { motivo_cancelacion: 'Reprogramación' } })).status, 200);
    const otra = await api('POST', '/api/pacientes/P001/vacunacion', { rol: 'medico', body: { id_vacuna: 'V002', numero_dosis: 1, fecha_programada: '2026-08-01T00:00:00Z' } });
    assert.equal(otra.status, 201);
    const globales = await api('GET', '/api/vacunacion/pendientes', { rol: 'medico' });
    assert.ok(globales.datos.some(d => d.id_esquema === otra.datos.id_esquema));
  });
});

describe('Archivado, autorización y auditoría', () => {
  test('solo el administrador archiva; el historial queda en solo lectura', async () => {
    assert.equal((await api('PATCH', '/api/pacientes/P004/archivar', { rol: 'medico', body: { motivo_archivado: 'X' } })).status, 403);
    assert.equal((await api('PATCH', '/api/pacientes/P004/archivar', { rol: 'administrador', body: {} })).status, 400);
    const r = await api('PATCH', '/api/pacientes/P004/archivar', { rol: 'administrador', body: { motivo_archivado: 'Traslado ficticio' } });
    assert.equal(r.status, 200);
    assert.equal((await api('PATCH', '/api/pacientes/P004/archivar', { rol: 'administrador', body: { motivo_archivado: 'Otra vez' } })).status, 409);
    const consulta = await api('POST', '/api/pacientes/P004/consultas', { rol: 'medico', body: { id_medico: 'M001', fecha_hora: '2026-04-01T10:00:00Z', motivo: 'X' } });
    assert.equal(consulta.status, 409);
    const h = await api('GET', '/api/pacientes/P004', { rol: 'administrador' });
    assert.equal(h.datos.estado_historial, 'Archivado');
    assert.equal(h.datos.motivo_archivado, 'Traslado ficticio');
    assert.equal(h.datos.consultas.length, 1, 'el archivo no elimina información');
  });

  test('historiales archivados solo para administrador', async () => {
    assert.equal((await api('GET', '/api/pacientes/P003', { rol: 'medico' })).status, 403);
    assert.equal((await api('GET', '/api/pacientes?estado=Archivado', { rol: 'secretaria' })).status, 403);
    const lista = await api('GET', '/api/pacientes?estado=Archivado', { rol: 'administrador' });
    assert.deepEqual(lista.datos.items.map(p => p.id_paciente).sort(), ['P003', 'P004']);
    assert.ok(acciones().includes('LEER_HISTORIAL_ARCHIVADO'));
  });

  test('exige token válido, de la institución y vigente', async () => {
    assert.equal((await api('GET', '/api/pacientes')).status, 401);
    const otra = await api('GET', '/api/pacientes', { headers: { Authorization: `Bearer ${token('medico', { institucion: 'hospital_general' })}` } });
    assert.equal(otra.status, 403);
    const firmaAjena = await api('GET', '/api/pacientes', { headers: { Authorization: `Bearer ${token('medico', { secret: 'x'.repeat(40) })}` } });
    assert.equal(firmaAjena.status, 401);
    const expirado = await api('GET', '/api/pacientes', { headers: { Authorization: `Bearer ${token('medico', { expiresIn: -10 })}` } });
    assert.equal(expirado.datos.codigo, 'TOKEN_EXPIRADO');
    assert.equal((await api('GET', '/api/pacientes', { headers: { Authorization: `Bearer ${token('enfermera')}` } })).status, 403);
  });

  test('aplica permisos por rol y audita accesos denegados', async () => {
    assert.equal((await api('GET', '/api/pacientes/P001', { rol: 'secretaria' })).status, 403);
    assert.equal((await api('POST', '/api/pacientes/P001/consultas', { rol: 'secretaria', body: {} })).status, 403);
    assert.equal((await api('POST', '/api/pacientes', { rol: 'medico', body: nuevoPaciente({ nombres: 'Q' }) })).status, 403);
    assert.equal((await api('GET', '/api/auditoria', { rol: 'medico' })).status, 403);
    await new Promise(r => setImmediate(r));
    const denegado = ctx.repos._bitacora.find(e => e.accion === 'ACCESO_DENEGADO' && e.id_paciente === 'P001');
    assert.equal(denegado.resultado, 'DENEGADO');
    assert.equal(denegado.rol, 'secretaria');
  });

  test('la bitácora registra actor, acción y referencia; solo la consulta el administrador', async () => {
    const r = await api('GET', '/api/auditoria?id_paciente=P004', { rol: 'administrador' });
    assert.equal(r.status, 200);
    const tipos = new Set(r.datos.map(e => e.accion));
    for (const a of ['CREAR_PACIENTE', 'REGISTRAR_CONSULTA', 'AGREGAR_DIAGNOSTICO', 'REGISTRAR_PRESCRIPCION', 'ARCHIVAR_HISTORIAL']) {
      assert.ok(tipos.has(a), `falta ${a}`);
    }
    const e = r.datos.find(x => x.accion === 'ARCHIVAR_HISTORIAL');
    assert.equal(e.id_usuario, 'USR-administrador');
    assert.ok(e.fecha_hora);
    assert.equal((await api('GET', '/api/auditoria?accion=DROP;', { rol: 'administrador' })).status, 400);
  });

  test('un fallo de la bitácora sin transacciones no revierte la escritura ya confirmada', async () => {
    ctx.repos.auditoria.fallar = true;
    try {
      const r = await api('POST', '/api/pacientes/P001/consultas', { rol: 'medico', body: { id_medico: 'M001', fecha_hora: '2026-02-01T10:00:00Z', motivo: 'Sin bitácora' } });
      assert.equal(r.status, 201);
    } finally { ctx.repos.auditoria.fallar = false; }
    const h = await api('GET', '/api/pacientes/P001', { rol: 'medico' });
    assert.ok(h.datos.consultas.some(c => c.motivo === 'Sin bitácora' && c.registrado_por));
  });
});

describe('Catálogos, panel y sesión', () => {
  test('lista médicos, especialidades y vacunas', async () => {
    const m = await api('GET', '/api/medicos?especialidad=Neonatolog%C3%ADa', { rol: 'secretaria' });
    assert.deepEqual(m.datos.map(x => x.id_medico), ['M002']);
    assert.equal((await api('GET', '/api/medicos/M999', { rol: 'medico' })).status, 404);
    const e = await api('GET', '/api/especialidades', { rol: 'medico' });
    assert.equal(e.datos.length, 2);
    assert.equal((await api('GET', '/api/vacunas', { rol: 'medico' })).datos.length, 2);
    assert.equal((await api('POST', '/api/vacunas', { rol: 'administrador', body: { id_vacuna: 'V001', nombre: 'Dup' } })).status, 409);
  });

  test('panel con resumen según rol y sesión actual', async () => {
    const p = await api('GET', '/api/panel', { rol: 'medico' });
    assert.equal(typeof p.datos.consultas, 'number');
    assert.ok(Array.isArray(p.datos.proximas_dosis));
    const s = await api('GET', '/api/panel', { rol: 'secretaria' });
    assert.equal(s.datos.consultas, undefined);
    const ses = await api('GET', '/api/sesion', { rol: 'administrador' });
    assert.equal(ses.datos.rol, 'administrador');
  });

  test('inicio de sesión de desarrollo emite un token válido', async () => {
    const cfg = await api('GET', '/auth/config');
    assert.equal(cfg.datos.dev_login, true);
    const r = await api('POST', '/auth/dev-login', { body: { rol: 'medico', usuario: 'DEMO-1' } });
    assert.equal(r.status, 200);
    const ses = await api('GET', '/api/sesion', { headers: { Authorization: `Bearer ${r.datos.token}` } });
    assert.equal(ses.datos.usuario, 'DEMO-1');
    assert.equal((await api('POST', '/auth/dev-login', { body: { rol: 'root' } })).status, 400);
  });

  test('cabeceras de seguridad y rutas desconocidas', async () => {
    const res = await fetch(`${ctx.base}/api/medicos`, { headers: { Authorization: `Bearer ${token('medico')}` } });
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal((await api('GET', '/api/no-existe', { rol: 'medico' })).status, 404);
  });
});

describe('Contrato de errores común (docs/GUIA_INTEGRACION_EQUIPO.md §4)', () => {
  test('toda respuesta de error trae { error, codigo } estable', async () => {
    const casos = [
      [await api('GET', '/api/pacientes'), 401, 'NO_AUTENTICADO'],
      [await api('GET', '/api/pacientes', { headers: { Authorization: `Bearer ${token('medico', { secret: 'otro-secreto-que-no-coincide-0123456789' })}` } }), 401, 'TOKEN_INVALIDO'],
      [await api('GET', '/api/auditoria', { rol: 'secretaria' }), 403, 'ROL_SIN_PERMISO'],
      [await api('GET', '/api/pacientes/P999', { rol: 'medico' }), 404, 'NO_ENCONTRADO'],
      [await api('GET', '/api/no-existe', { rol: 'medico' }), 404, 'RUTA_NO_ENCONTRADA'],
      [await api('POST', '/api/pacientes', { rol: 'secretaria', body: { nombres: '' } }), 400, 'VALIDACION'],
      [await api('POST', '/api/pacientes', { rol: 'secretaria', raw: '{"mal' }), 400, 'VALIDACION'],
      [await api('GET', '/api/pacientes/P%24', { rol: 'medico' }), 400, 'VALIDACION'],
      [await api('POST', '/api/pacientes', { rol: 'secretaria', body: nuevoPaciente({ id_paciente: 'P001', nombres: 'Otro' }) }), 409, 'CONFLICTO']
    ];
    for (const [r, status, codigo] of casos) {
      assert.equal(r.status, status, `${codigo}: ${JSON.stringify(r.datos)}`);
      assert.equal(r.datos.codigo, codigo);
      assert.equal(typeof r.datos.error, 'string');
    }
    const invalido = casos[5][0].datos;
    assert.ok(Array.isArray(invalido.detalles) && invalido.detalles.every(d => d.campo && d.mensaje));
  });
});
