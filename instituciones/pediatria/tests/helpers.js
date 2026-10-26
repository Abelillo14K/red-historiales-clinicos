'use strict';
// Arranca la API real (Express + casos de uso) sobre el doble de prueba en memoria.
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-automatizadas-0123456789';
process.env.JWT_ISSUER = 'centro-pediatrico-dev';
process.env.JWT_AUDIENCE = 'centro-pediatrico-api';
process.env.NODE_ENV = 'test';
delete process.env.CORS_ORIGIN;

const jwt = require('jsonwebtoken');
const { crearApp } = require('../backend/app');
const { crearServicios } = require('../backend/application');
const { crearRepositoriosMemoria } = require('./doubles/memoria');

// Datos completamente ficticios.
const fixtures = () => ({
  medicos: [
    { id_medico: 'M001', colegiado: 'COL-T1', nombres: 'Médica', apellidos: 'Prueba', especialidad: { id_especialidad: 'E001', nombre: 'Pediatría General' } },
    { id_medico: 'M002', colegiado: 'COL-T2', nombres: 'Médico', apellidos: 'Prueba', especialidad: { id_especialidad: 'E002', nombre: 'Neonatología' } }
  ],
  vacunas: [
    { id_vacuna: 'V001', nombre: 'Vacuna ficticia A', descripcion: 'Solo pruebas' },
    { id_vacuna: 'V002', nombre: 'Vacuna ficticia B', descripcion: 'Solo pruebas' }
  ],
  pacientes: [
    {
      id_paciente: 'P001', nombres: 'Niña', apellidos: 'Ficticia', fecha_nacimiento: new Date('2021-01-15T00:00:00Z'), sexo: 'F',
      estado_historial: 'Activo',
      tutores: [{ id_tutor: 'T001', dpi: 'DPI-T-1', nombres: 'Tutora', apellidos: 'Ficticia', parentesco: 'Madre', es_principal: true }],
      consultas: [{ id_consulta: 'C001', id_medico: 'M001', fecha_hora: new Date('2026-01-10T15:00:00Z'), motivo: 'Control ficticio', diagnosticos: [], prescripciones: [] }],
      controles_crecimiento: [], esquema_vacunacion: []
    },
    {
      id_paciente: 'P003', nombres: 'Niño', apellidos: 'Archivado', fecha_nacimiento: new Date('2022-03-01T00:00:00Z'), sexo: 'M',
      estado_historial: 'Archivado', fecha_archivado: new Date('2026-02-01T00:00:00Z'), motivo_archivado: 'Traslado',
      tutores: [{ id_tutor: 'T003', dpi: 'DPI-T-3', nombres: 'Tutor', apellidos: 'Archivado', parentesco: 'Padre', es_principal: true }],
      consultas: [], controles_crecimiento: [], esquema_vacunacion: []
    }
  ]
});

function token(rol, { sub = `USR-${rol}`, institucion = 'centro_pediatrico', expiresIn = '10m', secret = process.env.JWT_SECRET } = {}) {
  return jwt.sign({ rol, institucion }, secret, {
    algorithm: 'HS256', subject: sub, expiresIn, issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE
  });
}

async function iniciar(opciones = {}) {
  const repos = crearRepositoriosMemoria({ ...fixtures(), ...opciones });
  const app = crearApp(crearServicios(repos), { frontendDist: null });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(metodo, ruta, { rol, body, headers = {}, raw } = {}) {
    const h = { ...headers };
    if (rol) h.Authorization = `Bearer ${token(rol)}`;
    if (body !== undefined || raw !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(base + ruta, { method: metodo, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const texto = await res.text();
    let datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
    return { status: res.status, datos };
  }
  return { repos, base, api, cerrar: () => new Promise(r => server.close(r)) };
}

module.exports = { iniciar, token, fixtures };
