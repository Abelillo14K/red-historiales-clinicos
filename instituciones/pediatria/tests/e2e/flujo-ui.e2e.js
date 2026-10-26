'use strict';
// Prueba de extremo a extremo de la INTERFAZ: navegador real (Edge o Chrome
// instalados, mediante playwright-core) + API Express real + MongoDB real en una
// instancia desechable (tests/soporte/mongodTemporal.js). No toca centro_pediatrico_db.
//
//   npm run test:e2e        (compila el frontend y ejecuta este flujo)
//
// Capturas de pantalla en instituciones/pediatria/tests/e2e/capturas/ (ignoradas por Git).
process.env.JWT_SECRET = 'secreto-solo-para-la-prueba-e2e-0123456789abcdef';
process.env.JWT_ISSUER = 'centro-pediatrico-dev';
process.env.JWT_AUDIENCE = 'centro-pediatrico-api';
process.env.NODE_ENV = 'development';
delete process.env.CORS_ORIGIN;

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { chromium } = require('playwright-core');
const { iniciarMongodTemporal } = require('../soporte/mongodTemporal');
const UI = require('../../../../tests/e2e/auditoria-ui'); // auditorías comunes de la plataforma
const { crearRepositoriosMongo, asegurarIndices } = require('../../backend/adapters/mongo');
const A = require('../../backend/adapters/mongo/administracionValidadores');
const { crearServicios } = require('../../backend/application');
const { crearApp } = require('../../backend/app');
const { firmarTokenDesarrollo } = require('../../backend/security');

const CAPTURAS = path.join(__dirname, 'capturas');
const DIST = path.join(__dirname, '..', '..', '..', '..', 'apps', 'web', 'dist');
const NAVEGADORES = ['msedge', 'chrome'];
const resultados = [];
let page, base, simulandoCaida = false;

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
const toast = texto => page.locator('.toast').filter({ hasText: texto }).first().waitFor({ timeout: 8000 });
const dialogo = () => page.locator('dialog[open]').last();

async function entrar(rol, usuario) {
  await page.goto(`${base}/login`);
  const etiqueta = { medico: 'Médico', secretaria: 'Secretaría', administrador: 'Administrador' }[rol];
  await page.getByLabel(etiqueta, { exact: true }).check();
  await page.getByLabel('Identificador de usuario').fill(usuario);
  await page.getByRole('button', { name: 'Entrar (modo desarrollo)' }).click();
  // Nuevo flujo: inicio de sesión → portal de instituciones → panel de Pediatría.
  await portal();
  await page.getByRole('link', { name: 'Ingresar a Centro Médico Pediátrico' }).click();
  await page.getByRole('heading', { name: 'Panel principal' }).waitFor();
}
// Portal visible y con su transición de entrada terminada (capturas y contraste fiables).
const portal = async () => {
  await page.getByRole('heading', { level: 1, name: 'Selecciona una institución' }).waitFor();
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
};
const tokenSesion = () => page.evaluate(() => sessionStorage.getItem('plataforma.token'));
const desbordeHorizontal = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
// [nombre, estado] de cada tarjeta del portal.
const tarjetasPortal = () => page.locator('.portal-card').evaluateAll(ts => ts.map(t => [t.querySelector('h2').textContent, t.querySelector('.badge').textContent]));
const PORTAL_PRODUCCION = [['Centro Médico Pediátrico', 'Disponible'], ['Hospital General', 'Pendiente de integración'],
  ['Clínica Odontológica', 'Pendiente de integración'], ['Laboratorio Clínico', 'Pendiente de integración']];
async function salir() {
  await page.getByRole('button', { name: /^Menú de usuario/ }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
}

// Auditorías de accesibilidad básica y de contraste WCAG AA (tests/e2e/auditoria-ui.js).
const problemasA11y = [];
const problemasContraste = [];
const auditarAccesibilidad = pantalla => UI.auditarAccesibilidad(page, pantalla, problemasA11y);
const auditarContraste = pantalla => UI.auditarContraste(page, pantalla, problemasContraste);
const filasIndicadores = () => page.evaluate(() => new Set([...document.querySelectorAll('.stats .stat')].map(e => Math.round(e.getBoundingClientRect().top))).size);
const cuentaIndicadores = () => page.locator('.stats .stat').count();
const temaActual = () => page.evaluate(() => ({ tema: document.documentElement.dataset.tema, esquema: document.documentElement.dataset.esquema }));

// Llamada directa a la API con el token de la sesión del navegador (para probar
// protecciones del servidor que la interfaz ya impide).
const apiDesdeNavegador = (metodo, ruta, cuerpo) => page.evaluate(async ([m, r, c]) => {
  const t = sessionStorage.getItem('plataforma.token');
  const res = await fetch(r, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined });
  return { status: res.status, datos: await res.json().catch(() => null) };
}, [metodo, ruta, cuerpo]);

