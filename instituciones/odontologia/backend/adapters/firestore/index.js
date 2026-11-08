'use strict';
// Adaptador Cloud Firestore: repositorios, unidad de trabajo con runTransaction y traducción de errores.
const E = require('../../domain/errors');
const { crearRepositorios } = require('./repositorios');

// Mensajes legibles para documentos que ya existen (el id del documento es la clave única).
const DUPLICADOS = {
  odontologos: 'Ya existe un odontólogo con ese número de colegiado',
  procedimientos: 'Ya existe un procedimiento con ese código',
  documentos_paciente: 'Ya existe un paciente con ese documento de identidad'
};

// Códigos gRPC de Firestore: 3 argumento inválido, 4 tiempo agotado, 5 no encontrado, 6 ya existe,
// 7 sin permiso, 10 abortada, 14 no disponible, 16 sin autenticar.
function traducirError(e) {
  if (e instanceof E.DomainError) return e;
  if (e.code === 6) {
    const coleccion = Object.keys(DUPLICADOS).find(c => String(e.message).includes(`/${c}/`));
    return E.conflict(DUPLICADOS[coleccion] || 'Registro duplicado');
  }
  if (e.code === 5) return E.notFound('El registro ya no existe');
  if (e.code === 10) return E.conflict('Otra operación cambió los mismos datos; vuelva a intentarlo');
  if (e.code === 3) return new E.DomainError('Dato con formato inválido', 400, 'VALIDACION');
  if ([4, 7, 14, 16].includes(e.code)) {
    console.error(`[odontologia] Firestore no disponible: ${e.message}`);
    return new E.DomainError('La base de datos de la clínica no está disponible', 503, 'MOTOR_NO_DISPONIBLE');
  }
  return e;
}

// Sin respuesta del motor, la librería reintenta durante minutos: la petición se corta antes con 503.
function conLimite(promesa, ms) {
  let reloj;
  const limite = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(Object.assign(new Error(`Firestore no respondió en ${ms} ms`), { code: 4 })), ms);
  });
  // Si se corta por tiempo, el fallo tardío de la operación original ya no tiene a quién avisar.
  promesa.catch(() => {});
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}

// Envuelve cada método para que todo error del motor llegue traducido y con tiempo máximo.
const conTraduccion = (repos, ms) => Object.fromEntries(Object.entries(repos).map(([k, r]) => [k, Object.fromEntries(
  Object.entries(r).map(([m, f]) => [m, async (...a) => {
    try { return await conLimite(Promise.resolve(f(...a)), ms); } catch (e) { throw traducirError(e); }
  }])
)]));

function crearRepositoriosFirestore(db, { tiempoMaximoMs = 15_000 } = {}) {
  const unidad = {
    async ejecutar(fn) {
      try {
        // Firestore reintenta la función si otra transacción tocó los mismos documentos.
        return await conLimite(db.runTransaction(async tx => {
          const pendientes = [];
          const r = await fn(conTraduccion(crearRepositorios(db, tx, pendientes), tiempoMaximoMs));
          for (const op of pendientes) op(tx);
          return r;
        }, { maxAttempts: 5 }), tiempoMaximoMs * 2);
      } catch (e) {
        throw traducirError(e);
      }
    }
  };
  return { ...conTraduccion(crearRepositorios(db), tiempoMaximoMs), unidad };
}

module.exports = { crearRepositoriosFirestore, traducirError };
