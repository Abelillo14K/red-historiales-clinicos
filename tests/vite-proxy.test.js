'use strict';
// /auth/dev-login detrás del servidor de desarrollo de Vite ejecutado como `vite --host`.
// Levanta Vite REAL con apps/web/vite.config.js y la API real (doble en memoria); el
// cliente "remoto" se conecta por la IP de red del propio equipo, así que el socket
// que ven Vite y Express no es loopback. Se omite sin Vite instalado o sin red IPv4.
require('../instituciones/pediatria/tests/helpers'); // variables de entorno de prueba (NODE_ENV=test, JWT_SECRET)
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { crearApp } = require('../instituciones/pediatria/backend/app');
const { crearServicios } = require('../instituciones/pediatria/backend/application');
const { crearRepositoriosMemoria } = require('../instituciones/pediatria/tests/doubles/memoria');
const { fixtures } = require('../instituciones/pediatria/tests/helpers');

const FRONTEND = path.join(__dirname, '..', 'apps', 'web');
const VITE = path.join(FRONTEND, 'node_modules', 'vite', 'dist', 'node', 'index.js');
const ipLan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
const omitir = !fs.existsSync(VITE) ? 'sin Vite (npm run web:install)' : !ipLan ? 'sin interfaz IPv4 externa' : false;

const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '0.0.0.0', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

describe('dev-login a través del proxy de Vite con --host', { skip: omitir }, () => {
  let api, vite, apiPort, vitePort;
  before(async () => {
    const app = crearApp(crearServicios(crearRepositoriosMemoria(fixtures())), { frontendDist: null });
    api = await new Promise(r => { const s = app.listen(0, '0.0.0.0', () => r(s)); });
    apiPort = api.address().port;
    vitePort = await puertoLibre();
    process.env.VITE_API_PROXY = `http://127.0.0.1:${apiPort}`; // vite.config.js lo lee al cargarse
    const { createServer } = await import(pathToFileURL(VITE).href);
    vite = await createServer({
      root: FRONTEND, configFile: path.join(FRONTEND, 'vite.config.js'), logLevel: 'silent',
      server: { host: '0.0.0.0', port: vitePort, strictPort: true, hmr: false }, optimizeDeps: { noDiscovery: true }
    });
    await vite.listen();
  });
  after(async () => {
    delete process.env.VITE_API_PROXY;
    await vite?.close();
    if (api) await new Promise(r => api.close(r));
  });

  const pedir = async (host, port, ruta, { metodo = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(`http://${host}:${port}${ruta}`, {
      method: metodo, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const texto = await res.text();
    let datos = texto;
    try { datos = JSON.parse(texto); } catch { /* HTML */ }
    return { status: res.status, datos };
  };
  const devLogin = (host, port, headers) => pedir(host, port, '/auth/dev-login', { metodo: 'POST', body: { rol: 'administrador' }, headers });

  test('local por Vite: la demo obtiene token y el frontend funciona', async () => {
    const login = await devLogin('127.0.0.1', vitePort);
    assert.equal(login.status, 200);
    assert.equal((await pedir('127.0.0.1', vitePort, '/auth/config')).datos.dev_login, true);
    const sesion = await pedir('127.0.0.1', vitePort, '/api/sesion', { headers: { Authorization: `Bearer ${login.datos.token}` } });
    assert.equal(sesion.status, 200);
    const pagina = await pedir('localhost', vitePort, '/');
    assert.equal(pagina.status, 200);
    assert.match(pagina.datos, /<div id="root">/);
    assert.equal((await pedir('localhost', vitePort, '/salud')).datos.ok, true);
  });

  test('remoto directo a la API: denegado', async () => {
    assert.equal((await devLogin(ipLan, apiPort)).status, 403);
  });

  test('remoto a través de Vite: denegado y sin botón de demo', async () => {
    const r = await devLogin(ipLan, vitePort);
    assert.equal(r.status, 403);
    assert.equal(r.datos.codigo, 'DEV_LOGIN_SOLO_LOCAL');
    assert.equal((await pedir(ipLan, vitePort, '/auth/config')).datos.dev_login, false);
  });

  test('X-Forwarded-For manipulado no elude la restricción', async () => {
    for (const xff of ['127.0.0.1', '::1', '127.0.0.1, 127.0.0.1', '::ffff:127.0.0.1']) {
      const h = { 'X-Forwarded-For': xff };
      assert.equal((await devLogin(ipLan, vitePort, h)).status, 403, `por Vite con XFF ${xff}`);
      assert.equal((await devLogin(ipLan, apiPort, h)).status, 403, `directo con XFF ${xff}`);
      assert.equal((await pedir(ipLan, vitePort, '/auth/config', { headers: h })).datos.dev_login, false);
    }
  });
});
