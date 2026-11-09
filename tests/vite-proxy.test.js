'use strict';
// Inicio de sesión a través del proxy del servidor de desarrollo de Vite. Levanta Vite REAL
// con apps/web/vite.config.js y la API real (doble en memoria). Se omite sin Vite instalado
// o sin red IPv4.
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
const { fixtures, CONTRASENA_PRUEBA } = require('../instituciones/pediatria/tests/helpers');

const FRONTEND = path.join(__dirname, '..', 'apps', 'web');
const VITE = path.join(FRONTEND, 'node_modules', 'vite', 'dist', 'node', 'index.js');
const ipLan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
const omitir = !fs.existsSync(VITE) ? 'sin Vite (npm run web:install)' : !ipLan ? 'sin interfaz IPv4 externa' : false;

const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '0.0.0.0', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

describe('inicio de sesión a través del proxy de Vite con --host', { skip: omitir }, () => {
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
  const entrar = (host, port, contrasena = CONTRASENA_PRUEBA) => pedir(host, port, '/auth/login', { metodo: 'POST', body: { usuario: 'usr-administrador', contrasena } });

  test('por Vite: la contraseña correcta abre sesión y el frontend funciona', async () => {
    const login = await entrar('127.0.0.1', vitePort);
    assert.equal(login.status, 200);
    const sesion = await pedir('127.0.0.1', vitePort, '/api/sesion', { headers: { Authorization: `Bearer ${login.datos.token}` } });
    assert.equal(sesion.status, 200);
    const pagina = await pedir('localhost', vitePort, '/');
    assert.equal(pagina.status, 200);
    assert.match(pagina.datos, /<div id="root">/);
    assert.equal((await pedir('localhost', vitePort, '/salud')).datos.ok, true);
  });

  test('por Vite y desde la red: una contraseña incorrecta no abre sesión', async () => {
    for (const [host, port] of [['127.0.0.1', vitePort], [ipLan, vitePort], [ipLan, apiPort]]) {
      const r = await entrar(host, port, 'incorrecta');
      assert.equal(r.status, 401);
      assert.equal(r.datos.token, undefined);
    }
  });

  test('el acceso de desarrollo ya no existe detrás del proxy', async () => {
    const r = await pedir('127.0.0.1', vitePort, '/auth/dev-login', { metodo: 'POST', body: { rol: 'administrador' } });
    assert.equal(r.status, 404);
  });
});
