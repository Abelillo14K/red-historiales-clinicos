'use strict';
// Prueba de la INTERFAZ del Hospital: navegador real (Edge o Chrome), servidor común y MySQL DESECHABLE.
//   npm run test:e2e:hospital   (compila el frontend y ejecuta este flujo)
// No toca historial_clinico real. Capturas en tests/e2e/capturas/ (ignoradas por Git).
process.env.JWT_SECRET = 'secreto-solo-para-la-prueba-e2e-0123456789abcdef';
process.env.JWT_ISSUER = 'centro-pediatrico-dev';
process.env.JWT_AUDIENCE = 'centro-pediatrico-api';
process.env.NODE_ENV = 'development';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');
const UI = require('../../../../tests/e2e/auditoria-ui');
const { crearApp } = require('../../../pediatria/backend/app');
const { crearServicios } = require('../../../pediatria/backend/application');
const { crearRepositoriosMemoria } = require('../../../pediatria/tests/doubles/memoria');
const { iniciarMysqlTemporal, binariosMysql } = require('../soporte/mysqlTemporal');

const BACKEND = path.join(__dirname, '..', '..', 'backend');
const DIST = path.join(__dirname, '..', '..', '..', '..', 'apps', 'web', 'dist');
const CAPTURAS = path.join(__dirname, 'capturas');
const CLAVE = 'clave-solo-para-e2e-123';
const ANIO = new Date().getFullYear() + 1;
const PESTANAS = ['Datos generales', 'Consultas', 'Diagnósticos', 'Tratamientos', 'Medicamentos', 'Exámenes', 'Hospitalizaciones', 'Antecedentes'];
const PANTALLAS = [['/', 'Panel principal'], ['/pacientes', 'Pacientes'], ['/citas', 'Agenda de citas'], ['/hospitalizacion', 'Hospitalización'], ['/catalogos', 'Catálogos'], ['/bitacora', 'Bitácora de acceso'], ['/archivados', 'Historiales archivados']];

const resultados = [], errores = [], fallasApi = [], problemasA11y = [], problemasContraste = [];
let browser, contexto, page, base;

async function paso(nombre, fn) {
  const t0 = Date.now();
  try {
    await fn();
    resultados.push({ nombre, ok: true });
    console.log(`  ✔ ${nombre} (${Date.now() - t0} ms)`);
  } catch (e) {
    resultados.push({ nombre, ok: false });
    console.log(`  ✖ ${nombre}\n    ${e.message.split('\n').slice(0, 8).join('\n    ')}`);
    if (page) await page.screenshot({ path: path.join(CAPTURAS, `ERROR-${resultados.length}.png`), fullPage: true }).catch(() => {});
    throw e;
  }
}
const h1 = texto => page.getByRole('heading', { level: 1, name: texto, exact: true }).waitFor();
const auditar = async nombre => { await UI.auditarAccesibilidad(page, nombre, problemasA11y); await UI.auditarContraste(page, nombre, problemasContraste); };
const desborde = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const nav = () => page.locator('.sidebar .nav a').allTextContents();
const elegirPaciente = async codigo => {
  await page.getByLabel('Buscar paciente').fill('Prueba');
  await page.locator('option', { hasText: codigo }).first().waitFor({ state: 'attached' });
  await page.locator(`select:has(option:has-text("${codigo}"))`).selectOption({ index: 1 });
};

