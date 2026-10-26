'use strict';
// Instancia mongod DESECHABLE para pruebas de integración: proceso propio, puerto
// libre, carpeta temporal y sin autenticación, escuchando solo en 127.0.0.1.
// No toca el servicio MongoDB del equipo ni centro_pediatrico_db; al terminar se
// detiene el proceso y se borra su carpeta temporal.
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');

const esperar = ms => new Promise(r => setTimeout(r, ms));

function binarioMongod() {
  if (process.env.MONGOD_BIN) return fs.existsSync(process.env.MONGOD_BIN) ? process.env.MONGOD_BIN : null;
  const base = 'C:\\Program Files\\MongoDB\\Server';
  if (fs.existsSync(base)) {
    const versiones = fs.readdirSync(base).sort((a, b) => parseFloat(b) - parseFloat(a));
    for (const v of versiones) {
      const bin = path.join(base, v, 'bin', 'mongod.exe');
      if (fs.existsSync(bin)) return bin;
    }
  }
  for (const bin of ['/usr/bin/mongod', '/usr/local/bin/mongod', '/opt/homebrew/bin/mongod']) if (fs.existsSync(bin)) return bin;
  return null;
}

const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const { port } = s.address();
    s.close(() => resolve(port));
  });
});

async function iniciarMongodTemporal({ replicaSet = false } = {}) {
  const bin = binarioMongod();
  if (!bin) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pediatria-mongo-prueba-'));
  const port = await puertoLibre();
  const args = ['--dbpath', dir, '--port', String(port), '--bind_ip', '127.0.0.1',
    '--logpath', path.join(dir, 'mongod.log'), '--wiredTigerCacheSizeGB', '0.25'];
  if (replicaSet) args.push('--replSet', 'rs_pruebas');
  const proc = spawn(bin, args, { stdio: 'ignore', windowsHide: true });
  const matar = () => { try { proc.kill(); } catch { /* ya terminó */ } };
  process.once('exit', matar);
  const uri = `mongodb://127.0.0.1:${port}/?directConnection=true`;

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1000 });
  let listo = false;
  for (let i = 0; i < 60 && !listo; i++) {
    try { await client.connect(); await client.db('admin').command({ ping: 1 }); listo = true; } catch { await esperar(250); }
  }
  if (!listo) { matar(); throw new Error(`mongod temporal no respondió (ver ${path.join(dir, 'mongod.log')})`); }
  if (replicaSet) {
    await client.db('admin').command({ replSetInitiate: { _id: 'rs_pruebas', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    for (let i = 0; i < 80; i++) {
      if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) break;
      await esperar(250);
    }
  }
  await client.close();

  async function detener() {
    const fin = new Promise(r => proc.once('exit', r));
    matar();
    await Promise.race([fin, esperar(5000)]);
    process.removeListener('exit', matar);
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch { await esperar(300); }
    }
  }
  return { uri, port, dir, detener };
}

module.exports = { iniciarMongodTemporal, binarioMongod };
