'use strict';
// Arranca el router real de la clínica detrás del enrutador por institución del servidor común,
// sobre el doble en memoria (o los repositorios que se indiquen). Datos completamente ficticios.
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-automatizadas-0123456789';
process.env.JWT_ISSUER = 'centro-pediatrico-dev';
process.env.JWT_AUDIENCE = 'centro-pediatrico-api';
process.env.NODE_ENV = 'test';

const express = require('express');
const { crearEnrutadorInstituciones } = require('../../pediatria/backend/api/enrutadorInstituciones');
const { crearRouterOdontologia } = require('../backend/app');
const { crearServicios } = require('../backend/application');
const { firmarTokenDesarrollo } = require('../backend/security');
const { crearRepositoriosMemoria } = require('./doubles/memoria');

const ADMIN = { id: 'ADM-1', rol: 'administrador' };
const token = (rol, usuario = `${rol.toUpperCase()}-1`) => firmarTokenDesarrollo({ usuario, rol });
// Fecha futura redondeada a la hora (para citas).
const enDias = (dias, hora = 15) => { const d = new Date(Date.now() + dias * 864e5); d.setUTCHours(hora, 0, 0, 0); return d; };

// Catálogo mínimo: dos odontólogos y un procedimiento.
async function sembrarCatalogo(servicios) {
  const c = servicios.catalogos;
  await c.crearOdontologo(ADMIN, { colegiado: 'COL-1', nombres: 'Odontóloga', apellidos: 'Ficticia', especialidad: 'General' });
  await c.crearOdontologo(ADMIN, { colegiado: 'COL-2', nombres: 'Odontólogo', apellidos: 'Prueba', especialidad: 'Endodoncia' });
  await c.crearProcedimiento(ADMIN, { codigo: 'D-100', nombre: 'Obturación con resina', precio: 250 });
  return { odontologo: 'COL-1', otroOdontologo: 'COL-2', procedimiento: 'D-100' };
}

async function iniciar(repos = crearRepositoriosMemoria(), { sembrar = true } = {}) {
  const servicios = crearServicios(repos);
  const catalogo = sembrar ? await sembrarCatalogo(servicios) : null;
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', crearEnrutadorInstituciones({
    clinica_odontologica: { nombre: 'Clínica Odontológica', motor: 'Cloud Firestore', router: crearRouterOdontologia(servicios) }
  }));
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(metodo, ruta, { rol, usuario, body, bearer } = {}) {
    const auth = bearer ?? (rol ? token(rol, usuario) : null);
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  }

  return { base, api, repos, servicios, catalogo, cerrar: () => new Promise(r => server.close(r)) };
}

module.exports = { iniciar, sembrarCatalogo, token, enDias, ADMIN };
