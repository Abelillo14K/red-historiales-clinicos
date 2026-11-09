'use strict';
// Conexión a Cloud Firestore de la clínica. La llave de la cuenta de servicio vive FUERA del repositorio
// y solo su ruta va en .env. Con FIRESTORE_EMULATOR_HOST se usa el emulador local (sin llave).
const fs = require('node:fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const NOMBRE_APP = 'clinica-odontologica';

function crearFirestore({
  credenciales = process.env.ODONTOLOGIA_FIREBASE_CREDENCIALES,
  proyecto = process.env.ODONTOLOGIA_FIREBASE_PROJECT_ID
} = {}) {
  const existente = getApps().find(a => a.name === NOMBRE_APP);
  if (existente) return getFirestore(existente);
  const opciones = {};
  if (credenciales) {
    if (!fs.existsSync(credenciales)) throw new Error(`No existe el archivo de credenciales: ${credenciales}`);
    const llave = JSON.parse(fs.readFileSync(credenciales, 'utf8'));
    opciones.credential = cert(llave);
    opciones.projectId = proyecto || llave.project_id;
  } else if (process.env.FIRESTORE_EMULATOR_HOST) {
    opciones.projectId = proyecto || 'demo-odontologia';
  } else {
    throw new Error('Configure ODONTOLOGIA_FIREBASE_CREDENCIALES (o FIRESTORE_EMULATOR_HOST para el emulador)');
  }
  const db = getFirestore(initializeApp(opciones, NOMBRE_APP));
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// ID del proyecto conectado (para informar al arrancar).
const proyectoConectado = () => getApps().find(a => a.name === NOMBRE_APP)?.options.projectId ?? null;

module.exports = { crearFirestore, proyectoConectado };
