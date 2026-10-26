'use strict';
// Prueba en navegador real de la VISTA PREVIA de desarrollo de los módulos pendientes
// (Hospital General, Clínica Odontológica, Laboratorio Clínico).
//
//   npm run test:e2e:vista-previa
//
// Levanta Vite REAL (modo desarrollo, el único donde existe la vista previa) y la API
// real sobre el doble en memoria (no usa MongoDB). Comprueba que la vista previa no
// toca la sesión de Pediatría, no hace peticiones de otras instituciones ni escrituras,
// no permite guardar, funciona en claro y oscuro y no se desborda en 4 anchos.
// Capturas en tests/e2e/capturas-vista-previa/ (ignoradas por Git).
require('../../instituciones/pediatria/tests/helpers'); // variables de entorno de prueba (JWT_SECRET, NODE_ENV=test)
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');
const { crearApp } = require('../../instituciones/pediatria/backend/app');
const { crearServicios } = require('../../instituciones/pediatria/backend/application');
const { crearRepositoriosMemoria } = require('../../instituciones/pediatria/tests/doubles/memoria');
const { fixtures } = require('../../instituciones/pediatria/tests/helpers');
const UI = require('./auditoria-ui');

const FRONTEND = path.join(__dirname, '..', '..', 'apps', 'web');
const VITE = path.join(FRONTEND, 'node_modules', 'vite', 'dist', 'node', 'index.js');
const CAPTURAS = path.join(__dirname, 'capturas-vista-previa');

// Pantallas de cada módulo pendiente: [ruta relativa, h1 esperado] y pestañas del expediente.
const MODULOS = {
  hospital_general: {
    nombre: 'Hospital General',
    pantallas: [['', 'Panel principal'], ['pacientes', 'Pacientes'], ['pacientes/nuevo', 'Registrar paciente'],
      ['pacientes/vista-previa', 'Expediente clínico'], ['citas', 'Citas'], ['archivados', 'Historiales archivados']],
    pestanas: ['Consultas', 'Diagnósticos', 'Tratamientos', 'Medicamentos y prescripciones']
  },
  clinica_odontologica: {
    nombre: 'Clínica Odontológica',
    pantallas: [['', 'Panel principal'], ['pacientes', 'Pacientes'], ['pacientes/nuevo', 'Registrar paciente'],
      ['pacientes/vista-previa', 'Expediente clínico'], ['citas', 'Citas odontológicas'], ['archivados', 'Historiales archivados']],
    pestanas: ['Consultas', 'Diagnósticos', 'Tratamientos', 'Prescripciones', 'Piezas dentales']
  },
  laboratorio_clinico: {
    nombre: 'Laboratorio Clínico',
    pantallas: [['', 'Panel principal'], ['pacientes', 'Pacientes'], ['pacientes/nuevo', 'Registrar paciente'],
      ['pacientes/vista-previa', 'Expediente clínico'], ['solicitudes', 'Solicitudes de exámenes'], ['resultados', 'Resultados de laboratorio'],
      ['archivados', 'Historiales archivados']],
    pestanas: ['Solicitudes', 'Resultados', 'Historial de resultados', 'Atenciones relacionadas']
  }
};

const resultados = [];
const problemasA11y = [];
const problemasContraste = [];
let page, base;

