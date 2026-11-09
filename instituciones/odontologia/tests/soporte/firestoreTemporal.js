'use strict';
// Emulador de Cloud Firestore DESECHABLE para pruebas de integración: proceso Java propio, puerto libre
// y solo 127.0.0.1. Nunca toca el proyecto real de Firebase; al terminar se detiene y no deja datos.
// Requiere Java 21+ y el emulador descargado (npx firebase-tools setup:emulators:firestore)
// o FIRESTORE_EMULATOR_JAR con la ruta del .jar.
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const esperar = ms => new Promise(r => setTimeout(r, ms));

function jarEmulador() {
  if (process.env.FIRESTORE_EMULATOR_JAR) return fs.existsSync(process.env.FIRESTORE_EMULATOR_JAR) ? process.env.FIRESTORE_EMULATOR_JAR : null;
  const dir = path.join(os.homedir(), '.cache', 'firebase', 'emulators');
  if (!fs.existsSync(dir)) return null;
  const jars = fs.readdirSync(dir).filter(f => /^cloud-firestore-emulator-v[\d.]+\.jar$/.test(f)).sort();
  return jars.length ? path.join(dir, jars.at(-1)) : null;
}

// Java 21 o superior (lo exige el emulador actual).
function javaDisponible() {
  const r = spawnSync('java', ['-version'], { encoding: 'utf8', windowsHide: true });
  const m = /version "(\d+)/.exec(`${r.stderr}${r.stdout}`);
  return Boolean(m && Number(m[1]) >= 21);
}

const motivoOmision = () => (!javaDisponible() ? 'sin Java 21+ para el emulador de Firestore'
  : !jarEmulador() ? 'sin emulador de Firestore (npx firebase-tools setup:emulators:firestore)' : false);

const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function iniciarFirestoreTemporal(proyecto = 'demo-odontologia-pruebas') {
  const jar = jarEmulador();
  if (!jar || !javaDisponible()) return null;
  const [port, ws] = [await puertoLibre(), await puertoLibre()];
  const proc = spawn('java', ['-jar', jar, '--host', '127.0.0.1', '--port', String(port), '--websocket_port', String(ws),
    '--project_id', proyecto, '--single_project_mode', 'true'], { stdio: 'ignore', windowsHide: true });
  const matar = () => { try { proc.kill(); } catch { /* ya terminó */ } };
  process.once('exit', matar);
  const host = `127.0.0.1:${port}`;
  let listo = false;
  for (let i = 0; i < 120 && !listo; i++) {
    try { listo = (await fetch(`http://${host}/`)).ok; } catch { await esperar(250); }
  }
  if (!listo) { matar(); throw new Error('El emulador de Firestore no respondió'); }

  return {
    host, proyecto,
    // Borra todos los documentos del proyecto de pruebas (API del emulador).
    async vaciar() {
      const r = await fetch(`http://${host}/emulator/v1/projects/${proyecto}/databases/(default)/documents`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`No se pudo vaciar el emulador: ${r.status}`);
    },
    async detener() {
      const fin = new Promise(r => proc.once('exit', r));
      matar();
      await Promise.race([fin, esperar(5000)]);
      process.removeListener('exit', matar);
    }
  };
}

module.exports = { iniciarFirestoreTemporal, motivoOmision };
