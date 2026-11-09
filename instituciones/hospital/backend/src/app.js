// Servidor INDEPENDIENTE del Hospital (modo desarrollo). Cuando el router se registre en el
// servidor común, este archivo deja de ser necesario.
import express from 'express';
import { config } from './config.js';
import { manejador, noEncontrada } from './errores.js';
import { authRouter } from './rutas/auth.js';
import { crearRouterHospital } from './router.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => { if (req.path.startsWith('/api') || req.path.startsWith('/auth')) res.set('Cache-Control', 'no-store'); next(); });

  app.get('/salud', (_req, res) => res.json({ servicio: 'hospital-general', ok: true }));
  app.get('/auth/config', (_req, res) => res.json({ institucion: config.institucion, dev_login: false }));
  app.use(authRouter);
  app.use('/api', crearRouterHospital());

  app.use(noEncontrada);
  app.use(manejador);
  return app;
}
