'use strict';
// Hospital General montado en el servidor común, sobre un MySQL DESECHABLE (soporte/mysqlTemporal.js).
// Nunca se conecta a historial_clinico real. Se omite si no hay MySQL Server o faltan sus dependencias.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const jwt = require('jsonwebtoken');
require('../../pediatria/tests/helpers'); // variables de prueba (JWT_SECRET, NODE_ENV=test)
const { crearApp } = require('../../pediatria/backend/app');
const { crearServicios } = require('../../pediatria/backend/application');
const { crearRepositoriosMemoria } = require('../../pediatria/tests/doubles/memoria');
const { iniciarMysqlTemporal, binariosMysql } = require('./soporte/mysqlTemporal');

const BACKEND = path.join(__dirname, '..', 'backend');
const omitir = !binariosMysql() ? 'sin MySQL Server'
  : !fs.existsSync(path.join(BACKEND, 'node_modules', 'mysql2')) ? 'falta npm run hospital:install' : false;

const CLAVE = 'clave-de-prueba-123';
const ANIO = new Date().getFullYear() + 1;
const paciente = (documento, extra = {}) => ({
  primer_nombre: 'Ana', primer_apellido: 'Demo', fecha_nacimiento: '1990-01-15', genero: 'Femenino', documento_identidad: documento,
  contactos: [{ nombre_contacto: 'Contacto Demo', parentesco: 'Madre', telefono: '22000000' }], ...extra
});