async function entrar(usuario) {
  if (contexto) await contexto.close();
  contexto = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  page = await contexto.newPage();
  page.on('pageerror', e => errores.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errores.push(`${usuario}: ${m.text()}`); });
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) fallasApi.push(`${usuario}: ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  await page.goto(`${base}/login`);
  await page.getByLabel('Usuario').fill(usuario);
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.locator('.portal-card').first().waitFor();
  await page.getByRole('link', { name: 'Ingresar a Hospital General' }).click();
  await h1('Panel principal');
}

async function main() {
  if (!binariosMysql()) { console.log('Se omite: no hay MySQL Server (configure MYSQL_BIN)'); return; }
  if (!fs.existsSync(path.join(BACKEND, 'node_modules', 'mysql2'))) throw new Error('Falta npm run hospital:install');
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('Falta apps/web/dist: ejecute npm run build');
  fs.rmSync(CAPTURAS, { recursive: true, force: true });
  fs.mkdirSync(CAPTURAS, { recursive: true });

  const mysql = await iniciarMysqlTemporal();
  let modulo, server;
  const uno = sql => mysql.sql(`USE historial_clinico; ${sql}`);
  try {
    Object.assign(process.env, { HOSPITAL_DB_HOST: '127.0.0.1', HOSPITAL_DB_PORT: String(mysql.port), HOSPITAL_DB_USER: mysql.usuario, HOSPITAL_DB_PASSWORD: mysql.clave });
    for (const c of [['hosp.admin', 'administrador'], ['hosp.medico', 'medico', '1'], ['hosp.enfermeria', 'enfermeria'], ['hosp.recepcion', 'recepcion']]) {
      const r = spawnSync(process.execPath, [path.join(BACKEND, 'scripts', 'crear-usuario.js'), c[0], CLAVE, c[1], ...(c[2] ? [c[2]] : [])], { encoding: 'utf8', env: process.env, windowsHide: true });
      assert.equal(r.status, 0, r.stderr);
    }
    const importar = f => import(pathToFileURL(f).href);
    modulo = await (await importar(path.join(BACKEND, 'src', 'modulo.js'))).crearModuloHospital();
    const PERMISOS = (await importar(path.join(BACKEND, 'src', 'seguridad.js'))).PERMISOS_POR_ROL;
    const app = crearApp(crearServicios(crearRepositoriosMemoria()), { instituciones: { hospital_general: modulo } });
    server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    base = `http://127.0.0.1:${server.address().port}`;

    for (const channel of ['msedge', 'chrome']) {
      try { browser = await chromium.launch({ channel, headless: true }); break; } catch { /* probar el siguiente */ }
    }
    if (!browser) throw new Error('No se encontró Microsoft Edge ni Google Chrome instalados');
    console.log(`Navegador: ${browser.version()} · ${base}`);

    let idPaciente;
    await paso('Administrador: entra por el login común y ve el menú del Hospital', async () => {
      await entrar('hosp.admin');
      assert.deepEqual(await nav(), ['Panel', 'Pacientes', 'Agenda de citas', 'Hospitalización', 'Catálogos', 'Bitácora de acceso', 'Historiales archivados']);
      await auditar('Panel');
    });

    await paso('Registra un paciente desde el formulario', async () => {
      await page.goto(`${base}/pacientes/nuevo`);
      await h1('Registrar paciente');
      await page.getByLabel('Primer nombre').fill('Prueba');
      await page.getByLabel('Primer apellido').fill('Navegador');
      await page.getByLabel('Fecha de nacimiento').fill('1990-01-15');
      await page.getByLabel('Género').selectOption('Femenino');
      await page.getByLabel('DPI').fill('1000000000901');
      await page.getByLabel('Nombre completo').fill('Contacto Demo');
      await page.getByLabel('Parentesco').fill('Madre');
      await page.getByLabel('Teléfono').last().fill('22000000');
      await auditar('Registrar paciente');
      await page.getByRole('button', { name: 'Guardar y abrir historial' }).click();
      await page.waitForURL(/\/pacientes\/\d+/);
      idPaciente = /\/pacientes\/(\d+)/.exec(page.url())[1];
      assert.equal(uno('SELECT numero_expediente FROM paciente;'), 'HG-000001');
      await page.getByRole('heading', { level: 1, name: /Prueba/ }).waitFor();
    });

    await paso('El expediente abre sus ocho pestañas', async () => {
      for (const titulo of PESTANAS) {
        await page.getByRole('tab', { name: titulo, exact: true }).click();
        await page.getByRole('tabpanel', { name: titulo }).waitFor();
        await page.waitForLoadState('networkidle');
      }
      await auditar('Expediente');
    });

    await paso('Administrador: todas las pantallas cargan sin errores', async () => {
      for (const [ruta, titulo] of PANTALLAS) {
        await page.goto(`${base}${ruta}`);
        await h1(titulo);
        await page.waitForLoadState('networkidle');
        await auditar(titulo);
        await page.screenshot({ path: path.join(CAPTURAS, `admin${ruta.replace(/\W/g, '-')}.png`), fullPage: true });
      }
    });

    await paso('Catálogos: ofrece sus opciones', async () => {
      await page.goto(`${base}/catalogos`);
      await h1('Catálogos');
      await page.waitForLoadState('networkidle');
      assert.ok(await page.getByLabel('Catálogo').locator('option').count() > 1);
    });

    await paso('Médico: registra una consulta', async () => {
      await entrar('hosp.medico');
      await page.goto(`${base}/pacientes/${idPaciente}/consultas/nueva`);
      await h1('Nueva consulta');
      await page.getByLabel('Médico responsable').selectOption({ index: 1 });
      await page.getByLabel('Fecha y hora').fill(`${ANIO - 1}-01-10T10:00`);
      await page.getByLabel('Motivo de consulta').fill('Control de prueba');
      await auditar('Nueva consulta');
      await page.getByRole('button', { name: 'Registrar consulta' }).click();
      await page.waitForURL(u => !u.pathname.endsWith('/nueva'));
      assert.equal(uno('SELECT COUNT(*) FROM consulta;'), '1');
    });

    await paso('Recepción: programa una cita', async () => {
      await entrar('hosp.recepcion');
      await page.goto(`${base}/citas`);
      await h1('Agenda de citas');
      await elegirPaciente('HG-000001');
      await page.locator('form').filter({ has: page.getByRole('button', { name: 'Programar cita' }) }).getByLabel('Médico').selectOption({ index: 1 });
      await page.getByLabel('Fecha y hora').fill(`${ANIO}-03-10T09:00`);
      await page.getByLabel('Motivo').fill('Seguimiento');
      await page.getByRole('button', { name: 'Programar cita' }).click();
      await page.waitForFunction(() => document.querySelector('.toast'));
      assert.equal(uno('SELECT COUNT(*) FROM cita;'), '1');
      assert.equal((await page.getByRole('link', { name: 'Bitácora de acceso' }).count()), 0, 'recepción no ve la bitácora');
    });

    await paso('Médico: registra un ingreso y su egreso', async () => {
      await entrar('hosp.medico');
      await page.goto(`${base}/hospitalizacion`);
      await h1('Hospitalización');
      await elegirPaciente('HG-000001');
      await page.getByLabel('Cama disponible').selectOption({ index: 1 });
      await page.getByLabel('Médico tratante').selectOption({ index: 1 });
      await page.getByLabel('Motivo de ingreso').fill('Observación');
      await page.getByRole('button', { name: 'Registrar ingreso' }).click();
      await page.getByRole('button', { name: 'Registrar egreso' }).first().waitFor();
      assert.equal(uno('SELECT estado FROM cama WHERE id_cama = 1;'), 'Ocupada');
      await page.getByRole('button', { name: 'Registrar egreso' }).first().click();
      const d = page.locator('dialog[open]').last();
      await d.getByLabel('Condición de egreso').selectOption('Alta');
      await d.getByLabel('Diagnóstico de egreso').fill('Evolución favorable');
      await d.getByRole('button', { name: 'Registrar egreso' }).click();
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      assert.equal(uno('SELECT estado FROM cama WHERE id_cama = 1;'), 'Disponible');
    });

    await paso('Administrador: archiva el historial y lo encuentra en archivados', async () => {
      await entrar('hosp.admin');
      await page.goto(`${base}/pacientes/${idPaciente}/archivar`);
      await h1('Archivar historial clínico');
      await page.getByRole('radio', { name: /Causa administrativa/ }).check();
      for (const c of await page.getByRole('checkbox').all()) await c.check();
      await page.locator('form').getByRole('button', { name: /Archivar/ }).click();
      await page.locator('dialog[open]').last().getByRole('button', { name: 'Archivar' }).click();
      await page.waitForURL(u => !u.pathname.endsWith('/archivar'));
      assert.equal(uno('SELECT estado FROM paciente;'), 'Archivado');
      assert.equal(uno('SELECT estado_cita FROM cita;'), 'Cancelada');
      await page.goto(`${base}/archivados`);
      await h1('Historiales archivados');
      await page.getByText('HG-000001').first().waitFor();
    });

    await paso('Cada rol ve solo lo que su tabla de permisos le permite', async () => {
      for (const [usuario, rol] of [['hosp.enfermeria', 'enfermeria'], ['hosp.recepcion', 'recepcion'], ['hosp.medico', 'medico']]) {
        await entrar(usuario);
        const esperado = ['Panel', 'Pacientes', 'Agenda de citas', 'Hospitalización', 'Catálogos', 'Bitácora de acceso', 'Historiales archivados'];
        const permiso = { Panel: 'panel.ver', Pacientes: 'pacientes.listar', 'Agenda de citas': 'hospital.citas.ver', Hospitalización: 'hospital.hospitalizacion.ver', Catálogos: 'catalogos.ver', 'Bitácora de acceso': 'auditoria.leer', 'Historiales archivados': 'historial.leer_archivados' };
        assert.deepEqual(await nav(), esperado.filter(e => PERMISOS[rol].includes(permiso[e])), rol);
      }
    });

    await paso('Móvil (390 px): las pantallas no se desbordan', async () => {
      await entrar('hosp.admin');
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [ruta, titulo] of PANTALLAS) {
        await page.goto(`${base}${ruta}`);
        await h1(titulo);
        await page.waitForLoadState('networkidle');
        const d = await desborde();
        assert.ok(d <= 1, `${ruta}: desborde de ${d}px`);
      }
    });
  } finally {
    await browser?.close();
    if (server) await new Promise(r => server.close(r));
    await modulo?.cerrar().catch(() => {});
    await mysql.detener();
  }

  console.log(`\n${resultados.filter(r => r.ok).length}/${resultados.length} pasos correctos`);
  const informe = (titulo, lista) => console.log(lista.length ? `${titulo}:\n  ${[...new Set(lista)].join('\n  ')}` : `${titulo}: sin problemas`);
  informe('Peticiones a la API con error', fallasApi);
  informe('Consola del navegador', errores);
  informe('Accesibilidad básica', problemasA11y);
  informe('Contraste WCAG AA', problemasContraste);
  if (resultados.some(r => !r.ok) || fallasApi.length || errores.length || problemasA11y.length || problemasContraste.length) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
