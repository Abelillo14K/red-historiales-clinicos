'use strict';
// Arranca el router real del laboratorio detrás del enrutador por institución del servidor común,
// sobre el doble en memoria (o los repositorios que se indiquen). Datos completamente ficticios.
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-automatizadas-0123456789';
process.env.JWT_ISSUER = 'centro-pediatrico-dev';
process.env.JWT_AUDIENCE = 'centro-pediatrico-api';
process.env.NODE_ENV = 'test';

const express = require('express');
const { crearEnrutadorInstituciones } = require('../../pediatria/backend/api/enrutadorInstituciones');
const { crearRouterLaboratorio } = require('../backend/app');
const { crearServicios } = require('../backend/application');
const { firmarTokenSesion } = require('../backend/security');
const { crearRepositoriosMemoria } = require('./doubles/memoria');

const ADMIN = { id: 'ADM-1', rol: 'administrador' };
const token = (rol, usuario = `${rol.toUpperCase()}-1`) => firmarTokenSesion({ usuario, rol });

// Catálogo mínimo: un examen con un parámetro numérico y uno de texto, un médico y un bioquímico.
async function sembrarCatalogo(servicios) {
  const c = servicios.catalogos;
  const { id_tipo_muestra } = await c.crearTipoMuestra(ADMIN, { nombre: 'Muestra ficticia' });
  const { id_parametro: numerico } = await c.crearParametro(ADMIN, { nombre: 'Parámetro numérico', unidad_medida: 'u', tipo_dato: 'Numerico' });
  const { id_parametro: texto } = await c.crearParametro(ADMIN, { nombre: 'Parámetro de texto', tipo_dato: 'Texto' });
  const { id_tipo_examen } = await c.crearTipoExamen(ADMIN, {
    nombre: 'Examen ficticio', categoria: 'Pruebas', id_tipo_muestra, tiempo_entrega_horas: 24, precio: 10,
    parametros: [
      { id_parametro: numerico, valor_ref_min: 10, valor_ref_max: 20, orden_presentacion: 1 },
      { id_parametro: texto, valor_ref_texto: 'Normal', orden_presentacion: 2 }
    ]
  });
  const { id_medico } = await c.crearMedico(ADMIN, { nombre_completo: 'Médica Ficticia', numero_colegiado: 'COL-T1' });
  await c.crearPersonal(ADMIN, { nombres: 'Bioquímica', apellidos: 'Ficticia', cargo: 'Bioquimico', usuario: 'BIOQUIMICO-1' });
  return { id_tipo_muestra, numerico, texto, id_tipo_examen, id_medico };
}

async function iniciar(repos = crearRepositoriosMemoria(), { sembrar = true } = {}) {
  const servicios = crearServicios(repos);
  const catalogo = sembrar ? await sembrarCatalogo(servicios) : null;
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', crearEnrutadorInstituciones({
    laboratorio_clinico: { nombre: 'Laboratorio Clínico', motor: 'PostgreSQL', router: crearRouterLaboratorio(servicios) }
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

module.exports = { iniciar, sembrarCatalogo, token, ADMIN };