async function paso(nombre, fn) {
  const t0 = Date.now();
  try {
    await fn();
    resultados.push({ nombre, ok: true });
    console.log(`  ✔ ${nombre} (${Date.now() - t0} ms)`);
  } catch (e) {
    resultados.push({ nombre, ok: false });
    console.log(`  ✖ ${nombre}\n    ${e.message.split('\n').slice(0, 6).join('\n    ')}`);
    if (page) await page.screenshot({ path: path.join(CAPTURAS, `ERROR-${resultados.length}.png`), fullPage: true }).catch(() => {});
    throw e;
  }
}
const captura = nombre => page.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`), fullPage: true });
const h1 = nombre => page.getByRole('heading', { level: 1, name: nombre, exact: true }).waitFor();
const desborde = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const auditar = async pantalla => { await UI.auditarAccesibilidad(page, pantalla, problemasA11y); await UI.auditarContraste(page, pantalla, problemasContraste); };
const esquema = () => page.evaluate(() => document.documentElement.dataset.esquema);
const token = () => page.evaluate(() => sessionStorage.getItem('plataforma.token'));
// Portal de instituciones visible y con su transición de entrada terminada.
const portal = async () => {
  await h1('Selecciona una institución');
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
};
const manifiestos = {}; // navegación declarada por cada módulo pendiente (su modulo.js)

const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
async function lanzarNavegador() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* probar el siguiente */ }
  }
  throw new Error('No se encontró Microsoft Edge ni Google Chrome instalados');
}

// Comprueba que la pantalla actual no permite guardar ni aparenta haber guardado.
async function sinEscritura(pantalla) {
  const estado = await page.evaluate(() => ({
    camposHabilitados: [...document.querySelectorAll('main input, main select, main textarea')].filter(e => !e.matches(':disabled')).length,
    botonesHabilitados: [...document.querySelectorAll('main button[type="submit"], main .btn-primary, main .btn-danger')]
      .filter(b => b.tagName === 'BUTTON' && !b.matches(':disabled')).map(b => b.textContent.trim()),
    toasts: document.querySelectorAll('.toast').length
  }));
  assert.equal(estado.camposHabilitados, 0, `${pantalla}: hay campos habilitados`);
  assert.deepEqual(estado.botonesHabilitados, [], `${pantalla}: hay acciones habilitadas`);
  assert.equal(estado.toasts, 0, `${pantalla}: se mostró una notificación`);
}

async function main() {
  if (!fs.existsSync(VITE)) throw new Error('Falta Vite: ejecute npm run web:ci');
  for (const carpeta of ['hospital', 'odontologia', 'laboratorio']) {
    const m = (await import(pathToFileURL(path.join(__dirname, '..', '..', 'instituciones', carpeta, 'frontend', 'modulo.js')).href)).default;
    manifiestos[m.institucion] = m;
  }
  fs.mkdirSync(CAPTURAS, { recursive: true });
  for (const f of fs.readdirSync(CAPTURAS)) fs.rmSync(path.join(CAPTURAS, f), { recursive: true, force: true });

  const app = crearApp(crearServicios(crearRepositoriosMemoria(fixtures())), { frontendDist: null });
  const api = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  process.env.VITE_API_PROXY = `http://127.0.0.1:${api.address().port}`; // vite.config.js lo lee al cargarse
  const { createServer } = await import(pathToFileURL(VITE).href);
  const vitePort = await puertoLibre();
  const vite = await createServer({
    root: FRONTEND, configFile: path.join(FRONTEND, 'vite.config.js'), logLevel: 'error',
    server: { host: '127.0.0.1', port: vitePort, strictPort: true, hmr: false }
  });
  await vite.listen();
  base = `http://localhost:${vitePort}`;
  const browser = await lanzarNavegador();
  const errores = [];
  // Peticiones a la API durante la vista previa (fase activa entre el ingreso y la salida).
  let registrar = false;
  const peticiones = [];

  try {
    const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-GT', colorScheme: 'light' });
    page = await contexto.newPage();
    page.on('pageerror', e => errores.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('request', r => {
      const u = new URL(r.url());
      if (registrar && /^\/(api|auth)\//.test(u.pathname)) peticiones.push(`${r.method()} ${u.pathname}`);
    });
    console.log(`Navegador: ${browser.version()} · Vite (desarrollo): ${base} · API en memoria: ${process.env.VITE_API_PROXY}`);

    let tokenOriginal;
    await paso('Sesión real de Pediatría y enlace de desarrollo a la vista previa', async () => {
      await page.goto(`${base}/login`);
      await page.getByRole('link', { name: 'Vista previa de los módulos pendientes' }).waitFor();
      await page.getByLabel('Administrador', { exact: true }).check();
      await page.getByLabel('Identificador de usuario').fill('E2E-VP-ADMIN');
      await page.getByRole('button', { name: 'Entrar (modo desarrollo)' }).click();
      await portal();
      await page.getByRole('link', { name: 'Ingresar a Centro Médico Pediátrico' }).click();
      await h1('Panel principal');
      tokenOriginal = await token();
      assert.ok(tokenOriginal, 'la sesión de Pediatría tiene token');
    });

    await paso('Portal (desarrollo): «Ver diseño» abre cada módulo pendiente con su propio menú y se regresa al portal', async () => {
      registrar = true;
      await page.goto(`${base}/instituciones`);
      await portal();
      const estados = await page.locator('.portal-card').evaluateAll(ts => ts.map(t => [t.querySelector('h2').textContent, t.querySelector('.badge').textContent]));
      assert.deepEqual(estados, [['Centro Médico Pediátrico', 'Disponible'], ...Object.values(MODULOS).map(m => [m.nombre, 'Pendiente de integración'])]);
      await page.getByRole('link', { name: 'Ingresar a Centro Médico Pediátrico' }).waitFor();
      await auditar('Portal (desarrollo, claro)');
      await captura('vp-portal-claro');
      for (const [inst, m] of Object.entries(MODULOS)) {
        await page.getByRole('link', { name: `Ver diseño de ${m.nombre}` }).click();
        await h1('Panel principal');
        assert.equal(new URL(page.url()).pathname, `/vista-previa/${inst}`);
        assert.equal(await page.locator('.sidebar-institution b').textContent(), m.nombre);
        await page.locator('.preview-banner').waitFor();
        // El menú lateral muestra solo las secciones de esta institución.
        const nav = await page.locator('.sidebar .nav a').allTextContents();
        assert.deepEqual(nav, manifiestos[inst].navegacion.map(n => n.etiqueta), `${m.nombre}: menú lateral`);
        await sinEscritura(`${m.nombre} desde el portal`);
        await page.locator('.sidebar').getByRole('link', { name: 'Volver a instituciones' }).click();
        await portal();
        assert.equal(await token(), tokenOriginal, `${m.nombre}: la sesión no cambió`);
      }
      // Pediatría (acceso real) conserva su propio menú, sin mezclar secciones de otras instituciones.
      // Sus peticiones (GET /api/panel) son del acceso real: no cuentan como peticiones de la vista previa.
      registrar = false;
      await page.getByRole('link', { name: 'Ingresar a Centro Médico Pediátrico' }).click();
      await h1('Panel principal');
      assert.deepEqual(await page.locator('.sidebar .nav a').allTextContents(), ['Panel', 'Pacientes', 'Vacunación', 'Médicos', 'Historiales archivados', 'Auditoría']);
      assert.equal(await page.locator('.preview-banner').count(), 0);
      await page.waitForLoadState('networkidle');
      await page.locator('.sidebar').getByRole('link', { name: 'Volver a instituciones' }).click();
      await portal();
      registrar = true;
    });

    await paso('Estado de integración: Pediatría implementada y tres instituciones pendientes', async () => {
      await page.goto(`${base}/vista-previa`);
      await h1('Estado de integración');
      const tarjetas = page.locator('.integration-card');
      assert.equal(await tarjetas.count(), 4);
      const estados = await tarjetas.evaluateAll(ts => ts.map(t => [t.querySelector('h2').textContent, t.querySelector('.badge').textContent]));
      assert.deepEqual(estados, [
        ['Centro Médico Pediátrico', 'Implementado'], ['Hospital General', 'Pendiente de integrar'],
        ['Clínica Odontológica', 'Pendiente de integrar'], ['Laboratorio Clínico', 'Pendiente de integrar']
      ]);
      await auditar('Estado de integración');
      await captura('vp-estado-integracion-claro');
    });

    await paso('Un módulo conectado o inexistente no se abre en la vista previa', async () => {
      await page.goto(`${base}/vista-previa/centro_pediatrico`);
      await page.getByText('Este módulo ya está conectado').waitFor();
      await page.goto(`${base}/vista-previa/institucion_inexistente`);
      await page.getByText('Módulo no encontrado').waitFor();
    });

    for (const [inst, m] of Object.entries(MODULOS)) {
      await paso(`${m.nombre}: todas las pantallas, sin datos ni escritura (claro)`, async () => {
        await page.goto(`${base}/vista-previa`);
        await page.locator('.integration-card').filter({ hasText: m.nombre }).getByRole('link', { name: 'Abrir vista previa' }).click();
        await h1('Panel principal');
        assert.equal(await page.locator('.sidebar-institution b').textContent(), m.nombre);
        for (const [ruta, titulo] of m.pantallas) {
          // Navegación por la interfaz: menú lateral, acción rápida o enlace del listado.
          const enMenu = page.locator('.sidebar .nav a').filter({ hasText: new RegExp(`^${titulo === 'Panel principal' ? 'Panel' : titulo}$`) });
          if (ruta === 'pacientes/nuevo') await page.getByRole('link', { name: 'Registrar paciente' }).first().click();
          else if (ruta === 'pacientes/vista-previa') {
            await page.locator('.sidebar .nav a').filter({ hasText: /^Pacientes$/ }).click();
            await h1('Pacientes');
            await page.getByRole('link', { name: 'ver la estructura del expediente' }).click();
          } else if (await enMenu.count()) await enMenu.first().click();
          else await page.goto(`${base}/vista-previa/${inst}/${ruta}`);
          await h1(titulo);
          assert.equal(new URL(page.url()).pathname, `/vista-previa/${inst}${ruta ? `/${ruta}` : ''}`);
          await page.locator('.preview-banner').waitFor();
          await page.locator('.pending-note').first().waitFor();
          await sinEscritura(`${m.nombre} ${ruta || 'panel'}`);
          await auditar(`${m.nombre} ${ruta || 'panel'} (claro)`);
          await captura(`vp-${inst}-${(ruta || 'panel').replace(/\W+/g, '-')}-claro`);
        }
        // Pestañas del expediente: cada una cambia la URL sin salir de la vista previa.
        await page.goto(`${base}/vista-previa/${inst}/pacientes/vista-previa`);
        await h1('Expediente clínico');
        for (const p of m.pestanas) {
          await page.getByRole('tab', { name: p, exact: true }).click();
          await page.getByRole('tabpanel', { name: p }).waitFor();
          await sinEscritura(`${m.nombre} expediente ${p}`);
          await auditar(`${m.nombre} expediente ${p}`);
        }
        await captura(`vp-${inst}-expediente-ultima-pestana-claro`);
      });
    }

    await paso('Tema oscuro desde la vista previa (persistente) y contraste', async () => {
      await page.goto(`${base}/vista-previa/hospital_general`);
      await h1('Panel principal');
      await page.getByRole('button', { name: 'Tema oscuro' }).click();
      assert.equal(await esquema(), 'oscuro');
      await page.reload();
      await h1('Panel principal');
      assert.equal(await esquema(), 'oscuro', 'la preferencia se conserva al recargar');
      await page.goto(`${base}/vista-previa`);
      await h1('Estado de integración');
      await auditar('Estado de integración (oscuro)');
      await captura('vp-estado-integracion-oscuro');
      await page.goto(`${base}/instituciones`);
      await portal();
      assert.equal(await esquema(), 'oscuro', 'el portal conserva el tema elegido en la vista previa');
      await auditar('Portal (desarrollo, oscuro)');
      await captura('vp-portal-oscuro');
      for (const [inst, m] of Object.entries(MODULOS)) {
        for (const [ruta, titulo] of m.pantallas) {
          await page.goto(`${base}/vista-previa/${inst}${ruta ? `/${ruta}` : ''}`);
          await h1(titulo);
          assert.equal(await esquema(), 'oscuro');
          await auditar(`${m.nombre} ${ruta || 'panel'} (oscuro)`);
          await captura(`vp-${inst}-${(ruta || 'panel').replace(/\W+/g, '-')}-oscuro`);
        }
      }
    });

    await paso('Escritorio 1920, portátil 1366, tablet 820 y móvil 390 px: sin desbordes; menú móvil', async () => {
      for (const esq of ['claro', 'oscuro']) {
        await page.evaluate(t => localStorage.setItem('plataforma.tema', t), esq);
        for (const ancho of [1920, 1366, 820, 390]) {
          await page.setViewportSize({ width: ancho, height: ancho > 800 ? 900 : 844 });
          await page.goto(`${base}/vista-previa`);
          await h1('Estado de integración');
          assert.ok(await desborde() <= 1, `${ancho}px estado: desborde de ${await desborde()}px`);
          if (ancho === 390) await captura(`vp-movil-estado-integracion-${esq}`);
          await page.goto(`${base}/instituciones`);
          await portal();
          assert.ok(await desborde() <= 1, `${esq} ${ancho}px portal: desborde de ${await desborde()}px`);
          if (ancho === 390) {
            await captura(`vp-movil-portal-${esq}`);
            // En móvil: «Ver diseño», menú desplegable y regreso al portal.
            await page.getByRole('link', { name: 'Ver diseño de Laboratorio Clínico' }).click();
            await h1('Panel principal');
            await page.getByRole('button', { name: 'Abrir menú' }).click();
            await page.locator('.app.menu-open').waitFor();
            await page.locator('.sidebar').getByRole('link', { name: 'Volver a instituciones' }).click();
            await portal();
          }
          for (const [inst, m] of Object.entries(MODULOS)) {
            for (const [ruta, titulo] of m.pantallas) {
              await page.goto(`${base}/vista-previa/${inst}${ruta ? `/${ruta}` : ''}`);
              await h1(titulo);
              const d = await desborde();
              assert.ok(d <= 1, `${esq} ${ancho}px ${inst}/${ruta}: desborde horizontal de ${d}px`);
            }
            if (ancho === 390) {
              await page.goto(`${base}/vista-previa/${inst}/pacientes`);
              await h1('Pacientes');
              await captura(`vp-movil-${inst}-pacientes-${esq}`);
              await page.getByRole('button', { name: 'Abrir menú' }).click();
              await page.locator('.sidebar .nav a').filter({ hasText: /^Panel$/ }).click();
              await h1('Panel principal');
              if (esq === 'oscuro') await captura(`vp-movil-${inst}-panel-oscuro`);
            }
          }
        }
      }
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.evaluate(() => localStorage.removeItem('plataforma.tema'));
    });

    await paso('La vista previa no modificó la sesión ni hizo peticiones de otras instituciones o escrituras', async () => {
      registrar = false;
      assert.equal(await token(), tokenOriginal, 'el token de la sesión no cambió');
      const distintas = [...new Set(peticiones)];
      assert.deepEqual(distintas.filter(p => p !== 'GET /api/sesion'), [], `peticiones inesperadas: ${distintas.join(', ')}`);
      // De vuelta en la aplicación real: la misma sesión de Pediatría, con su navegación.
      await page.goto(base);
      await h1('Panel principal');
      assert.match(await page.locator('.institution-chip').textContent(), /Centro Médico Pediátrico/);
      const nav = await page.locator('.sidebar .nav a').allTextContents();
      assert.deepEqual(nav, ['Panel', 'Pacientes', 'Vacunación', 'Médicos', 'Historiales archivados', 'Auditoría']);
      console.log(`    peticiones a la API durante la vista previa: ${peticiones.length} (todas GET /api/sesion de la sesión de Pediatría al recargar)`);
    });
  } finally {
    await browser.close();
    await vite.close();
    await new Promise(r => api.close(r));
  }

  console.log(`\n${resultados.filter(r => r.ok).length}/${resultados.length} pasos correctos`);
  if (errores.length) console.log(`Errores de consola del navegador:\n  ${errores.join('\n  ')}`);
  else console.log('Consola del navegador: sin errores');
  if (problemasA11y.length) console.log(`Problemas de accesibilidad:\n  ${problemasA11y.join('\n  ')}`);
  else console.log('Accesibilidad básica: sin problemas en las pantallas auditadas');
  if (problemasContraste.length) console.log(`Problemas de contraste (WCAG AA):\n  ${problemasContraste.join('\n  ')}`);
  else console.log('Contraste WCAG AA: sin problemas en las pantallas auditadas (claro y oscuro)');
  if (resultados.some(r => !r.ok) || errores.length || problemasA11y.length || problemasContraste.length) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