async function lanzarNavegador() {
  for (const channel of NAVEGADORES) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* probar el siguiente */ }
  }
  throw new Error('No se encontró Microsoft Edge ni Google Chrome instalados');
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('Falta apps/web/dist: ejecute npm run build');
  fs.mkdirSync(CAPTURAS, { recursive: true });
  for (const f of fs.readdirSync(CAPTURAS)) fs.rmSync(path.join(CAPTURAS, f));

  const mongo = await iniciarMongodTemporal();
  if (!mongo) throw new Error('No hay binario mongod (defina MONGOD_BIN)');
  const client = new MongoClient(mongo.uri);
  await client.connect();
  const db = client.db('centro_pediatrico_e2e_test');
  for (const c of A.COLECCIONES) await db.createCollection(c);
  await A.aplicar(db);
  await asegurarIndices(db);
  await db.collection('medicos').insertMany([
    { id_medico: 'M001', colegiado: 'COL-E1', nombres: 'Ana', apellidos: 'Ficticia', especialidad: { id_especialidad: 'E001', nombre: 'Pediatría General' } },
    { id_medico: 'M002', colegiado: 'COL-E2', nombres: 'Luis', apellidos: 'Ficticio', especialidad: { id_especialidad: 'E002', nombre: 'Neonatología' } }
  ]);
  await db.collection('vacunas').insertMany([
    { id_vacuna: 'V001', nombre: 'Vacuna ficticia A', descripcion: 'Solo pruebas' },
    { id_vacuna: 'V002', nombre: 'Vacuna ficticia B', descripcion: 'Solo pruebas' }
  ]);

  const app = crearApp(crearServicios(crearRepositoriosMongo(client, db)), { frontendDist: DIST });
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
  const browser = await lanzarNavegador();
  const erroresConsola = [];
  let id;

  try {
    // E2E_ESQUEMA=dark|light fija la preferencia de color del sistema (por defecto: light).
    const colorScheme = process.env.E2E_ESQUEMA === 'dark' ? 'dark' : 'light';
    const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-GT', colorScheme });
    page = await contexto.newPage();
    page.on('pageerror', e => erroresConsola.push(e.message));
    // Se ignoran las respuestas 4xx esperadas (pruebas de permisos y duplicados) y los
    // rechazos de conexión provocados a propósito en el paso de caída de la API.
    page.on('console', m => {
      if (m.type() !== 'error' || /status of (4\d\d)/.test(m.text()) || (simulandoCaida && /ERR_CONNECTION_REFUSED/.test(m.text()))) return;
      erroresConsola.push(m.text());
    });
    console.log(`Navegador: ${browser.version()} · API: ${base} · MongoDB desechable: ${mongo.uri}`);

    await paso('1. Iniciar sesión con rol de desarrollo (secretaría)', async () => {
      await page.goto(base);
      await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
      await page.getByRole('button', { name: 'Entrar (modo desarrollo)' }).waitFor();
      await auditarAccesibilidad('Inicio de sesión'); await auditarContraste('Inicio de sesión');
      await captura('00-login');
      await entrar('secretaria', 'E2E-SEC');
      await captura('01-panel-secretaria');
    });

    await paso('2. Panel principal con estadísticas reales', async () => {
      const valor = await page.locator('.stat').filter({ hasText: 'Pacientes activos' }).locator('.value').textContent();
      assert.equal(valor, '0');
      assert.equal(await page.locator('.stat').filter({ hasText: 'Consultas registradas' }).count(), 0, 'secretaría no ve contadores clínicos');
      // Estructura compartida: institución informada por el servidor, migas de pan y accesos rápidos.
      assert.match(await page.locator('.institution-chip').textContent(), /Centro Médico Pediátrico/);
      await page.getByRole('navigation', { name: 'Ruta de navegación' }).getByText('Inicio').waitFor();
      await page.getByRole('link', { name: /Buscar paciente/ }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Auditoría' }).count(), 0, 'secretaría no ve Auditoría en la navegación');
      // El usuario no necesita conocer el motor de base de datos.
      assert.ok(!(await page.locator('body').innerText()).includes('MongoDB'), 'la interfaz no muestra el motor');
      await auditarAccesibilidad('Panel (secretaría)'); await auditarContraste('Panel (secretaría)');
    });

    await paso('2b. Portal: cuatro instituciones, acceso real solo a Pediatría y regreso sin tocar la sesión', async () => {
      const tokenInicial = await tokenSesion();
      const peticiones = [];
      const espia = r => { const u = new URL(r.url()); if (/^\/(api|auth)\//.test(u.pathname)) peticiones.push(`${r.method()} ${u.pathname}`); };
      page.on('request', espia);
      try {
        // Regreso desde el menú lateral: navegación interna, sin cerrar sesión.
        await page.locator('.sidebar').getByRole('link', { name: 'Volver a instituciones' }).click();
        await portal();
        assert.equal(new URL(page.url()).pathname, '/instituciones');
        assert.deepEqual(await tarjetasPortal(), PORTAL_PRODUCCION);
        const bienvenida = await page.locator('.portal-welcome').textContent();
        assert.match(bienvenida, /E2E-SEC/); assert.match(bienvenida, /Secretaría/);
        // Producción: las pendientes no ofrecen ningún enlace (ni «Ver diseño»).
        for (const nombre of ['Hospital General', 'Clínica Odontológica', 'Laboratorio Clínico']) {
          const tarjeta = page.locator('.portal-card').filter({ hasText: nombre });
          assert.equal(await tarjeta.locator('a, button').count(), 0, `${nombre}: sin acciones en producción`);
          await tarjeta.getByText('Se habilitará cuando su servidor esté conectado.').waitFor();
        }
        assert.ok(!(await page.locator('body').innerText()).includes('Ver diseño'));
        await auditarAccesibilidad('Portal (claro)'); await auditarContraste('Portal (claro)');
        assert.ok(await desbordeHorizontal() <= 1);
        await captura('02-portal-claro');
        // Teclado: «Saltar al contenido», menú de usuario e «Ingresar» con Enter.
        // El recorrido empieza al inicio del documento (como al cargar la página).
        await page.evaluate(() => { const b = document.body; b.setAttribute('tabindex', '-1'); b.focus(); b.removeAttribute('tabindex'); });
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Saltar al contenido');
        let pulsaciones = 0;
        while (!(await page.evaluate(() => document.activeElement.textContent.startsWith('Ingresar'))) && pulsaciones++ < 6) await page.keyboard.press('Tab');
        assert.ok(pulsaciones <= 6, '«Ingresar» se alcanza con el teclado');
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none', 'foco visible en «Ingresar»');
        await page.keyboard.press('Enter');
        await page.getByRole('heading', { name: 'Panel principal' }).waitFor();
        // Regreso desde el menú de usuario (útil en móvil) y nuevo ingreso.
        await page.getByRole('button', { name: /^Menú de usuario/ }).click();
        await page.locator('.user-panel').getByRole('link', { name: 'Volver a instituciones' }).click();
        await portal();
        await page.getByRole('link', { name: 'Ingresar a Centro Médico Pediátrico' }).click();
        await page.getByRole('heading', { name: 'Panel principal' }).waitFor();
        await page.waitForLoadState('networkidle');
      } finally { page.off('request', espia); }
      assert.equal(await tokenSesion(), tokenInicial, 'navegar por el portal no cambia el token');
      const inesperadas = peticiones.filter(p => !p.startsWith('GET ') || p.startsWith('GET /auth') || p === 'GET /api/sesion');
      assert.deepEqual(inesperadas, [], `peticiones inesperadas al navegar por el portal: ${inesperadas.join(', ')}`);
      // En producción no existen las vistas de los módulos pendientes ni la vista previa.
      await page.goto(`${base}/vista-previa/hospital_general`);
      await page.getByText('Página no encontrada').waitFor();
      assert.equal(await page.locator('.preview-banner').count(), 0);
      assert.equal(await page.locator('.sidebar-institution b').textContent(), 'Centro Médico Pediátrico');
      assert.equal(await tokenSesion(), tokenInicial);
      await page.goto(`${base}/`);
      await page.getByRole('heading', { name: 'Panel principal' }).waitFor();
    });

    await paso('3. Listado vacío y búsqueda sin resultados', async () => {
      await page.getByRole('link', { name: 'Pacientes', exact: true }).click();
      await page.getByText('No hay pacientes en esta vista').waitFor();
      await page.getByLabel('Buscar', { exact: true }).fill('inexistente');
      await page.getByText('Sin resultados').waitFor();
      await auditarAccesibilidad('Pacientes');
      await page.getByLabel('Buscar', { exact: true }).fill('');
    });

    await paso('4. Registrar paciente ficticio con dos tutores (con validación de formulario)', async () => {
      await page.getByRole('main').getByRole('link', { name: 'Registrar paciente' }).click();
      await auditarAccesibilidad('Registrar paciente');
      await page.getByRole('button', { name: 'Registrar paciente' }).click();
      assert.ok(await page.getByText('Obligatorio').count() >= 3, 'debe mostrar errores de validación');
      const datos = page.locator('section.card').nth(0);
      await datos.getByLabel('Nombres').fill('Lucía E2E');
      await datos.getByLabel('Apellidos').fill('Prueba Interfaz');
      await datos.getByLabel('Fecha de nacimiento').fill('2023-03-15');
      await datos.getByLabel('Sexo').selectOption('F');
      const t1 = page.locator('.sub-item').nth(0);
      await t1.getByLabel('Nombres').fill('Tutora');
      await t1.getByLabel('Apellidos').fill('Ficticia Uno');
      await t1.getByLabel('DPI').fill('2999888770101');
      await t1.getByLabel('Parentesco').fill('Madre');
      await t1.getByLabel('Teléfono').fill('5555-0001');
      await page.getByRole('button', { name: 'Agregar tutor' }).click();
      const t2 = page.locator('.sub-item').nth(1);
      await t2.getByLabel('Nombres').fill('Tutor');
      await t2.getByLabel('Apellidos').fill('Ficticio Dos');
      await t2.getByLabel('DPI').fill('2999888770202');
      await t2.getByLabel('Parentesco').fill('Padre');
      await page.getByRole('button', { name: 'Registrar paciente' }).click();
      await page.waitForURL(/\/pacientes\/P\d+$/);
      id = page.url().split('/').pop();
      await toast(`Paciente ${id} registrado`);
      await captura('04-expediente-nuevo');
    });

    await paso('5. Expediente recién creado (secretaría: solo datos administrativos)', async () => {
      await page.getByRole('heading', { name: 'Lucía E2E Prueba Interfaz' }).waitFor();
      assert.equal(await page.getByRole('tab').count(), 0, 'secretaría no ve pestañas clínicas');
      await page.getByRole('cell', { name: '2999888770101' }).waitFor();
      const migas = await page.getByRole('navigation', { name: 'Ruta de navegación' }).innerText();
      assert.match(migas.replace(/\s+/g, ' '), new RegExp(`Inicio Pacientes ${id}`));
      await auditarAccesibilidad('Expediente (secretaría)');
      // La restricción no es solo visual: el backend rechaza el acceso clínico directo.
      for (const r of [`/api/pacientes/${id}`, `/api/pacientes/${id}/consultas`, `/api/pacientes/${id}/crecimiento`, '/api/auditoria']) {
        assert.equal((await apiDesdeNavegador('GET', r)).status, 403, r);
      }
    });

    await paso('6. Actualizar datos administrativos y detectar duplicado', async () => {
      await page.getByRole('button', { name: 'Editar datos' }).click();
      await dialogo().getByLabel('Nombres').fill('Lucía Editada E2E');
      await dialogo().getByRole('button', { name: 'Guardar cambios' }).click();
      await toast('Datos actualizados');
      await page.getByRole('heading', { name: 'Lucía Editada E2E Prueba Interfaz' }).waitFor();
      const dup = await apiDesdeNavegador('POST', '/api/pacientes', {
        nombres: 'Lucía Editada E2E', apellidos: 'Prueba Interfaz', fecha_nacimiento: '2023-03-15', sexo: 'F',
        tutores: [{ dpi: 'X1', nombres: 'A', apellidos: 'B', parentesco: 'Madre', es_principal: true }]
      });
      assert.equal(dup.status, 409);
      await salir();
    });

    await paso('7. Médico registra consulta con diagnóstico, tratamiento, receta y control sin perímetro', async () => {
      await entrar('medico', 'E2E-MED');
      await page.goto(`${base}/pacientes/${id}`);
      assert.match(await page.locator('table').first().textContent(), /•+0101/, 'el médico ve el DPI enmascarado');
      await page.getByRole('link', { name: 'Nueva consulta' }).first().click();
      await page.getByLabel('Médico responsable').selectOption('M001');
      await page.getByLabel('Motivo de consulta').fill('Control de rutina ficticio E2E');
      await page.getByLabel('Observaciones').fill('Datos completamente ficticios');
      await page.getByRole('button', { name: 'Agregar diagnóstico' }).click();
      await page.getByLabel('Código').fill('DX-E2E');
      await page.getByLabel('Descripción', { exact: true }).fill('Diagnóstico ficticio');
      await page.getByLabel('Descripción del tratamiento').fill('Seguimiento ficticio inicial');
      await page.getByLabel('Emitir prescripción en esta consulta').check();
      for (const [l, v] of [['Medicamento', 'Medicamento ficticio A'], ['Dosis', 'No aplica'], ['Frecuencia', 'No aplica'], ['Duración', 'No aplica'], ['Vía de administración', 'No aplica']]) {
        await page.getByLabel(l, { exact: true }).fill(v);
      }
      await page.getByLabel('Registrar control de crecimiento en esta consulta').check();
      await page.getByLabel('Peso (kg)').fill('11.2');
      await page.getByLabel('Talla (cm)').fill('84');
      await page.getByRole('button', { name: 'Registrar consulta' }).click();
      await page.waitForURL(/\/consultas$/);
      await toast('registrada');
      await captura('07-consultas');
      await auditarAccesibilidad('Consultas'); await auditarContraste('Consultas');
    });

    await paso('8. Agregar diagnóstico, actualizar tratamiento (conserva versión) y prescripción', async () => {
      await page.getByRole('button', { name: '+ Diagnóstico' }).click();
      await dialogo().getByLabel('Código').fill('DX-E2E-2');
      await dialogo().getByLabel('Descripción').fill('Segundo diagnóstico ficticio');
      await dialogo().getByRole('button', { name: 'Agregar' }).click();
      await toast('Diagnóstico agregado');
      await page.getByRole('button', { name: 'Editar tratamiento' }).click();
      await dialogo().getByLabel('Descripción').fill('Seguimiento ficticio actualizado');
      await dialogo().getByRole('button', { name: 'Guardar' }).click();
      await toast('Tratamiento guardado');
      await page.getByText('Versiones anteriores del tratamiento (1)').waitFor();
      await page.getByRole('button', { name: '+ Prescripción' }).click();
      for (const [l, v] of [['Medicamento', 'Medicamento ficticio B'], ['Dosis', 'No aplica'], ['Frecuencia', 'No aplica'], ['Duración', 'No aplica'], ['Vía de administración', 'No aplica']]) {
        await dialogo().getByLabel(l, { exact: true }).fill(v);
      }
      await dialogo().getByRole('button', { name: 'Registrar prescripción' }).click();
      await toast('Prescripción');
      await page.getByText('DX-E2E-2').waitFor();
    });

    await paso('9-10. Controles de crecimiento: segunda medición, tabla y gráficas', async () => {
      await page.getByRole('tab', { name: 'Crecimiento' }).click();
      await page.getByText('Opcional: registrar si corresponde').waitFor();
      await page.getByLabel('Peso (kg)').fill('11.8');
      await page.getByLabel('Talla (cm)').fill('85.5');
      await page.getByLabel('Perímetro cefálico (cm)').fill('47.2');
      await page.getByRole('button', { name: 'Guardar medición' }).click();
      await toast('Control de crecimiento registrado');
      // Peso, talla y perímetro: tres gráficas; dos filas en el historial.
      await page.waitForFunction(() => document.querySelectorAll('figure.chart').length === 3 &&
        document.querySelectorAll('table tbody tr').length === 2);
      const ejes = await page.locator('figure.chart .axis-text').allTextContents();
      const filas = await page.locator('table tbody tr td:first-child').allTextContents();
      assert.ok(filas[0].startsWith(ejes.at(-1).replace(/.$/, '')), `fecha de gráfica (${ejes.at(-1)}) y tabla (${filas[0]}) coinciden`);
      await captura('10-crecimiento');
      await auditarAccesibilidad('Crecimiento'); await auditarContraste('Crecimiento');
    });

    await paso('11-13. Vacunación: programar, impedir duplicado, aplicar y bloquear doble aplicación', async () => {
      await page.getByRole('tab', { name: 'Vacunación' }).click();
      await page.getByText('Sin dosis en esta vista').waitFor();
      const programar = async () => {
        await page.getByLabel('Vacuna', { exact: true }).selectOption('V001');
        await page.getByLabel('Número de dosis').fill('1');
        await page.getByLabel('Fecha programada').fill('2026-01-20');
        await page.getByRole('button', { name: 'Programar' }).click();
      };
      await programar();
      await toast('Dosis programada');
      await page.getByRole('cell', { name: 'Pendiente' }).waitFor();
      await programar();
      await page.getByRole('alert').filter({ hasText: 'ya está programada' }).waitFor();
      await page.getByRole('button', { name: 'Aplicar' }).click();
      await dialogo().getByLabel('Lote').fill('LOTE-E2E-01');
      await dialogo().getByLabel('Médico responsable').selectOption('M002');
      await dialogo().getByRole('button', { name: 'Registrar' }).click();
      await dialogo().getByRole('button', { name: 'Registrar aplicación' }).click();
      await toast('Aplicación registrada');
      await page.getByRole('cell', { name: 'Aplicada' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Aplicar' }).count(), 0, 'una dosis aplicada ya no ofrece Aplicar');
      const esquema = (await apiDesdeNavegador('GET', `/api/pacientes/${id}/vacunacion`)).datos;
      const segunda = await apiDesdeNavegador('PATCH', `/api/pacientes/${id}/vacunacion/${esquema[0].id_esquema}/aplicar`,
        { fecha_aplicacion: new Date().toISOString(), lote: 'OTRO', id_medico: 'M001' });
      assert.equal(segunda.status, 409, 'el servidor rechaza la segunda aplicación');
      await captura('13-vacunacion');
      await auditarAccesibilidad('Vacunación del paciente'); await auditarContraste('Vacunación del paciente');
    });

    await paso('14. Historial de medicamentos', async () => {
      await page.getByRole('tab', { name: 'Prescripciones' }).click();
      await page.getByRole('cell', { name: 'Medicamento ficticio B' }).waitFor();
      assert.equal(await page.locator('table tbody tr').count(), 2);
      await page.getByLabel('Filtrar por medicamento').fill('ficticio A');
      await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 1);
      await salir();
    });

    await paso('15. Administrador archiva el expediente (otra causa administrativa)', async () => {
      await entrar('administrador', 'E2E-ADM');
      await page.locator('.stat').filter({ hasText: 'Consultas registradas' }).waitFor();
      await captura('14a-panel-administrador');
      await page.goto(`${base}/pacientes/${id}`);
      await page.getByRole('button', { name: 'Archivar historial' }).click();
      await dialogo().getByLabel('Motivo').selectOption('Otra causa administrativa');
      await dialogo().getByLabel('Detalle del motivo').fill('Cambio de domicilio ficticio');
      await dialogo().getByRole('button', { name: 'Archivar…' }).click();
      await dialogo().getByRole('button', { name: 'Archivar', exact: true }).click();
      await toast('Historial archivado');
      await page.getByText('Otra causa administrativa: Cambio de domicilio ficticio').waitFor();
      await captura('15-archivado');
    });

    await paso('17. Auditoría con el rol autorizado (expediente, global y archivados)', async () => {
      await page.getByRole('tab', { name: 'Auditoría' }).click();
      for (const a of ['ARCHIVAR_HISTORIAL', 'APLICAR_VACUNA', 'REGISTRAR_CONSULTA', 'ACTUALIZAR_TRATAMIENTO', 'CREAR_PACIENTE']) {
        await page.getByRole('cell', { name: a }).first().waitFor();
      }
      await page.getByRole('link', { name: 'Historiales archivados' }).click();
      await page.getByRole('link', { name: /Prueba Interfaz, Lucía Editada E2E/ }).waitFor();
      await page.getByRole('link', { name: 'Auditoría' }).click();
      await page.getByLabel('Acción').selectOption('ARCHIVAR_HISTORIAL');
      await page.getByRole('button', { name: 'Filtrar' }).click();
      await page.getByRole('cell', { name: id }).first().waitFor();
      await captura('17-auditoria');
      await auditarAccesibilidad('Auditoría'); await auditarContraste('Auditoría');
      await salir();
    });

    await paso('16. Expediente archivado: el médico no puede leerlo ni modificarlo', async () => {
      await entrar('medico', 'E2E-MED');
      await page.goto(`${base}/pacientes/${id}`);
      await page.getByText('Acceso restringido').waitFor();
      const r = await apiDesdeNavegador('POST', `/api/pacientes/${id}/consultas`, { id_medico: 'M001', fecha_hora: new Date().toISOString(), motivo: 'No debe guardarse' });
      assert.equal(r.status, 409);
      await page.goto(`${base}/auditoria`);
      await page.getByText('Sin permiso').waitFor();
      await salir();
    });

    await paso('18. Cambios persistidos en MongoDB', async () => {
      const p = await db.collection('pacientes').findOne({ id_paciente: id });
      assert.equal(p.nombres, 'Lucía Editada E2E');
      assert.equal(p.tutores.length, 2);
      assert.equal(p.estado_historial, 'Archivado');
      assert.equal(p.motivo_archivado, 'Otra causa administrativa: Cambio de domicilio ficticio');
      const [c] = p.consultas;
      assert.equal(p.consultas.length, 1);
      assert.deepEqual(c.diagnosticos.map(d => d.codigo), ['DX-E2E', 'DX-E2E-2']);
      assert.equal(c.tratamiento.descripcion, 'Seguimiento ficticio actualizado');
      assert.equal(c.tratamientos_anteriores[0].descripcion, 'Seguimiento ficticio inicial');
      assert.equal(c.prescripciones.length, 2);
      assert.equal(p.controles_crecimiento.length, 2);
      assert.equal(p.controles_crecimiento.filter(x => x.perimetro_cefalico_cm === undefined).length, 1);
      assert.equal(p.esquema_vacunacion[0].estado, 'Aplicada');
      assert.equal(p.esquema_vacunacion[0].lote, 'LOTE-E2E-01');
      assert.ok(p.fecha_nacimiento instanceof Date && c.fecha_hora instanceof Date && p.fecha_archivado instanceof Date);
      assert.equal((p.bitacora_pendiente || []).length, 0, 'sin eventos pendientes');
      const eventos = await db.collection('bitacora_acceso').countDocuments({ id_paciente: id, resultado: 'EXITOSO' });
      assert.ok(eventos >= 12, `eventos de auditoría: ${eventos}`);
      assert.ok(await db.collection('bitacora_acceso').countDocuments({ id_paciente: id, resultado: 'DENEGADO' }) >= 1);
    });

    await paso('Médicos y vacunación global', async () => {
      await entrar('medico', 'E2E-MED');
      await page.getByRole('link', { name: 'Médicos' }).click();
      await page.getByRole('cell', { name: 'COL-E2' }).waitFor();
      await page.getByLabel('Especialidad').selectOption('Neonatología');
      await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 1);
      await page.getByRole('link', { name: 'Vacunación' }).click();
      await page.getByRole('cell', { name: 'Vacuna ficticia B' }).waitFor();
      await page.getByText('No hay dosis pendientes').waitFor();
    });

    await paso('Temas: claro predeterminado, oscuro y según el sistema (persistentes)', async () => {
      // Sin preferencia guardada el tema es el claro.
      await page.evaluate(() => localStorage.removeItem('plataforma.tema'));
      await page.goto(`${base}/`);
      await page.getByRole('heading', { name: 'Panel principal' }).waitFor();
      assert.deepEqual(await temaActual(), { tema: 'claro', esquema: 'claro' });
      await page.getByRole('button', { name: /^Menú de usuario/ }).click();
      await page.getByLabel('Oscuro').check();
      assert.deepEqual(await temaActual(), { tema: 'oscuro', esquema: 'oscuro' });
      await page.keyboard.press('Escape');
      await page.goto(`${base}/medicos`);
      await page.getByRole('heading', { name: 'Médicos' }).waitFor();
      assert.deepEqual(await temaActual(), { tema: 'oscuro', esquema: 'oscuro' }, 'la preferencia se conserva al recargar');
      await page.waitForTimeout(400);
      await auditarAccesibilidad('Médicos (oscuro)');
      await auditarContraste('Médicos (oscuro)');
      await captura('tema-oscuro-medicos');
      // «Según el sistema» sigue los cambios del sistema operativo sin recargar.
      await page.getByRole('button', { name: /^Menú de usuario/ }).click();
      await page.getByLabel('Según el sistema').check();
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForFunction(() => document.documentElement.dataset.esquema === 'oscuro');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForFunction(() => document.documentElement.dataset.esquema === 'claro');
      await page.getByLabel('Claro').check();
      await page.keyboard.press('Escape');
      assert.deepEqual(await temaActual(), { tema: 'claro', esquema: 'claro' });
      await page.waitForTimeout(400); // fin de las transiciones de color
      await auditarContraste('Médicos (claro)');
      await captura('tema-claro-medicos');
    });

    await paso('Sin parpadeo: el tema se aplica antes de ejecutar la aplicación', async () => {
      // Con el JavaScript de la aplicación bloqueado, solo el script en línea de index.html
      // y la hoja de estilos deciden el tema: debe ser el guardado (oscuro), no el predeterminado.
      await page.evaluate(() => localStorage.setItem('plataforma.tema', 'oscuro'));
      simulandoCaida = true; // el bloqueo provoca errores de carga esperados en la consola
      await page.route(/\/assets\/.*\.js$/, r => r.abort('connectionrefused'));
      await page.goto(`${base}/medicos`, { waitUntil: 'load' });
      assert.deepEqual(await temaActual(), { tema: 'oscuro', esquema: 'oscuro' });
      const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.equal(fondo, 'rgb(16, 25, 28)', `fondo oscuro antes de React (${fondo})`);
      await page.unroute(/\/assets\/.*\.js$/);
      simulandoCaida = false;
      await page.evaluate(() => localStorage.removeItem('plataforma.tema'));
      await page.goto(`${base}/medicos`);
      await page.getByRole('heading', { name: 'Médicos' }).waitFor();
    });

    await paso('Teclado y menú lateral contraído (escritorio 1366 px)', async () => {
      await page.goto(`${base}/`);
      await page.getByRole('heading', { name: 'Panel principal' }).waitFor();
      await page.keyboard.press('Tab');
      const foco = await page.evaluate(() => ({ texto: document.activeElement.textContent, outline: getComputedStyle(document.activeElement).outlineStyle }));
      assert.equal(foco.texto, 'Saltar al contenido');
      assert.notEqual(foco.outline, 'none', 'el foco es visible');
      // Menú de usuario: se abre con Enter, recibe el foco con Tab, se cierra con Escape y devuelve el foco.
      const disparador = page.getByRole('button', { name: /^Menú de usuario/ });
      await disparador.focus();
      await page.keyboard.press('Enter');
      await page.locator('.user-panel').waitFor();
      assert.equal(await disparador.getAttribute('aria-expanded'), 'true');
      const caja = await page.locator('.user-panel').boundingBox();
      assert.ok(caja.x >= 0 && caja.x + caja.width <= 1366 && caja.y + caja.height <= 900, 'el menú de usuario cabe en la ventana');
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest('.user-panel'))), 'el foco entra al menú');
      await page.keyboard.press('Escape');
      await page.locator('.user-panel').waitFor({ state: 'detached' });
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('user-trigger')), 'el foco vuelve al botón');
      // Un clic fuera también lo cierra.
      await disparador.click();
      await page.locator('.user-panel').waitFor();
      await page.mouse.click(700, 500);
      await page.locator('.user-panel').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Contraer menú lateral' }).click();
      await page.locator('.app.sidebar-collapsed').waitFor();
      // Las entradas siguen teniendo nombre accesible aunque solo se vean los iconos.
      await page.getByRole('link', { name: 'Médicos' }).waitFor();
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 80);
      await captura('menu-contraido');
      await page.reload();
      await page.locator('.app.sidebar-collapsed').waitFor(); // preferencia recordada
      await page.getByRole('button', { name: 'Expandir menú lateral' }).click();
      await page.waitForFunction(() => !document.querySelector('.app.sidebar-collapsed'));
      await salir();
    });

    await paso('Capturas comparativas claro/oscuro del expediente (administrador)', async () => {
      await entrar('administrador', 'E2E-CAPT');
      for (const esquema of ['claro', 'oscuro']) {
        await page.evaluate(t => localStorage.setItem('plataforma.tema', t), esquema);
        for (const [ruta, nombre] of [['/', 'panel'], [`/pacientes/${id}`, 'expediente'], [`/pacientes/${id}/consultas`, 'consultas'],
          [`/pacientes/${id}/prescripciones`, 'prescripciones'], [`/pacientes/${id}/crecimiento`, 'crecimiento'], [`/pacientes/${id}/vacunacion`, 'vacunacion'],
          ['/pacientes?estado=Todos', 'pacientes'], ['/pacientes/nuevo', 'registro'], ['/archivados', 'archivados'], ['/medicos', 'medicos'],
          ['/vacunacion', 'vacunacion-global'], ['/auditoria', 'auditoria']]) {
          await page.goto(base + ruta);
          await page.waitForLoadState('networkidle');
          assert.equal((await temaActual()).esquema, esquema);
          await auditarContraste(`${nombre} (${esquema})`);
          await captura(`comparativa-${esquema}-${nombre}`);
          if (nombre === 'panel') {
            assert.equal(await cuentaIndicadores(), 6, 'seis indicadores para el administrador');
            assert.equal(await filasIndicadores(), 2, 'a 1366 px los seis indicadores quedan en 3 × 2');
          }
        }
        // Modal y menú de usuario en este tema.
        await page.goto(`${base}/pacientes/nuevo`);
        await page.getByRole('heading', { name: 'Registrar paciente' }).waitFor();
        await page.getByRole('button', { name: 'Registrar paciente' }).click(); // errores de validación visibles
        await auditarContraste(`registro con errores (${esquema})`);
        await captura(`comparativa-${esquema}-registro-errores`);
        await page.getByRole('button', { name: /^Menú de usuario/ }).click();
        await page.locator('.user-panel').waitFor();
        await page.waitForTimeout(250);
        await auditarContraste(`menú de usuario (${esquema})`);
        await captura(`comparativa-${esquema}-menu-usuario`);
        await page.keyboard.press('Escape');
        await page.goto(`${base}/medicos`);
        await page.getByRole('heading', { name: 'Médicos' }).waitFor();
      }
      await page.evaluate(() => localStorage.removeItem('plataforma.tema'));
    });

    await paso('Portal en claro y oscuro: escritorio, tablet y móvil sin desbordes', async () => {
      for (const esquema of ['claro', 'oscuro']) {
        await page.evaluate(t => localStorage.setItem('plataforma.tema', t), esquema);
        for (const [ancho, alto] of [[1920, 1080], [1366, 900], [820, 1180], [390, 844]]) {
          await page.setViewportSize({ width: ancho, height: alto });
          await page.goto(`${base}/instituciones`);
          await portal();
          assert.equal((await temaActual()).esquema, esquema);
          assert.deepEqual(await tarjetasPortal(), PORTAL_PRODUCCION);
          const d = await desbordeHorizontal();
          assert.ok(d <= 1, `portal ${esquema} ${ancho}px: desborde horizontal de ${d}px`);
          // Cuatro columnas en escritorio, dos en tablet y una en móvil.
          const columnas = await page.locator('.portal-card').evaluateAll(ts => new Set(ts.map(t => Math.round(t.getBoundingClientRect().left))).size);
          assert.equal(columnas, ancho >= 1101 ? 4 : ancho > 560 ? 2 : 1, `portal ${ancho}px: columnas`);
          if (ancho === 1366 || ancho === 390) await captura(`${ancho === 390 ? 'movil-' : ''}portal-${esquema}`);
          if (ancho === 820) await captura(`ancho-820-portal-${esquema}`);
        }
        await page.setViewportSize({ width: 1366, height: 900 });
        await auditarContraste(`Portal (${esquema})`);
        // El tema elegido se conserva al entrar a la institución.
        await page.getByRole('link', { name: 'Ingresar a Centro Médico Pediátrico' }).click();
        await page.getByRole('heading', { name: 'Panel principal' }).waitFor();
        assert.equal((await temaActual()).esquema, esquema);
      }
      await page.evaluate(() => localStorage.removeItem('plataforma.tema'));
    });

    await paso('Escritorio grande (1920 px) y tablet (820 px): sin desbordes', async () => {
      for (const [ancho, alto] of [[1920, 1080], [820, 1180]]) {
        await page.setViewportSize({ width: ancho, height: alto });
        for (const ruta of ['/', '/pacientes?estado=Todos', `/pacientes/${id}`, `/pacientes/${id}/consultas`, `/pacientes/${id}/prescripciones`, '/auditoria']) {
          await page.goto(base + ruta);
          await page.waitForLoadState('networkidle');
          const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          assert.ok(desborde <= 1, `${ancho}px ${ruta}: desborde horizontal de ${desborde}px`);
          if (ruta === '/') {
            assert.equal(await filasIndicadores(), ancho >= 1680 ? 1 : 2, `${ancho}px: filas de indicadores`);
            await captura(`ancho-${ancho}-panel`);
          }
        }
        await captura(`ancho-${ancho}-auditoria`);
      }
      await page.setViewportSize({ width: 1366, height: 900 });
      await salir();
    });

    await paso('Diseño móvil (390 px): sin desplazamiento horizontal y menú funcional', async () => {
      const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-GT', colorScheme: process.env.E2E_ESQUEMA === 'dark' ? 'dark' : 'light' });
      const anterior = page;
      page = await movil.newPage();
      try {
        await entrar('administrador', 'E2E-MOVIL');
        for (const ruta of ['/', '/pacientes?estado=Todos', `/pacientes/${id}/consultas`, `/pacientes/${id}/crecimiento`, `/pacientes/${id}/vacunacion`, '/auditoria']) {
          await page.goto(base + ruta);
          await page.waitForLoadState('networkidle');
          const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          assert.ok(desborde <= 1, `${ruta}: desborde horizontal de ${desborde}px`);
          if (ruta.endsWith('/crecimiento')) await captura('movil-crecimiento');
        }
        await captura('movil-auditoria');
        await page.getByRole('button', { name: 'Abrir menú' }).click();
        await page.locator('.app.menu-open').waitFor();
        await page.waitForTimeout(350); // fin de la animación de apertura
        await page.screenshot({ path: path.join(CAPTURAS, 'movil-menu.png') });
        await page.getByRole('link', { name: 'Médicos' }).click();
        await page.getByRole('heading', { name: 'Médicos' }).waitFor();
        await captura('movil-medicos');
        await page.getByRole('button', { name: /^Menú de usuario/ }).click();
        const caja = await page.locator('.user-panel').boundingBox();
        assert.ok(caja.x >= 0 && caja.x + caja.width <= 390, `menú de usuario dentro de la ventana móvil (${caja.x}, ${caja.width})`);
        await page.keyboard.press('Escape');
        // Mismo recorrido en tema oscuro.
        await page.evaluate(() => localStorage.setItem('plataforma.tema', 'oscuro'));
        for (const [ruta, nombre] of [['/', 'panel'], [`/pacientes/${id}`, 'expediente'], [`/pacientes/${id}/consultas`, 'consultas'], [`/pacientes/${id}/vacunacion`, 'vacunacion']]) {
          await page.goto(base + ruta);
          await page.waitForLoadState('networkidle');
          assert.equal((await temaActual()).esquema, 'oscuro');
          const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          assert.ok(desborde <= 1, `oscuro ${ruta}: desborde horizontal de ${desborde}px`);
          if (ruta === '/') assert.equal(await filasIndicadores(), 3, 'en móvil los seis indicadores quedan en 2 columnas');
          await auditarContraste(`móvil ${nombre} (oscuro)`);
          await captura(`movil-oscuro-${nombre}`);
        }
        await page.getByRole('button', { name: 'Abrir menú' }).click();
        await page.locator('.app.menu-open').waitFor();
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(CAPTURAS, 'movil-oscuro-menu.png') });
      } finally { await movil.close(); page = anterior; }
    });

    await paso('Enlace profundo, sesión vencida o inválida y cierre de sesión con el portal', async () => {
      // Enlace profundo sin sesión: tras iniciar sesión se abre la página pedida, no el portal.
      await page.goto(`${base}/pacientes/${id}/consultas`);
      await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
      await page.getByLabel('Administrador', { exact: true }).check();
      await page.getByLabel('Identificador de usuario').fill('E2E-ENLACE');
      await page.getByRole('button', { name: 'Entrar (modo desarrollo)' }).click();
      await page.getByRole('tabpanel', { name: 'Consultas' }).waitFor();
      assert.equal(new URL(page.url()).pathname, `/pacientes/${id}/consultas`);
      // Cerrar sesión desde el portal: se vuelve al inicio de sesión y el portal deja de ser accesible.
      await page.locator('.sidebar').getByRole('link', { name: 'Volver a instituciones' }).click();
      await portal();
      await salir();
      assert.equal(await tokenSesion(), null);
      await page.goto(`${base}/instituciones`);
      await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
      // Token vencido (firmado con el secreto de esta prueba): el backend lo rechaza.
      const vencido = firmarTokenDesarrollo({ usuario: 'E2E-VENCIDO', rol: 'medico' }, -60);
      await page.goto(`${base}/instituciones#access_token=${vencido}`);
      await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
      await page.locator('.login-card .alert').first().waitFor();
      assert.equal(await page.locator('.portal-card').count(), 0);
      assert.equal(await tokenSesion(), null, 'el token vencido no se conserva');
      // Token alterado: tampoco llega al portal.
      await page.goto(`${base}/instituciones#access_token=${vencido.slice(0, -4)}AAAA`);
      await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
      await page.locator('.login-card .alert').first().waitFor();
      assert.equal(await tokenSesion(), null);
      // Vencimiento mientras se está en el portal: vuelve solo al inicio de sesión.
      const corto = firmarTokenDesarrollo({ usuario: 'E2E-CORTO', rol: 'medico' }, 4);
      await page.goto(`${base}/instituciones#access_token=${corto}`);
      await portal();
      await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor({ timeout: 10000 });
      await page.getByText('Su sesión expiró. Inicie sesión de nuevo.').waitFor();
      assert.equal(await tokenSesion(), null);
    });

    await paso('Inicio de sesión en tema oscuro', async () => {
      await page.evaluate(() => localStorage.setItem('plataforma.tema', 'oscuro'));
      await page.goto(`${base}/login`);
      await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
      await page.getByRole('button', { name: 'Entrar (modo desarrollo)' }).waitFor();
      await auditarAccesibilidad('Inicio de sesión (oscuro)');
      await auditarContraste('Inicio de sesión (oscuro)');
      await captura('comparativa-oscuro-login');
      await page.evaluate(() => localStorage.removeItem('plataforma.tema'));
    });

    await paso('Error de conexión: la interfaz informa que la API no responde', async () => {
      // Simula la caída de la API: el navegador no obtiene respuesta de /api ni /auth.
      simulandoCaida = true;
      await page.route(/\/(api|auth)\//, r => r.abort('connectionrefused'));
      await page.reload();
      await page.getByText('No se pudo conectar con el servidor').first().waitFor();
      await captura('error-conexion');
      await page.unroute(/\/(api|auth)\//);
    });
  } finally {
    await browser.close();
    if (server.listening) await new Promise(r => server.close(r));
    await client.close();
    await mongo.detener();
  }

  // Comprobación de conexión con el servidor detenido, sobre el HTML ya cargado.
  const ok = resultados.every(r => r.ok);
  console.log(`\n${resultados.filter(r => r.ok).length}/${resultados.length} pasos correctos`);
  if (erroresConsola.length) console.log(`Errores de consola del navegador:\n  ${erroresConsola.join('\n  ')}`);
  if (problemasA11y.length) console.log(`Problemas de accesibilidad:\n  ${problemasA11y.join('\n  ')}`);
  else console.log('Accesibilidad básica: sin problemas en las pantallas auditadas');
  if (problemasContraste.length) console.log(`Problemas de contraste (WCAG AA):\n  ${problemasContraste.join('\n  ')}`);
  else console.log('Contraste WCAG AA: sin problemas en las pantallas auditadas (claro y oscuro)');
  if (!ok || erroresConsola.length || problemasA11y.length || problemasContraste.length) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
