'use strict';
// Módulos institucionales preparados para el equipo (hospital, odontología, laboratorio)
// y vista previa de desarrollo. Mientras un módulo NO esté registrado en registro.js
// (pendiente de integración) no declara operaciones, no hace peticiones ni simula guardar.
// Al registrarlo, sus pruebas pasan a tests/frontend-modulos.test.js (docs/FRONTEND_EQUIPO.md §7)
// y estas comprobaciones dejan de aplicarle automáticamente.
const { test, before, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PERMISOS_POR_ROL } = require('../instituciones/pediatria/backend/permisos');

const SRC = path.join(__dirname, '..', 'apps', 'web', 'src');
const FRONTEND = path.join(__dirname, '..', 'apps', 'web');
const VITE = path.join(FRONTEND, 'node_modules', 'vite', 'dist', 'node', 'index.js');
const ruta = r => pathToFileURL(path.join(SRC, r)).href;
const INST = path.join(__dirname, '..', 'instituciones');
const frontendDe = carpeta => path.join(INST, carpeta, 'frontend');
// Carpeta → prefijo de sus permisos exclusivos (los comunes son los de §9 de la guía).
const PENDIENTES = { hospital: 'hospital', odontologia: 'odontologia', laboratorio: 'laboratorio' };
const COMUNES = new Set(Object.values(PERMISOS_POR_ROL).flat());

// Código sin comentarios (los comentarios documentan qué usar al conectar, p. ej. useCarga).
const codigo = f => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const archivos = dir => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? archivos(path.join(dir, e.name)) : [path.join(dir, e.name)]));

let C, registro, modulos;
// Carpetas cuyo módulo aún no está registrado (se calcula con el registro real).
const pendientes = () => Object.keys(PENDIENTES).filter(c => !registro.modulo(modulos[c].institucion));
before(async () => {
  C = await import(ruta('plataforma/modulos/contrato.js'));
  registro = (await import(ruta('plataforma/modulos/registro.js'))).registro;
  modulos = {};
  for (const carpeta of Object.keys(PENDIENTES)) modulos[carpeta] = (await import(pathToFileURL(path.join(frontendDe(carpeta), 'modulo.js')).href)).default;
});

test('cada módulo pendiente tiene su estructura de carpetas y README', () => {
  for (const carpeta of Object.keys(PENDIENTES)) {
    assert.ok(fs.existsSync(path.join(INST, carpeta, 'README.md')), `falta instituciones/${carpeta}/README.md`);
    for (const x of ['modulo.js', 'api.js', 'paginas', 'componentes']) {
      assert.ok(fs.existsSync(path.join(frontendDe(carpeta), x)), `falta instituciones/${carpeta}/frontend/${x}`);
    }
  }
});

test('los módulos pendientes cumplen el contrato y usan identificadores distintos', () => {
  const ids = new Set(['centro_pediatrico']);
  for (const [carpeta, m] of Object.entries(modulos)) {
    assert.doesNotThrow(() => C.validarModulo(m), carpeta);
    assert.ok(!ids.has(m.institucion), `institución repetida: ${m.institucion}`);
    ids.add(m.institucion);
  }
  assert.doesNotThrow(() => C.crearRegistro([registro.modulo('centro_pediatrico'), ...Object.values(modulos)]));
});

test('un módulo no registrado no se carga en la interfaz real (Pediatría sí)', () => {
  assert.ok(registro.instituciones().includes('centro_pediatrico'));
  for (const m of pendientes().map(c => modulos[c])) {
    // Un token de esa institución sigue viendo «Institución no disponible en esta interfaz».
    assert.equal(C.resolverSesion(registro, { usuario: 'U', rol: 'x', institucion: m.institucion, permisos: [] }).estado, 'institucion_sin_interfaz');
  }
});

test('roles y permisos no se inventan: roles vacíos, permisos comunes o con el prefijo de la institución', () => {
  for (const [carpeta, m] of Object.entries(modulos)) {
    if (pendientes().includes(carpeta)) assert.deepEqual(m.roles, {}, `${carpeta}: los roles los define su backend`);
    for (const x of [...m.rutas, ...(m.navegacion || [])]) {
      if (!x.permiso) continue;
      assert.ok(COMUNES.has(x.permiso) || x.permiso.startsWith(`${PENDIENTES[carpeta]}.`), `${carpeta}: permiso ${x.permiso}`);
    }
  }
});

