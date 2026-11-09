'use strict';
// Servidor PostgreSQL DESECHABLE para pruebas de integración: initdb en una carpeta temporal, puerto libre,
// solo 127.0.0.1 y sin contraseña. No toca el servicio PostgreSQL del equipo ni historial_lab;
// al terminar se detiene el servidor y se borra su carpeta.
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');

const ESQUEMA = path.join(__dirname, '..', '..', 'backend', 'adapters', 'postgres', 'esquema.sql');
const EXE = process.platform === 'win32' ? '.exe' : '';
const tieneBinarios = dir => !!dir && ['initdb', 'pg_ctl'].every(b => fs.existsSync(path.join(dir, b + EXE)));

// PG_BIN puede venir del entorno o del .env (solo se lee esa variable).
function pgBinDelEntorno() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const env = path.join(__dirname, '..', '..', '..', '..', '.env');
  if (!fs.existsSync(env)) return null;
  return require('dotenv').parse(fs.readFileSync(env)).PG_BIN || null;
}

// En Windows, la carpeta bin del servicio PostgreSQL instalado (aunque no esté en Program Files).
function binDelServicioWindows() {
  try {
    const servicios = execFileSync('sc', ['query', 'type=', 'service', 'state=', 'all'], { encoding: 'utf8', windowsHide: true });
    for (const nombre of new Set(servicios.match(/postgresql[\w.-]*/gi) || [])) {
      const config = execFileSync('sc', ['qc', nombre], { encoding: 'utf8', windowsHide: true });
      const m = /([A-Za-z]:\\[^"\r\n]*?)\\pg_ctl\.exe/i.exec(config);
      if (m && tieneBinarios(m[1])) return m[1];
    }
  } catch { /* sin permisos para consultar servicios */ }
  return null;
}

function binariosPostgres() {
  const propio = pgBinDelEntorno();
  if (propio) return tieneBinarios(propio) ? propio : null;
  const candidatos = [];
  for (const base of ['C:\\Program Files\\PostgreSQL', '/usr/lib/postgresql']) {
    if (fs.existsSync(base)) {
      for (const v of fs.readdirSync(base).sort((a, b) => parseFloat(b) - parseFloat(a))) candidatos.push(path.join(base, v, 'bin'));
    }
  }
  candidatos.push('/usr/local/bin', '/opt/homebrew/bin', '/usr/bin');
  const encontrado = candidatos.find(tieneBinarios);
  if (encontrado) return encontrado;
  return process.platform === 'win32' ? binDelServicioWindows() : null;
}

const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const { port } = s.address();
    s.close(() => resolve(port));
  });
});

async function iniciarPostgresTemporal() {
  const bin = binariosPostgres();
  if (!bin) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'laboratorio-pg-prueba-'));
  const datos = path.join(dir, 'datos');
  const log = path.join(dir, 'postgres.log');
  const port = await puertoLibre();
  const ejecutar = (b, args) => execFileSync(path.join(bin, b + EXE), args, { stdio: 'ignore', windowsHide: true });

  ejecutar('initdb', ['-D', datos, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale']);
  ejecutar('pg_ctl', ['-D', datos, '-l', log, '-w', '-t', '60', 'start', '-o', `-p ${port} -c listen_addresses=127.0.0.1`]);
  const detenerServidor = () => { try { ejecutar('pg_ctl', ['-D', datos, '-m', 'immediate', '-w', 'stop']); } catch { /* ya detenido */ } };
  process.once('exit', detenerServidor);

  const base = `postgres://postgres@127.0.0.1:${port}`;
  const admin = new Client({ connectionString: `${base}/postgres` });
  await admin.connect();
  await admin.query('CREATE DATABASE historial_lab_test');
  await admin.query('CREATE ROLE app_laboratorio LOGIN');
  await admin.end();
  const url = `${base}/historial_lab_test`;
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  await cliente.query(fs.readFileSync(ESQUEMA, 'utf8'));
  await cliente.end();

  async function detener() {
    detenerServidor();
    process.removeListener('exit', detenerServidor);
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch { await new Promise(r => setTimeout(r, 300)); }
    }
  }
  return { url, urlApp: `postgres://app_laboratorio@127.0.0.1:${port}/historial_lab_test`, port, detener };
}

// Vacía las tablas entre pruebas (solo en la base desechable).
async function vaciar(pool) {
  await pool.query(`TRUNCATE laboratorio.resultado_detalle, laboratorio.resultado, laboratorio.examen, laboratorio.solicitud,
    laboratorio.tipo_examen_parametro, laboratorio.tipo_examen, laboratorio.parametro, laboratorio.tipo_muestra,
    laboratorio.medico_solicitante, laboratorio.personal_laboratorio, laboratorio.paciente, laboratorio.bitacora RESTART IDENTITY`);
}

module.exports = { iniciarPostgresTemporal, binariosPostgres, vaciar };
