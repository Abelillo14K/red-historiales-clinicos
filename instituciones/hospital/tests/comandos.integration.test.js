'use strict';
// npm run hospital:esquema y npm run hospital:usuarios sobre un MySQL DESECHABLE y vacío.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { iniciarMysqlTemporal, binariosMysql } = require('./soporte/mysqlTemporal');

const BACKEND = path.join(__dirname, '..', 'backend');
const omitir = !binariosMysql() ? 'sin MySQL Server'
  : !fs.existsSync(path.join(BACKEND, 'node_modules', 'mysql2')) ? 'falta npm run hospital:install' : false;

describe('Comandos del Hospital', { skip: omitir }, () => {
  let mysql, env, carpeta, archivo;
  const correr = (script, ...args) => spawnSync(process.execPath, [path.join(BACKEND, 'scripts', script), ...args], { encoding: 'utf8', env, windowsHide: true });
  const uno = sql => mysql.sql(`USE historial_clinico; ${sql}`);
  const cuentas = () => [...fs.readFileSync(archivo, 'utf8').matchAll(/Rol:\s+(\S+)\s+Usuario:\s+(\S+)\s+Contraseña:\s+(\S+)/g)].map(m => ({ rol: m[1], usuario: m[2], contrasena: m[3] }));

  before(async () => {
    mysql = await iniciarMysqlTemporal({ vacio: true });
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'hospital-accesos-'));
    archivo = path.join(carpeta, 'accesos.txt');
    env = { ...process.env, JWT_SECRET: 'secreto-solo-para-pruebas-0123456789abcdef', HOSPITAL_DB_HOST: '127.0.0.1', HOSPITAL_DB_PORT: String(mysql.port),
      HOSPITAL_ADMIN_USER: 'root', HOSPITAL_ADMIN_PASSWORD: '', HOSPITAL_DB_USER: 'hospital_app', HOSPITAL_DB_PASSWORD: 'clave-solo-para-pruebas', HOSPITAL_ARCHIVO_ACCESOS: archivo };
  });

  after(async () => {
    await mysql?.detener();
    if (carpeta) fs.rmSync(carpeta, { recursive: true, force: true });
  });

  test('hospital:esquema crea las 29 tablas, los datos base y el usuario de aplicación', () => {
    const r = correr('esquema.js');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(mysql.sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'historial_clinico';"), '29');
    assert.equal(uno('SELECT COUNT(*) FROM rol;'), '4');
    assert.match(mysql.sql("SHOW GRANTS FOR 'hospital_app'@'127.0.0.1';"), /GRANT SELECT, INSERT, UPDATE, DELETE ON `historial_clinico`/);
  });

  test('hospital:esquema no modifica una base existente', () => {
    uno("INSERT INTO rol (nombre_rol, descripcion) VALUES ('marca', 'no debe borrarse');");
    const r = correr('esquema.js');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /ya existe/);
    assert.equal(uno("SELECT COUNT(*) FROM rol WHERE nombre_rol = 'marca';"), '1');
  });

  test('hospital:usuarios crea una cuenta por rol, sin imprimir contraseñas, y vincula al médico', () => {
    const r = correr('usuarios.js');
    assert.equal(r.status, 0, r.stderr);
    const creadas = cuentas();
    assert.deepEqual(creadas.map(c => c.usuario), ['hosp.admin', 'hosp.medico', 'hosp.enfermeria', 'hosp.recepcion']);
    for (const c of creadas) assert.ok(!r.stdout.includes(c.contrasena));
    assert.equal(uno("SELECT id_medico FROM usuario WHERE nombre_usuario = 'hosp.medico';"), '1');
    assert.equal(uno("SELECT id_medico FROM usuario WHERE nombre_usuario = 'hosp.admin';"), 'NULL');
    const bcrypt = createRequire(path.join(BACKEND, 'package.json'))('bcryptjs');
    const hash = uno("SELECT contrasena_hash FROM usuario WHERE nombre_usuario = 'hosp.admin';");
    assert.ok(bcrypt.compareSync(creadas[0].contrasena, hash));
  });

  test('hospital:usuarios no cambia las cuentas existentes, salvo con --restablecer', () => {
    const hash = () => uno("SELECT contrasena_hash FROM usuario WHERE nombre_usuario = 'hosp.admin';");
    const antes = hash();
    assert.equal(correr('usuarios.js').status, 0);
    assert.equal(hash(), antes);
    assert.equal(cuentas().length, 4);
    assert.equal(correr('usuarios.js', '--restablecer').status, 0);
    assert.notEqual(hash(), antes);
    assert.equal(cuentas().length, 8);
  });
});