describe('Hospital General sobre MySQL', { skip: omitir }, () => {
  let mysql, modulo, server, base, PERMISOS;
  const T = {};
  let idPaciente, idOtroPaciente, idCita;
  const uno = sql => mysql.sql(`USE historial_clinico; ${sql}`);
  const api = async (metodo, ruta, { token, body } = {}) => {
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const entrar = (usuario, contrasena = CLAVE) => api('POST', '/auth/login', { body: { usuario, contrasena } });
  const crearCuenta = (usuario, rol, idMedico) => {
    const r = spawnSync(process.execPath, [path.join(BACKEND, 'scripts', 'crear-usuario.js'), usuario, CLAVE, rol, ...(idMedico ? [idMedico] : [])],
      { encoding: 'utf8', env: process.env, windowsHide: true });
    assert.equal(r.status, 0, r.stderr);
  };

  before(async () => {
    mysql = await iniciarMysqlTemporal();
    Object.assign(process.env, {
      HOSPITAL_DB_HOST: '127.0.0.1', HOSPITAL_DB_PORT: String(mysql.port), HOSPITAL_DB_USER: mysql.usuario, HOSPITAL_DB_PASSWORD: mysql.clave
    });
    const cuentas = [['hosp.admin', 'administrador'], ['hosp.medico', 'medico', '1'], ['hosp.sinvinculo', 'medico'],
      ['hosp.enfermeria', 'enfermeria'], ['hosp.recepcion', 'recepcion'], ['hosp.inactiva', 'recepcion']];
    for (const c of cuentas) crearCuenta(...c);
    uno("UPDATE usuario SET estado = 'Inactivo' WHERE nombre_usuario = 'hosp.inactiva';");

    const importar = f => import(pathToFileURL(path.join(BACKEND, 'src', f)).href);
    modulo = await (await importar('modulo.js')).crearModuloHospital();
    PERMISOS = (await importar('seguridad.js')).PERMISOS_POR_ROL;
    const app = crearApp(crearServicios(crearRepositoriosMemoria()), { frontendDist: null, instituciones: { hospital_general: modulo } });
    server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise(r => server.close(r));
    await modulo?.cerrar().catch(() => {});
    await mysql?.detener();
  });

  test('el módulo se monta con MySQL disponible', () => assert.equal(modulo.error, null));

  test('cada rol entra por el login común y recibe los permisos de su tabla', async () => {
    for (const [usuario, rol] of [['hosp.admin', 'administrador'], ['hosp.medico', 'medico'], ['hosp.sinvinculo', 'medico'], ['hosp.enfermeria', 'enfermeria'], ['hosp.recepcion', 'recepcion']]) {
      const r = await entrar(usuario);
      assert.equal(r.status, 200, usuario);
      T[usuario.split('.')[1]] = r.datos.token;
      const s = await api('GET', '/api/sesion', { token: r.datos.token });
      assert.equal(s.status, 200);
      assert.equal(s.datos.institucion, 'hospital_general');
      assert.equal(s.datos.motor, 'MySQL');
      assert.equal(s.datos.rol, rol);
      assert.deepEqual([...s.datos.permisos].sort(), [...PERMISOS[rol]].sort());
    }
  });

  test('credenciales incorrectas, cuenta inexistente o inactiva responden igual', async () => {
    for (const r of [await entrar('hosp.admin', 'otra-clave-123456'), await entrar('hosp.noexiste'), await entrar('hosp.inactiva')]) {
      assert.equal(r.status, 401);
      assert.equal(r.datos.codigo, 'CREDENCIALES_INVALIDAS');
      assert.equal(r.datos.error, 'Usuario o contraseña incorrectos');
    }
  });

  test('sin token, con rol desconocido o con sub no numérico no hay acceso', async () => {
    assert.equal((await api('GET', '/api/panel')).status, 401);
    const firmar = (sub, rol) => jwt.sign({ rol, institucion: 'hospital_general' }, process.env.JWT_SECRET,
      { algorithm: 'HS256', subject: sub, expiresIn: '5m', issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE });
    const rol = await api('GET', '/api/panel', { token: firmar('1', 'root') });
    assert.equal(rol.status, 403);
    assert.equal(rol.datos.codigo, 'ROL_SIN_PERMISO');
    const sub = await api('GET', '/api/panel', { token: firmar('abc', 'administrador') });
    assert.equal(sub.status, 401);
    assert.equal(sub.datos.codigo, 'TOKEN_INVALIDO');
  });

  test('registra un paciente con expediente correlativo y valida su entrada', async () => {
    const r = await api('POST', '/api/pacientes', { token: T.recepcion, body: paciente('1000000000101') });
    assert.equal(r.status, 201);
    assert.equal(r.datos.numero_expediente, 'HG-000001');
    idPaciente = r.datos.id_paciente;
    const invalido = await api('POST', '/api/pacientes', { token: T.recepcion, body: paciente('1000000000102', { contactos: [] }) });
    assert.equal(invalido.status, 400);
    assert.equal(invalido.datos.codigo, 'VALIDACION');
  });

  test('un documento repetido se rechaza sin dejar datos a medias', async () => {
    const r = await api('POST', '/api/pacientes', { token: T.recepcion, body: paciente('1000000000101') });
    assert.equal(r.status, 409);
    assert.equal(r.datos.codigo, 'CONFLICTO');
    assert.equal(uno('SELECT COUNT(*) FROM paciente;'), '1');
    assert.equal(uno('SELECT COUNT(*) FROM paciente_contacto;'), '1');
  });

  test('cada rol solo puede hacer lo que le permite su tabla', async () => {
    assert.equal((await api('POST', '/api/pacientes', { token: T.enfermeria, body: paciente('1000000000103') })).status, 403);
    assert.equal((await api('GET', `/api/pacientes/${idPaciente}/consultas`, { token: T.recepcion })).status, 403);
    assert.equal((await api('GET', '/api/auditoria', { token: T.enfermeria })).status, 403);
    const alergia = await api('POST', '/api/pacientes', { token: T.recepcion, body: paciente('1000000000104', { alergias: [{ id_alergia: 1 }] }) });
    assert.equal(alergia.status, 403, 'recepción no registra información restringida');
  });

  test('recepción no recibe las alergias del expediente; el médico sí', async () => {
    const r = await api('POST', '/api/pacientes', { token: T.admin, body: paciente('1000000000105', { alergias: [{ id_alergia: 1, severidad: 'Severa' }] }) });
    assert.equal(r.status, 201);
    idOtroPaciente = r.datos.id_paciente;
    const recepcion = await api('GET', `/api/pacientes/${r.datos.id_paciente}`, { token: T.recepcion });
    assert.equal(recepcion.status, 200);
    assert.equal(recepcion.datos.alergias, undefined);
    const medico = await api('GET', `/api/pacientes/${r.datos.id_paciente}`, { token: T.medico });
    assert.equal(medico.datos.alergias.length, 1);
  });

  test('la búsqueda trata el texto como dato, no como SQL', async () => {
    const r = await api('GET', `/api/pacientes?q=${encodeURIComponent("' OR 1=1 -- ")}`, { token: T.admin });
    assert.equal(r.status, 200);
    assert.equal(r.datos.total, 0);
  });

  test('un médico vinculado registra la consulta; sin vínculo debe indicar el médico', async () => {
    const consulta = { fecha_hora: `${ANIO - 1}-01-10T10:00`, motivo: 'Control', signos_vitales: { peso: 60, talla: 1.6 } };
    const r = await api('POST', `/api/pacientes/${idPaciente}/consultas`, { token: T.medico, body: consulta });
    assert.equal(r.status, 201);
    assert.equal(uno('SELECT imc FROM signos_vitales;'), '23.44');
    const sin = await api('POST', `/api/pacientes/${idPaciente}/consultas`, { token: T.sinvinculo, body: consulta });
    assert.equal(sin.status, 400);
    assert.equal(sin.datos.codigo, 'VALIDACION');
  });

  test('una consulta con un diagnóstico inexistente se revierte completa', async () => {
    const antes = uno('SELECT COUNT(*) FROM consulta;');
    const r = await api('POST', `/api/pacientes/${idPaciente}/consultas`, { token: T.medico,
      body: { fecha_hora: `${ANIO - 1}-01-11T10:00`, signos_vitales: { peso: 61 }, diagnosticos: [{ codigo: 'ZZZ.9' }] } });
    assert.equal(r.status, 422);
    assert.equal(r.datos.codigo, 'REFERENCIA_INVALIDA');
    assert.equal(uno('SELECT COUNT(*) FROM consulta;'), antes);
    assert.equal(uno('SELECT COUNT(*) FROM signos_vitales;'), '1');
  });

  test('las citas rechazan el choque de horario y las fechas pasadas', async () => {
    const cita = { id_paciente: idPaciente, id_medico: 1, fecha_hora: `${ANIO}-03-10T09:00` };
    const r = await api('POST', '/api/citas', { token: T.recepcion, body: cita });
    assert.equal(r.status, 201);
    idCita = r.datos.id_cita;
    const choque = await api('POST', '/api/citas', { token: T.recepcion, body: cita });
    assert.equal(choque.status, 409);
    assert.match(choque.datos.error, /ya tiene una cita/);
    assert.equal((await api('POST', '/api/citas', { token: T.recepcion, body: { ...cita, fecha_hora: '2020-01-01T09:00' } })).status, 400);
    assert.equal((await api('POST', '/api/citas', { token: T.enfermeria, body: cita })).status, 403);
  });

  test('reprogramar rechaza fechas pasadas y dos solicitudes simultáneas a la misma hora', async () => {
    const crear = fecha_hora => api('POST', '/api/citas', { token: T.recepcion, body: { id_paciente: idOtroPaciente, id_medico: 1, fecha_hora } });
    const [a, b] = [await crear(`${ANIO}-04-01T09:00`), await crear(`${ANIO}-04-01T10:00`)];
    const mover = (id, fecha_hora) => api('PATCH', `/api/citas/${id}`, { token: T.recepcion, body: { fecha_hora } });
    assert.equal((await mover(a.datos.id_cita, '2020-01-01T09:00')).status, 400);
    const estados = (await Promise.all([mover(a.datos.id_cita, `${ANIO}-05-01T08:00`), mover(b.datos.id_cita, `${ANIO}-05-01T08:00`)])).map(r => r.status).sort();
    assert.deepEqual(estados, [200, 409]);
  });

  test('la hospitalización ocupa y libera la cama, y bloquea el archivado mientras dure', async () => {
    const ingreso = { id_paciente: idPaciente, id_cama: 1, id_medico_tratante: 1, motivo_ingreso: 'Observación' };
    const r = await api('POST', '/api/hospitalizaciones', { token: T.medico, body: ingreso });
    assert.equal(r.status, 201);
    assert.equal(uno('SELECT estado FROM cama WHERE id_cama = 1;'), 'Ocupada');
    assert.equal((await api('POST', '/api/hospitalizaciones', { token: T.medico, body: ingreso })).status, 409);
    const archivo = await api('PATCH', `/api/pacientes/${idPaciente}/archivar`, { token: T.admin, body: { motivo_archivado: 'Causa administrativa', cancelar_citas: true } });
    assert.equal(archivo.status, 409);
    assert.match(archivo.datos.error, /egreso/);
    assert.equal((await api('PATCH', `/api/hospitalizaciones/${r.datos.id_hospitalizacion}/egreso`, { token: T.medico, body: { condicion_egreso: 'Alta' } })).status, 200);
    assert.equal(uno('SELECT estado FROM cama WHERE id_cama = 1;'), 'Disponible');
    assert.equal((await api('PATCH', `/api/hospitalizaciones/${r.datos.id_hospitalizacion}/egreso`, { token: T.medico, body: { condicion_egreso: 'Alta' } })).status, 409);
  });

  test('archivar exige sus datos, cancela las citas y deja el historial en solo lectura', async () => {
    const archivar = body => api('PATCH', `/api/pacientes/${idPaciente}/archivar`, { token: T.admin, body });
    assert.equal((await archivar({ motivo_archivado: 'Fallecimiento' })).status, 400);
    assert.equal((await archivar({ motivo_archivado: 'Traslado' })).status, 400);
    const citas = await archivar({ motivo_archivado: 'Causa administrativa' });
    assert.equal(citas.status, 409);
    assert.deepEqual(citas.datos.detalles.citas, [idCita]);
    assert.equal((await archivar({ motivo_archivado: 'Causa administrativa', cancelar_citas: true })).status, 200);
    assert.equal(uno(`SELECT estado_cita FROM cita WHERE id_cita = ${idCita};`), 'Cancelada');

    const escritura = await api('POST', `/api/pacientes/${idPaciente}/consultas`, { token: T.medico, body: { fecha_hora: `${ANIO - 1}-02-01T10:00` } });
    assert.equal(escritura.status, 409);
    assert.equal((await api('GET', `/api/pacientes/${idPaciente}`, { token: T.recepcion })).status, 403);
    assert.equal((await api('GET', `/api/pacientes/${idPaciente}`, { token: T.admin })).status, 200);
  });

  test('un historial archivado se puede reactivar una sola vez', async () => {
    const reactivar = () => api('PATCH', `/api/pacientes/${idPaciente}/reactivar`, { token: T.admin });
    assert.equal((await reactivar()).status, 200);
    assert.equal((await reactivar()).status, 409);
  });

  test('la bitácora registra los accesos y solo la consulta quien tiene permiso', async () => {
    assert.ok(Number(uno("SELECT COUNT(*) FROM bitacora_acceso WHERE tabla_afectada = 'paciente' AND accion = 'LEER';")) > 0);
    assert.ok(Number(uno("SELECT COUNT(*) FROM bitacora_acceso WHERE tabla_afectada = 'paciente' AND accion = 'ARCHIVAR';")) === 1);
    const r = await api('GET', `/api/auditoria?id_paciente=${idPaciente}`, { token: T.admin });
    assert.equal(r.status, 200);
    assert.ok(r.datos.total > 0);
  });

  test('una ruta inexistente responde con el formato común', async () => {
    const r = await api('GET', '/api/noexiste', { token: T.admin });
    assert.equal(r.status, 404);
    assert.equal(r.datos.codigo, 'RUTA_NO_ENCONTRADA');
  });

  // Debe ser la última: apaga el MySQL desechable.
  test('si MySQL se cae, responde 503 sin tumbar el servidor', async () => {
    await mysql.apagar();
    const login = await entrar('hosp.admin');
    assert.equal(login.status, 503);
    assert.equal(login.datos.codigo, 'MOTOR_NO_DISPONIBLE');
    const panel = await api('GET', '/api/panel', { token: T.admin });
    assert.equal(panel.status, 503);
    assert.equal(panel.datos.codigo, 'MOTOR_NO_DISPONIBLE');
    assert.equal((await api('GET', '/salud')).status, 200);
  });
});
