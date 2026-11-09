'use strict';
// Pruebas de los casos de uso que se ejecutan igual sobre el doble en memoria y sobre el emulador
// de Firestore: así el doble no puede desviarse del comportamiento del adaptador real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearServicios } = require('../../backend/application');
const { sembrarCatalogo, enDias, ADMIN } = require('../helpers');

const REC = { id: 'RECEPCION-1', rol: 'recepcion' };
const OD = { id: 'ODONTOLOGO-1', rol: 'odontologo' };
const paciente = (extra = {}) => ({
  nombres: 'Paciente', apellidos: 'Ficticio', fecha_nacimiento: new Date('1990-05-20T00:00:00Z'), sexo: 'F',
  contacto: { telefono: '5555-0000' }, antecedentes: { alergias: 'Penicilina' }, atencion_inicial: {}, ...extra
});
const consulta = (extra = {}) => ({
  id_odontologo: 'COL-1', fecha_hora: new Date(Date.now() - 3600e3), motivo: 'Dolor en molar', evaluacion: { hallazgos: 'Caries' },
  diagnosticos: [], tratamientos: [], prescripcion: null, ...extra
});
const codigo = c => e => e.code === c;

// nuevosRepos: () -> repositorios vacíos (el doble se crea de nuevo; el emulador se vacía).
function pruebasFlujo(nombre, nuevosRepos) {
  async function preparar() {
    const s = crearServicios(await nuevosRepos());
    return { s, cat: await sembrarCatalogo(s) };
  }

  test(`${nombre}: registra pacientes con expediente correlativo y documento único`, async () => {
    const { s } = await preparar();
    const a = await s.pacientes.registrar(REC, paciente({ documento_identidad: '2541 36987 0101' }));
    const b = await s.pacientes.registrar(REC, paciente({ nombres: 'Otro' }));
    assert.deepEqual([a.id_paciente, b.id_paciente], ['OD000001', 'OD000002']);
    await assert.rejects(s.pacientes.registrar(REC, paciente({ documento_identidad: '2541369870101' })), codigo('CONFLICTO'));
    await assert.rejects(s.pacientes.registrar(REC, paciente({ fecha_nacimiento: new Date(Date.now() + 864e5) })), /futuro/);
    const h = await s.pacientes.obtener(OD, 'OD000001');
    assert.equal(h.fecha_nacimiento, '1990-05-20');
    assert.equal(h.antecedentes.alergias, 'Penicilina');
    assert.deepEqual([h.consultas, h.citas, h.piezas, h.total_consultas], [[], [], {}, 0]);
    const adm = await s.pacientes.obtenerAdministrativo(REC, 'OD000001');
    assert.equal(adm.antecedentes, undefined, 'la proyección administrativa no trae antecedentes');
    assert.equal((await s.pacientes.registrar(REC, paciente())).id_paciente, 'OD000003', 'un alta rechazada no consume número');
  });

  test(`${nombre}: busca por prefijo sin acentos, por documento exacto y pagina`, async () => {
    const { s } = await preparar();
    for (const [n, a, d] of [['Ana', 'López García', 'A1'], ['Beto', 'López', 'B2'], ['Carla', 'Ruiz', 'C3']]) {
      await s.pacientes.registrar(REC, paciente({ nombres: n, apellidos: a, documento_identidad: d }));
    }
    const r = await s.pacientes.listar(REC, { q: 'lop', limite: 1, pagina: 2 });
    assert.equal(r.total, 2);
    assert.deepEqual(r.items.map(p => p.nombres), ['Ana'], 'orden por apellidos: López, López García');
    assert.deepEqual((await s.pacientes.listar(REC, { q: 'ana lopez' })).items.map(p => p.nombres), ['Ana']);
    assert.equal((await s.pacientes.listar(REC, { q: 'C3' })).items[0].nombres, 'Carla');
    assert.equal((await s.pacientes.listar(REC, { q: 'zzz' })).total, 0);
    assert.equal((await s.pacientes.listar(REC, {})).items[0].antecedentes, undefined, 'el listado no trae datos clínicos');
  });

  test(`${nombre}: consulta completa con diagnóstico, tratamiento por pieza y receta en una transacción`, async () => {
    const { s } = await preparar();
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    const { id_consulta } = await s.consultas.registrar(OD, id_paciente, consulta({
      diagnosticos: [{ codigo: 'K02.1', descripcion: 'Caries de la dentina', pieza: '36' }],
      tratamientos: [{ pieza: '36', id_procedimiento: 'D-100', descripcion: 'Resina oclusal' }],
      prescripcion: { indicaciones_generales: 'Tomar con alimentos', medicamentos: [{ nombre: 'Ibuprofeno', dosis: '400 mg', frecuencia: 'Cada 8 h', duracion: '3 días', via_administracion: 'Oral' }] }
    }));
    const h = await s.pacientes.obtener(OD, id_paciente);
    assert.equal(h.total_consultas, 1);
    const c = h.consultas[0];
    assert.equal(c.id_consulta, id_consulta);
    assert.equal(c.odontologo, 'Odontóloga Ficticia');
    assert.equal(c.tratamientos[0].procedimiento, 'Obturación con resina', 'el nombre sale del catálogo');
    assert.equal(h.piezas['36'].ultimo_tratamiento.procedimiento, 'Obturación con resina');
    assert.equal((await s.consultas.prescripciones(OD, id_paciente))[0].nombre, 'Ibuprofeno');
    await assert.rejects(s.consultas.registrar(OD, id_paciente, consulta({ id_odontologo: 'NO-EXISTE' })), codigo('REFERENCIA_INVALIDA'));
    await assert.rejects(s.consultas.registrar(OD, id_paciente, consulta({ tratamientos: [{ pieza: '36', id_procedimiento: 'X-1' }] })), codigo('REFERENCIA_INVALIDA'));
    await assert.rejects(s.consultas.registrar(OD, id_paciente, consulta({ diagnosticos: [{ codigo: 'X', descripcion: 'x', pieza: '19' }] })), /FDI/);
    await assert.rejects(s.consultas.registrar(OD, id_paciente, consulta({ fecha_hora: new Date('1980-01-01T10:00:00Z') })), /nacimiento/);
    assert.equal((await s.pacientes.obtener(OD, id_paciente)).total_consultas, 1, 'las rechazadas no dejan rastro');
  });

  test(`${nombre}: agrega diagnóstico, tratamiento y receta a una consulta existente`, async () => {
    const { s } = await preparar();
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    const { id_consulta } = await s.consultas.registrar(OD, id_paciente, consulta());
    await s.consultas.agregarDiagnostico(OD, id_paciente, id_consulta, { codigo: 'K05.1', descripcion: 'Gingivitis crónica' });
    await s.consultas.agregarTratamiento(OD, id_paciente, id_consulta, { pieza: '11', procedimiento: 'Limpieza', descripcion: null });
    await s.consultas.agregarPrescripcion(OD, id_paciente, id_consulta, { medicamentos: [{ nombre: 'Clorhexidina', dosis: '15 ml', frecuencia: 'Cada 12 h', duracion: '7 días', via_administracion: 'Enjuague' }] });
    const [c] = await s.consultas.listar(OD, id_paciente);
    assert.deepEqual([c.diagnosticos.length, c.tratamientos.length, c.prescripciones.length], [1, 1, 1]);
    assert.equal((await s.pacientes.obtener(OD, id_paciente)).piezas['11'].ultimo_tratamiento.procedimiento, 'Limpieza');
    await assert.rejects(s.consultas.agregarDiagnostico(OD, id_paciente, 'NOEXISTE', { codigo: 'X', descripcion: 'x' }), codigo('NO_ENCONTRADO'));
  });

  test(`${nombre}: el odontograma guarda el estado de cada pieza y el tratamiento no lo pisa`, async () => {
    const { s } = await preparar();
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    await s.pacientes.actualizarPieza(OD, id_paciente, '16', { estado: 'Caries', observaciones: 'Oclusal' });
    await s.pacientes.actualizarPieza(OD, id_paciente, '21', { estado: 'Ausente' });
    const { id_consulta } = await s.consultas.registrar(OD, id_paciente, consulta());
    await s.consultas.agregarTratamiento(OD, id_paciente, id_consulta, { pieza: '16', id_procedimiento: 'D-100' });
    const { piezas } = await s.pacientes.obtener(OD, id_paciente);
    assert.equal(piezas['16'].estado, 'Caries');
    assert.equal(piezas['16'].ultimo_tratamiento.procedimiento, 'Obturación con resina');
    assert.equal(piezas['21'].estado, 'Ausente');
    await assert.rejects(s.pacientes.actualizarPieza(OD, id_paciente, '99', { estado: 'Sana' }), /FDI/);
  });

  test(`${nombre}: la agenda evita citas cruzadas del mismo odontólogo y la consulta cierra su cita`, async () => {
    const { s } = await preparar();
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    const cita = (extra = {}) => ({ id_paciente, id_odontologo: 'COL-1', fecha_hora: enDias(2), duracion_min: 30, motivo: 'Control', ...extra });
    const { id_cita } = await s.citas.programar(REC, cita());
    await assert.rejects(s.citas.programar(REC, cita({ fecha_hora: new Date(enDias(2).getTime() + 15 * 60e3) })), codigo('CONFLICTO'));
    await s.citas.programar(REC, cita({ id_odontologo: 'COL-2' }));
    await s.citas.programar(REC, cita({ fecha_hora: new Date(enDias(2).getTime() + 30 * 60e3) }));
    await assert.rejects(s.citas.programar(REC, cita({ fecha_hora: new Date(Date.now() - 864e5) })), /pasado/);
    const agenda = await s.citas.listar(REC, { desde: enDias(1), hasta: enDias(3) });
    assert.equal(agenda.length, 3);
    assert.equal(agenda[0].paciente, 'Paciente Ficticio');
    await s.consultas.registrar(OD, id_paciente, consulta({ id_cita }));
    assert.equal((await s.citas.listar(REC, { desde: enDias(1), hasta: enDias(3), estado: 'Atendida' })).length, 1);
    await assert.rejects(s.citas.cambiarEstado(REC, id_cita, 'Cancelada'), codigo('CONFLICTO'));
    const otra = agenda.find(c => c.id_cita !== id_cita);
    assert.equal((await s.citas.cambiarEstado(REC, otra.id_cita, 'Cancelada')).estado, 'Cancelada');
    assert.equal((await s.pacientes.obtener(OD, id_paciente)).citas.length, 3);
  });

  test(`${nombre}: archivar guarda el motivo, deja el historial en solo lectura y restringe su consulta`, async () => {
    const { s } = await preparar();
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    await s.consultas.registrar(OD, id_paciente, consulta());
    await s.pacientes.archivar(ADMIN, id_paciente, 'Traslado a otra clínica');
    await assert.rejects(s.pacientes.archivar(ADMIN, id_paciente, 'Otra vez'), codigo('CONFLICTO'));
    await assert.rejects(s.consultas.registrar(OD, id_paciente, consulta()), codigo('CONFLICTO'));
    await assert.rejects(s.pacientes.actualizarPieza(OD, id_paciente, '11', { estado: 'Sana' }), codigo('CONFLICTO'));
    await assert.rejects(s.citas.programar(REC, { id_paciente, id_odontologo: 'COL-1', fecha_hora: enDias(3), duracion_min: 30, motivo: 'x' }), codigo('CONFLICTO'));
    await assert.rejects(s.pacientes.obtener(OD, id_paciente), codigo('PROHIBIDO'));
    await assert.rejects(s.pacientes.listar(OD, { estado: 'Archivado' }), codigo('PROHIBIDO'));
    const h = await s.pacientes.obtener(ADMIN, id_paciente);
    assert.equal(h.motivo_archivado, 'Traslado a otra clínica');
    assert.ok(h.fecha_archivado instanceof Date);
    assert.equal(h.consultas.length, 1, 'archivar no borra el historial');
    const eventos = await s.auditoria.listar({ id_paciente, limite: 100 });
    assert.ok(eventos.some(e => e.accion === 'LEER_HISTORIAL' && e.resultado === 'DENEGADO'));
    assert.ok(eventos.some(e => e.accion === 'LEER_HISTORIAL_ARCHIVADO'));
  });

  test(`${nombre}: catálogos con claves únicas y bitácora con actor`, async () => {
    const { s } = await preparar();
    await assert.rejects(s.catalogos.crearOdontologo(ADMIN, { colegiado: 'COL-1', nombres: 'X', apellidos: 'Y' }), codigo('CONFLICTO'));
    await assert.rejects(s.catalogos.crearProcedimiento(ADMIN, { codigo: 'D-100', nombre: 'X', precio: 1 }), codigo('CONFLICTO'));
    assert.deepEqual((await s.catalogos.odontologos()).map(o => o.id_odontologo), ['COL-1', 'COL-2']);
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    await s.consultas.registrar(OD, id_paciente, consulta());
    await s.pacientes.listar(REC, {});
    const resumen = await s.panel.resumen(ADMIN);
    assert.deepEqual([resumen.pacientes_activos, resumen.consultas], [1, 1]);
    const acciones = (await s.auditoria.listar({ limite: 200 })).map(e => `${e.accion}:${e.usuario}`);
    for (const a of ['CREAR_ODONTOLOGO:ADM-1', 'CREAR_PACIENTE:RECEPCION-1', 'REGISTRAR_CONSULTA:ODONTOLOGO-1', 'LISTAR_PACIENTES:RECEPCION-1', 'LEER_PANEL:ADM-1']) {
      assert.ok(acciones.includes(a), `falta ${a}`);
    }
  });
}

module.exports = { pruebasFlujo, REC, OD, paciente, consulta };
