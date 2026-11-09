// crearRouterHospital(): router del Hospital con rutas RELATIVAS a /api (GUIA_EQUIPO §6).
// Se monta en el servidor común (una línea) o, en modo independiente, en app.js.
import { Router } from 'express';
import { autenticar } from './seguridad.js';
import { panelRouter } from './rutas/panel.js';
import { pacientesRouter } from './rutas/pacientes.js';
import { clinicoRouter } from './rutas/clinico.js';
import { citasRouter } from './rutas/citas.js';
import { hospitalizacionRouter } from './rutas/hospitalizacion.js';
import { catalogosRouter } from './rutas/catalogos.js';
import { auditoriaRouter } from './rutas/auditoria.js';

export function crearRouterHospital() {
  const r = Router();
  r.use(autenticar); // exige SU institución (hospital_general)

  // Contrato de sesión (GUIA_EQUIPO §3.2)
  r.get('/sesion', (req, res) => res.json({
    usuario: req.usuario.usuario,
    rol: req.usuario.rol,
    institucion: 'hospital_general',
    institucion_nombre: 'Hospital General',
    motor: 'MySQL',
    permisos: [...req.permisos],
    expira: new Date(req.usuario.exp * 1000).toISOString(),
    capacidades: {}
  }));

  r.use(panelRouter, pacientesRouter, clinicoRouter, citasRouter, hospitalizacionRouter, catalogosRouter, auditoriaRouter);
  return r;
}
