'use strict';
// Pruebas de los casos de uso que se ejecutan igual sobre el doble en memoria y sobre PostgreSQL:
// así el doble no puede desviarse del comportamiento del adaptador real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearServicios } = require('../../backend/application');
const { sembrarCatalogo, ADMIN } = require('../helpers');

const REC = { id: 'RECEPCION-1', rol: 'recepcion' };
const TEC = { id: 'TECNICO-1', rol: 'tecnico' };
const BQ = { id: 'BIOQUIMICO-1', rol: 'bioquimico' };
const paciente = (extra = {}) => ({
  nombres: 'Paciente', apellidos: 'Ficticio', fecha_nacimiento: new Date('1990-05-20T00:00:00Z'), sexo: 'F', ...extra
});
const codigo = c => e => e.code === c;

// nuevosRepos: () -> repositorios vacíos (el doble se crea de nuevo; PostgreSQL se vacía).
function pruebasFlujo(nombre, nuevosRepos) {
  async function preparar() {
    const s = crearServicios(await nuevosRepos());
    return { s, cat: await sembrarCatalogo(s) };
  }
  async function conResultado(s, cat, valores) {
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    const { id_solicitud } = await s.solicitudes.crear(REC, id_paciente, { examenes: [{ id_tipo_examen: cat.id_tipo_examen }] });
    const id_examen = (await s.solicitudes.obtener(TEC, id_solicitud)).examenes[0].id_examen;
    const r = valores ? await s.resultados.registrar(TEC, id_examen, { valores }) : null;
    return { id_paciente, id_solicitud, id_examen, id_resultado: r?.id_resultado, registro: r };
  }

  test(`${nombre}: registra un paciente, rechaza documento repetido y abre un expediente vacío`, async () => {
    const { s } = await preparar();
    const { id_paciente } = await s.pacientes.registrar(REC, paciente({ documento_identidad: 'DOC-1' }));
    await assert.rejects(s.pacientes.registrar(REC, paciente({ documento_identidad: 'DOC-1' })), codigo('CONFLICTO'));
    await assert.rejects(s.pacientes.registrar(REC, paciente({ fecha_nacimiento: new Date(Date.now() + 864e5) })), /futuro/);
    const h = await s.pacientes.obtener(TEC, id_paciente);
    assert.equal(h.estado_historial, 'Activo');
    assert.equal(h.documento_identidad, 'DOC-1');
    assert.deepEqual(h.solicitudes, []);
  });

  test(`${nombre}: busca por nombre o documento, pagina y no interpreta comodines`, async () => {
    const { s } = await preparar();
    for (const [n, a, d] of [['Ana', 'López', 'A1'], ['Beto', 'López', 'B2'], ['Carla', 'Ruiz', 'C3']]) {
      await s.pacientes.registrar(REC, paciente({ nombres: n, apellidos: a, documento_identidad: d }));
    }
    const r = await s.pacientes.listar(REC, { q: 'lópez', limite: 1, pagina: 2 });
    assert.equal(r.total, 2);
    assert.deepEqual(r.items.map(p => p.nombres), ['Beto']);
    assert.equal((await s.pacientes.listar(REC, { q: 'C3' })).items[0].nombres, 'Carla');
    assert.equal((await s.pacientes.listar(REC, { q: '%' })).total, 0);
  });

  test(`${nombre}: crea una solicitud y rechaza referencias inexistentes o repetidas`, async () => {
    const { s, cat } = await preparar();
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    const { id_solicitud } = await s.solicitudes.crear(REC, id_paciente, {
      id_medico: cat.id_medico, prioridad: 'Urgente', examenes: [{ id_tipo_examen: cat.id_tipo_examen, codigo_muestra: 'M-1' }]
    });
    const sol = await s.solicitudes.obtener(TEC, id_solicitud);
    assert.equal(sol.estado, 'Pendiente');
    assert.equal(sol.prioridad, 'Urgente');
    assert.equal(sol.paciente, 'Paciente Ficticio');
    assert.equal(sol.medico, 'Médica Ficticia');
    assert.equal(sol.examenes[0].tipo_examen, 'Examen ficticio');
    assert.equal(sol.examenes[0].resultado, null);
    await assert.rejects(s.solicitudes.crear(REC, id_paciente, { examenes: [{ id_tipo_examen: '999999' }] }), codigo('REFERENCIA_INVALIDA'));
    await assert.rejects(s.solicitudes.crear(REC, id_paciente, { id_medico: '999999', examenes: [{ id_tipo_examen: cat.id_tipo_examen }] }), codigo('REFERENCIA_INVALIDA'));
    await assert.rejects(s.solicitudes.crear(REC, id_paciente, { examenes: [{ id_tipo_examen: cat.id_tipo_examen, codigo_muestra: 'M-1' }] }), codigo('CONFLICTO'));
    await assert.rejects(s.solicitudes.crear(REC, '999999', { examenes: [{ id_tipo_examen: cat.id_tipo_examen }] }), codigo('NO_ENCONTRADO'));
    assert.equal((await s.solicitudes.listar(TEC, {})).total, 1, 'las solicitudes rechazadas no quedan a medias');
  });

  test(`${nombre}: registra valores, marca fuera de rango y deriva el estado de la solicitud`, async () => {
    const { s, cat } = await preparar();
    const x = await conResultado(s, cat, [{ id_parametro: cat.numerico, valor: '9,5' }]);
    assert.equal(x.registro.fuera_de_rango, 1);
    assert.equal((await s.solicitudes.obtener(TEC, x.id_solicitud)).estado, 'En proceso');
    await s.resultados.registrar(TEC, x.id_examen, { valores: [{ id_parametro: cat.numerico, valor: 15 }, { id_parametro: cat.texto, valor: 'normal' }] });
    const r = await s.resultados.obtener(TEC, x.id_resultado);
    assert.equal(r.estado, 'Preliminar');
    assert.equal(r.paciente, 'Paciente Ficticio');
    const porNombre = Object.fromEntries(r.detalles.map(d => [d.parametro, d]));
    assert.deepEqual([porNombre['Parámetro numérico'].valor_numerico, porNombre['Parámetro numérico'].fuera_de_rango], [15, false]);
    assert.deepEqual([porNombre['Parámetro de texto'].valor_texto, porNombre['Parámetro de texto'].fuera_de_rango], ['normal', false]);
  });

  test(`${nombre}: rechaza parámetros ajenos, valores inválidos y repetidos`, async () => {
    const { s, cat } = await preparar();
    const x = await conResultado(s, cat);
    const registrar = valores => s.resultados.registrar(TEC, x.id_examen, { valores });
    await assert.rejects(registrar([{ id_parametro: '999999', valor: 1 }]), /no pertenece/);
    await assert.rejects(registrar([{ id_parametro: cat.numerico, valor: 'abc' }]), /numérico/);
    await assert.rejects(registrar([{ id_parametro: cat.texto, valor: '  ' }]), /obligatorio/);
    await assert.rejects(registrar([{ id_parametro: cat.numerico, valor: 1 }, { id_parametro: cat.numerico, valor: 2 }]), /repetido/);
    await assert.rejects(s.resultados.registrar(TEC, '999999', { valores: [{ id_parametro: cat.numerico, valor: 1 }] }), codigo('NO_ENCONTRADO'));
    assert.equal((await s.solicitudes.obtener(TEC, x.id_solicitud)).examenes[0].resultado, null);
  });

  test(`${nombre}: valida solo resultados completos, por personal registrado, y luego no admite cambios`, async () => {
    const { s, cat } = await preparar();
    const x = await conResultado(s, cat, [{ id_parametro: cat.numerico, valor: 12 }]);
    await assert.rejects(s.resultados.validar(BQ, x.id_resultado), /Faltan parámetros.*texto/);
    await s.resultados.registrar(TEC, x.id_examen, { valores: [{ id_parametro: cat.texto, valor: 'Normal' }] });
    await assert.rejects(s.resultados.validar({ id: 'OTRO', rol: 'bioquimico' }, x.id_resultado), codigo('REFERENCIA_INVALIDA'));
    assert.deepEqual(await s.resultados.validar(BQ, x.id_resultado), { id_resultado: x.id_resultado, estado: 'Validado' });
    const r = await s.resultados.obtener(TEC, x.id_resultado);
    assert.equal(r.estado, 'Validado');
    assert.equal(r.validado_por, 'Bioquímica Ficticia');
    assert.ok(r.fecha_emision instanceof Date);
    assert.equal((await s.solicitudes.obtener(TEC, x.id_solicitud)).estado, 'Completada');
    await assert.rejects(s.resultados.registrar(TEC, x.id_examen, { valores: [{ id_parametro: cat.numerico, valor: 1 }] }), /validado/);
    await assert.rejects(s.resultados.validar(BQ, x.id_resultado), codigo('CONFLICTO'));
    assert.equal((await s.resultados.listar(TEC, { estado: 'Validado' })).total, 1);
    assert.ok((await s.auditoria.listar({ accion: 'VALIDAR_RESULTADO' })).some(e => e.usuario === 'BIOQUIMICO-1'));
  });

  test(`${nombre}: archivar guarda el motivo, deja el historial en solo lectura y restringe su consulta`, async () => {
    const { s, cat } = await preparar();
    const x = await conResultado(s, cat);
    const r = await s.pacientes.archivar(ADMIN, x.id_paciente, 'Traslado a otra institución');
    assert.equal(r.estado_historial, 'Archivado');
    await assert.rejects(s.pacientes.archivar(ADMIN, x.id_paciente, 'Otra vez'), codigo('CONFLICTO'));
    await assert.rejects(s.solicitudes.crear(REC, x.id_paciente, { examenes: [{ id_tipo_examen: cat.id_tipo_examen }] }), codigo('CONFLICTO'));
    await assert.rejects(s.resultados.registrar(TEC, x.id_examen, { valores: [{ id_parametro: cat.numerico, valor: 1 }] }), codigo('CONFLICTO'));
    await assert.rejects(s.pacientes.obtener(TEC, x.id_paciente), codigo('PROHIBIDO'));
    await assert.rejects(s.solicitudes.obtener(TEC, x.id_solicitud), codigo('PROHIBIDO'));
    await assert.rejects(s.pacientes.listar(TEC, { estado: 'Archivado' }), codigo('PROHIBIDO'));
    const h = await s.pacientes.obtener(ADMIN, x.id_paciente);
    assert.equal(h.motivo_archivado, 'Traslado a otra institución');
    assert.ok(h.fecha_archivado instanceof Date);
    assert.equal(h.solicitudes.length, 1, 'archivar no borra el historial');
    assert.equal((await s.pacientes.listar(ADMIN, { estado: 'Archivado' })).total, 1);
    const eventos = await s.auditoria.listar({ id_paciente: x.id_paciente, limite: 100 });
    assert.ok(eventos.some(e => e.accion === 'LEER_HISTORIAL' && e.resultado === 'DENEGADO'));
    assert.ok(eventos.some(e => e.accion === 'LEER_HISTORIAL_ARCHIVADO' && e.resultado === 'PERMITIDO'));
  });

  test(`${nombre}: la bitácora registra escrituras y lecturas con su actor`, async () => {
    const { s, cat } = await preparar();
    await conResultado(s, cat, [{ id_parametro: cat.numerico, valor: 12 }]);
    await s.pacientes.listar(REC, {});
    await s.panel.resumen(ADMIN);
    const acciones = (await s.auditoria.listar({ limite: 200 })).map(e => `${e.accion}:${e.usuario}`);
    for (const a of ['CREAR_PACIENTE:RECEPCION-1', 'CREAR_SOLICITUD:RECEPCION-1', 'LEER_SOLICITUD:TECNICO-1',
      'REGISTRAR_RESULTADO:TECNICO-1', 'LISTAR_PACIENTES:RECEPCION-1', 'LEER_PANEL:ADM-1', 'CREAR_TIPO_EXAMEN:ADM-1']) {
      assert.ok(acciones.includes(a), `falta ${a}`);
    }
  });

  test(`${nombre}: catálogos rechazan duplicados y referencias de tipo incorrecto`, async () => {
    const { s, cat } = await preparar();
    await assert.rejects(s.catalogos.crearParametro(ADMIN, { nombre: 'Parámetro numérico', tipo_dato: 'Numerico' }), codigo('CONFLICTO'));
    await assert.rejects(s.catalogos.crearMedico(ADMIN, { nombre_completo: 'Otro', numero_colegiado: 'COL-T1' }), codigo('CONFLICTO'));
    const tipo = parametros => s.catalogos.crearTipoExamen(ADMIN, { nombre: 'Otro examen', categoria: 'X', id_tipo_muestra: cat.id_tipo_muestra, tiempo_entrega_horas: 1, precio: 0, parametros });
    await assert.rejects(tipo([{ id_parametro: cat.texto, valor_ref_min: 1, orden_presentacion: 1 }]), /referencia de texto/);
    await assert.rejects(tipo([{ id_parametro: cat.numerico, valor_ref_texto: 'x', orden_presentacion: 1 }]), /mínimo y máximo/);
    await assert.rejects(tipo([{ id_parametro: '999999', orden_presentacion: 1 }]), codigo('REFERENCIA_INVALIDA'));
    const t = await s.catalogos.obtenerTipoExamen(cat.id_tipo_examen);
    assert.deepEqual(t.parametros.map(p => [p.nombre, p.valor_ref_min, p.valor_ref_max, p.valor_ref_texto]),
      [['Parámetro numérico', 10, 20, null], ['Parámetro de texto', null, null, 'Normal']]);
    assert.equal((await s.catalogos.tiposExamen()).length, 1, 'el tipo rechazado no queda a medias');
  });
}

module.exports = { pruebasFlujo, REC, TEC, BQ, paciente };
