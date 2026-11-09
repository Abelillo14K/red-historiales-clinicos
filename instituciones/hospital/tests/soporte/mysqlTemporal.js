'use strict';
// Servidor MySQL DESECHABLE para las pruebas: carpeta temporal, puerto libre y solo 127.0.0.1.
// No toca el servicio MySQL del equipo ni historial_clinico real; al terminar se apaga y se borra.
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const EXE = process.platform === 'win32' ? '.exe' : '';
const SQL = path.join(__dirname, '..', '..', 'backend', 'sql');
const espera = ms => new Promise(r => setTimeout(r, ms));

// MYSQL_BIN puede indicar la carpeta bin si no está en una ruta estándar.
function binariosMysql() {
  const candidatos = [];
  if (process.env.MYSQL_BIN) candidatos.push(process.env.MYSQL_BIN);
  const base = 'C:\\Program Files\\MySQL';
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).filter(n => /^MySQL Server/.test(n)).sort().reverse()) candidatos.push(path.join(base, d, 'bin'));
  }
  candidatos.push('/usr/sbin', '/usr/local/mysql/bin', '/opt/homebrew/bin');
  for (const dir of candidatos) {
    const mysqld = path.join(dir, 'mysqld' + EXE);
    const mysql = [path.join(dir, 'mysql' + EXE), path.join('/usr/bin', 'mysql')].find(f => fs.existsSync(f));
    if (fs.existsSync(mysqld) && mysql) return { mysqld, mysql };
  }
  return null;
}

const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const { port } = s.address();
    s.close(() => resolve(port));
  });
});

// vacio: true deja el servidor sin esquema ni usuario de aplicación (para probar los comandos).
async function iniciarMysqlTemporal({ vacio = false } = {}) {
  const bin = binariosMysql();
  if (!bin) throw new Error('No se encontró MySQL Server (configure MYSQL_BIN)');
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'hospital-mysql-'));
  const datos = path.join(raiz, 'datos');
  const ini = spawnSync(bin.mysqld, ['--no-defaults', '--initialize-insecure', `--datadir=${datos}`], { encoding: 'utf8', windowsHide: true });
  if (ini.status) throw new Error(`mysqld --initialize: ${ini.stderr.slice(0, 300)}`);
  const port = await puertoLibre();
  let proceso = spawn(bin.mysqld, ['--no-defaults', `--datadir=${datos}`, `--port=${port}`, '--bind-address=127.0.0.1', '--mysqlx=OFF', '--console'],
    { stdio: 'ignore', windowsHide: true });

  // Ejecuta SQL como root y devuelve el resultado sin encabezados.
  const sql = texto => {
    const r = spawnSync(bin.mysql, ['-uroot', '-h127.0.0.1', `-P${port}`, '--default-character-set=utf8mb4', '-N', '-B'],
      { input: texto, encoding: 'utf8', windowsHide: true });
    if (r.status) throw new Error(`mysql: ${r.stderr.slice(0, 300)}`);
    return r.stdout.trim();
  };

  let listo = false;
  for (let i = 0; i < 120 && !listo; i++) {
    try { sql('SELECT 1;'); listo = true; } catch { await espera(500); }
  }

  const apagar = async () => {
    if (!proceso) return;
    const p = proceso;
    proceso = null;
    try {
      sql('SHUTDOWN;');
      await new Promise(r => p.once('exit', r));
    } catch {
      p.kill('SIGKILL');
      await espera(1000);
    }
  };
  const detener = async () => {
    await apagar();
    fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 });
  };

  try {
    if (!listo) throw new Error('mysqld no arrancó a tiempo');
    if (vacio) return { port, sql, apagar, detener };
    sql(fs.readFileSync(path.join(SQL, '01_esquema.sql'), 'utf8'));
    sql(fs.readFileSync(path.join(SQL, '02_datos_base.sql'), 'utf8'));
    // Mismos permisos que el usuario de aplicación descrito en 01_esquema.sql.
    const clave = 'clave-solo-para-pruebas';
    sql(['localhost', '127.0.0.1'].map(h => `CREATE USER 'hospital_app'@'${h}' IDENTIFIED BY '${clave}';
      GRANT SELECT, INSERT, UPDATE, DELETE ON historial_clinico.* TO 'hospital_app'@'${h}';`).join('\n'));
    return { port, usuario: 'hospital_app', clave, sql, apagar, detener };
  } catch (e) {
    await detener();
    throw e;
  }
}

module.exports = { iniciarMysqlTemporal, binariosMysql };