test('api.js de un módulo pendiente no declara operaciones ni hace peticiones', () => {
  const llamadas = [];
  const espia = new Proxy({}, { get: (_, k) => (...a) => { llamadas.push([k, ...a]); return Promise.resolve(null); } });
  for (const carpeta of pendientes()) {
    assert.deepEqual(modulos[carpeta].crearApi(espia), {}, `${carpeta}: sin endpoints hasta que exista su backend`);
  }
  assert.deepEqual(llamadas, []);
});

test('las páginas pendientes no simulan guardar ni consultan datos', () => {
  const prohibido = [/useNotificar|useEnvio|notificar\(/, /useCarga\(/, /\bapi\??\.[a-zA-Z]+\s*[.(]/, /fetch\(/, /onSubmit=\{(?!e => e\.preventDefault)/];
  for (const carpeta of pendientes()) {
    for (const f of archivos(frontendDe(carpeta)).filter(f => f.endsWith('.jsx'))) {
      const s = codigo(f);
      for (const p of prohibido) assert.ok(!p.test(s), `${path.relative(INST, f)} contiene ${p}`);
    }
  }
});

test('ningún módulo institucional importa código de otra institución ni rutas relativas fuera de su carpeta', () => {
  for (const carpeta of fs.readdirSync(INST)) {
    const raiz = frontendDe(carpeta);
    if (!fs.existsSync(raiz)) continue;
    for (const f of archivos(raiz).filter(f => /\.(js|jsx)$/.test(f))) {
      const imports = [...codigo(f).matchAll(/(?:from|import\()\s*'([^']+)'/g)].map(m => m[1]);
      for (const i of imports) {
        const donde = `${path.relative(INST, f)} importa ${i}`;
        if (i.startsWith('.')) assert.ok(!path.relative(raiz, path.resolve(path.dirname(f), i)).startsWith('..'), donde);
        else if (i.startsWith('@instituciones/')) assert.ok(i.startsWith(`@instituciones/${carpeta}/`), donde);
        else assert.ok(i.startsWith('@plataforma/') || ['react', 'react-dom', 'react-router-dom'].includes(i.split('/')[0]), donde);
      }
    }
  }
});

test('la vista previa solo se monta en desarrollo y no usa la sesión ni emite tokens', () => {
  const app = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
  assert.match(app, /import\.meta\.env\.DEV \? lazy\(\(\) => import\('\.\/plataforma\/vista-previa\/VistaPrevia\.jsx'\)\) : null/);
  for (const f of archivos(path.join(SRC, 'plataforma', 'vista-previa'))) {
    const s = codigo(f);
    assert.ok(!/useSesion|sessionStorage|devLogin|iniciarConToken|crearHttp/.test(s), `${path.basename(f)} no debe tocar la sesión`);
  }
});

describe('compilación de producción', { skip: fs.existsSync(VITE) ? false : 'sin Vite (npm run web:ci)' }, () => {
  test('no incluye la vista previa ni los módulos no registrados; sí Pediatría y el portal', async () => {
    const { build } = await import(pathToFileURL(VITE).href);
    const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'pediatria-build-'));
    try {
      await build({ root: FRONTEND, configFile: path.join(FRONTEND, 'vite.config.js'), logLevel: 'silent', build: { outDir: salida, emptyOutDir: true } });
      const js = archivos(salida).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
      assert.ok(js.includes('centro_pediatrico'), 'Pediatría debe estar en la compilación');
      // El portal sí está (con las cuatro presentaciones), pero sin la acción de vista previa.
      assert.ok(js.includes('Selecciona una institución'), 'el portal debe estar en la compilación');
      for (const m of Object.values(modulos)) assert.ok(js.includes(m.nombre), `el portal muestra ${m.nombre}`);
      for (const marca of ['vista-previa', 'Vista previa', 'Ver diseño', ...pendientes().map(c => modulos[c].institucion)]) {
        assert.ok(!js.includes(marca), `la compilación de producción contiene «${marca}»`);
      }
    } finally {
      fs.rmSync(salida, { recursive: true, force: true });
    }
  });
});
