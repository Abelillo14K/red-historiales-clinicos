'use strict';
// Adaptador primario HTTP: compone middleware, autenticación y rutas sobre
// servicios de aplicación ya construidos (independiente del motor de datos).
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const S = require('./schema');
const { requireAuth, crearRoles, firmarTokenDesarrollo, INSTITUCION } = require('./security');
const M = require('./api/middleware');
const { rutasPacientes } = require('./api/routes/pacientes');
const { rutasGenerales } = require('./api/routes/generales');
const { crearEnrutadorInstituciones } = require('./api/enrutadorInstituciones');

function devLoginHabilitado() {
  return ['development', 'test'].includes(process.env.NODE_ENV) && process.env.ENABLE_DEV_LOGIN !== 'false';
}

// El token de desarrollo (incluso de administrador) solo se entrega al propio equipo.
// Con 'trust proxy' = loopback, req.ip es la IP real del cliente aunque llegue por un
// proxy local, y X-Forwarded-For enviado desde otro equipo se ignora.
const IP_LOCAL = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;
const esPeticionLocal = req => IP_LOCAL.test(req.ip || '');

// Router montable en la aplicación compartida de las cuatro instituciones.
function crearRouterPediatria(servicios) {
  const roles = crearRoles(req => {
    const id = /\/pacientes\/([A-Za-z0-9_-]{1,40})/.exec(req.baseUrl + req.path)?.[1];
    servicios.comun.auditar(req.actor, 'ACCESO_DENEGADO', {
      id_paciente: id || null, resultado: 'DENEGADO', detalle: `${req.method} ${req.baseUrl}${req.path}`.slice(0, 200)
    }).catch(() => {});
  });
  const r = express.Router();
  r.use(requireAuth);
  r.use('/pacientes', rutasPacientes(servicios, roles));
  r.use('/', rutasGenerales(servicios, roles));
  r.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada', codigo: 'RUTA_NO_ENCONTRADA' }));
  return r;
}

function crearApp(servicios, { frontendDist = path.join(__dirname, '..', '..', '..', 'apps', 'web', 'dist') } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.set('trust proxy', 'loopback');
  app.use(M.cabecerasSeguridad);
  if (process.env.CORS_ORIGIN) app.use(M.cors(process.env.CORS_ORIGIN.split(',').map(s => s.trim())));
  app.use(express.json({ limit: '100kb', strict: true }));

  app.get('/salud', (_req, res) => res.json({ servicio: 'centro-pediatrico', ok: true }));

  app.get('/auth/config', (req, res) => res.json({ institucion: INSTITUCION, dev_login: devLoginHabilitado() && esPeticionLocal(req) }));
  app.post('/auth/dev-login', M.limitador({ ventanaMs: 60_000, maximo: 20 }), M.asyncRoute(async (req, res) => {
    if (!devLoginHabilitado()) return res.status(404).json({ error: 'Inicio de sesión de desarrollo deshabilitado', codigo: 'RUTA_NO_ENCONTRADA' });
    if (!esPeticionLocal(req)) {
      return res.status(403).json({ error: 'El inicio de sesión de desarrollo solo está disponible desde el propio equipo', codigo: 'DEV_LOGIN_SOLO_LOCAL' });
    }
    const datos = S.devLogin.parse(req.body);
    const token = firmarTokenDesarrollo(datos, '8h');
    await servicios.comun.auditar({ id: datos.usuario, rol: datos.rol }, 'INICIO_SESION_DESARROLLO', { recurso: 'auth' });
    res.json({ token, usuario: datos.usuario, rol: datos.rol, advertencia: 'Token de desarrollo; no usar en producción' });
  }));

  // La institución del token decide el módulo y, con él, el motor de base de datos.
  app.use('/api', M.limitador({ ventanaMs: 60_000, maximo: 600 }), crearEnrutadorInstituciones({
    [INSTITUCION]: { nombre: 'Centro Médico Pediátrico', motor: 'MongoDB', router: crearRouterPediatria(servicios) }
  }));

  // Sirve el frontend compilado (npm run build) desde el mismo origen.
  if (frontendDist && fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|auth\/|salud$).*/, (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
  }

  app.use(M.manejadorErrores);
  return app;
}

module.exports = { crearApp, crearRouterPediatria, crearEnrutadorInstituciones, devLoginHabilitado, esPeticionLocal };
