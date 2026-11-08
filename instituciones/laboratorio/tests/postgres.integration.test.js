'use strict';
// Integración REAL del adaptador PostgreSQL sobre un servidor desechable (tests/soporte/postgresTemporal.js).
// Nunca se conecta a historial_lab. Se omite si no hay binarios de PostgreSQL (variable PG_BIN o instalación detectada).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { iniciarPostgresTemporal, binariosPostgres, vaciar } = require('./soporte/postgresTemporal');
const { crearRepositoriosPostgres } = require('../backend/adapters/postgres');
const { crearServicios } = require('../backend/application');
const { pruebasFlujo, REC, TEC, paciente } = require('./soporte/flujoComun');
const { sembrarCatalogo, iniciar, ADMIN } = require('./helpers');

const omitir = binariosPostgres() ? false : 'sin binarios de PostgreSQL (defina PG_BIN) para la base de pruebas desechable';

describe('PostgreSQL', { skip: omitir }, () => {
  let pg, pool;
  before(async () => {
    pg = await iniciarPostgresTemporal();
    pool = new Pool({ connectionString: pg.url, max: 10 });
  });
  after(async () => {
    await pool?.end();
    await pg?.detener();
  });
  const nuevos = async () => { await vaciar(pool); return crearRepositoriosPostgres(pool); };

  pruebasFlujo('PostgreSQL', nuevos);

  test('la fecha de nacimiento se guarda sin corrimiento por zona horaria', async () => {
    const repos = await nuevos();
    const { id_paciente } = await crearServicios(repos).pacientes.registrar(REC, paciente({ fecha_nacimiento: new Date('1990-01-01T00:00:00Z') }));
    assert.equal((await repos.pacientes.obtener(id_paciente)).fecha_nacimiento, '1990-01-01');
  });

  test('un identificador que no es BIGINT no existe (sin error del motor)', async () => {
    const repos = await nuevos();
    assert.equal(await repos.pacientes.obtener('abc'), null);
    assert.equal(await repos.solicitudes.obtener('99999999999999999999'), null);
    assert.deepEqual(await repos.auditoria.listar({ id_paciente: 'x' }), []);
  });

  test('las restricciones CHECK del esquema llegan como VALIDACION_MOTOR', async () => {
    const repos = await nuevos();
    await assert.rejects(crearServicios(repos).pacientes.registrar(REC, paciente({ sexo: 'X' })), e => e.code === 'VALIDACION_MOTOR' && e.status === 422);
  });

  test('si la bitácora falla, la escritura se revierte (misma transacción)', async () => {
    const repos = await nuevos();
    const s = crearServicios(repos);
    await pool.query('ALTER TABLE laboratorio.bitacora RENAME TO bitacora_fuera');
    try {
      await assert.rejects(s.pacientes.registrar(REC, paciente()));
      await assert.rejects(s.pacientes.listar(REC, {}), e => e.code === 'AUDITORIA_NO_DISPONIBLE');
    } finally {
      await pool.query('ALTER TABLE laboratorio.bitacora_fuera RENAME TO bitacora');
    }
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM laboratorio.paciente')).rows[0].n, 0);
  });

  test('el trigger impide solicitudes de historiales archivados aunque se escriba SQL directo', async () => {
    const repos = await nuevos();
    const s = crearServicios(repos);
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    await s.pacientes.archivar(ADMIN, id_paciente, 'Prueba');
    await assert.rejects(pool.query(`INSERT INTO laboratorio.solicitud (id_paciente, registrado_por) VALUES ($1, 'SQL')`, [id_paciente]), /archivado/);
    await assert.rejects(pool.query(`UPDATE laboratorio.paciente SET motivo_archivado = NULL WHERE id_paciente = $1`, [id_paciente]), /check/i);
  });

  test('el usuario de la aplicación no puede borrar registros ni alterar la bitácora', async () => {
    const repos = await nuevos();
    await crearServicios(repos).pacientes.registrar(REC, paciente());
    const app = new Pool({ connectionString: pg.urlApp, max: 1 });
    try {
      assert.equal((await app.query('SELECT count(*)::int AS n FROM laboratorio.paciente')).rows[0].n, 1);
      await assert.rejects(app.query('DELETE FROM laboratorio.paciente'), /permiso|permission/i);
      await assert.rejects(app.query(`UPDATE laboratorio.bitacora SET usuario = 'otro'`), /permiso|permission/i);
      await assert.rejects(app.query('TRUNCATE laboratorio.bitacora'), /permiso|permission/i);
      await app.query(`INSERT INTO laboratorio.bitacora (usuario, accion) VALUES ('APP', 'PRUEBA')`);
    } finally {
      await app.end();
    }
  });

  test('registros simultáneos sobre el mismo examen no se pisan ni fallan', async () => {
    const repos = await nuevos();
    const s = crearServicios(repos);
    const cat = await sembrarCatalogo(s);
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    const { id_solicitud } = await s.solicitudes.crear(REC, id_paciente, { examenes: [{ id_tipo_examen: cat.id_tipo_examen }] });
    const id_examen = (await s.solicitudes.obtener(TEC, id_solicitud)).examenes[0].id_examen;
    const r = await Promise.all([
      s.resultados.registrar(TEC, id_examen, { valores: [{ id_parametro: cat.numerico, valor: 11 }] }),
      s.resultados.registrar(TEC, id_examen, { valores: [{ id_parametro: cat.texto, valor: 'Normal' }] })
    ]);
    assert.equal(r[0].id_resultado, r[1].id_resultado);
    assert.equal((await s.resultados.obtener(TEC, r[0].id_resultado)).detalles.length, 2);
  });

  test('archivar y crear una solicitud a la vez nunca deja una solicitud en un historial ya archivado', async () => {
    const repos = await nuevos();
    const s = crearServicios(repos);
    const cat = await sembrarCatalogo(s);
    const { id_paciente } = await s.pacientes.registrar(REC, paciente());
    const [solicitud, archivo] = await Promise.allSettled([
      s.solicitudes.crear(REC, id_paciente, { examenes: [{ id_tipo_examen: cat.id_tipo_examen }] }),
      s.pacientes.archivar(ADMIN, id_paciente, 'Simultáneo')
    ]);
    assert.equal(archivo.status, 'fulfilled');
    const { rows } = await pool.query(
      `SELECT s.fecha_solicitud, p.fecha_archivado FROM laboratorio.solicitud s JOIN laboratorio.paciente p USING (id_paciente)`);
    if (solicitud.status === 'fulfilled') assert.ok(rows[0].fecha_solicitud <= rows[0].fecha_archivado);
    else assert.equal(rows.length, 0);
  });

  test('la API responde 503 si PostgreSQL no está disponible, sin caerse', async () => {
    const caido = new Pool({ connectionString: 'postgres://postgres@127.0.0.1:1/nada', connectionTimeoutMillis: 2000 });
    const ctx = await iniciar(crearRepositoriosPostgres(caido), { sembrar: false });
    try {
      const r = await ctx.api('GET', '/api/pacientes', { rol: 'recepcion' });
      assert.deepEqual([r.status, r.datos.codigo], [503, 'MOTOR_NO_DISPONIBLE']);
      assert.equal((await ctx.api('GET', '/api/sesion', { rol: 'recepcion' })).status, 200, 'la sesión no depende del motor');
    } finally {
      await ctx.cerrar();
      await caido.end();
    }
  });
});
