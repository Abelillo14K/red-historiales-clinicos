'use strict';
// Unidad de trabajo MongoDB: garantiza que el evento de auditoría de una
// escritura clínica quede registrado si, y solo si, la escritura se confirma.
//
// - Replica set / sharded cluster: escritura clínica + inserción en
//   bitacora_acceso dentro de una transacción multidocumento.
// - Servidor standalone (configuración actual del proyecto, sin transacciones):
//   patrón "outbox" embebido. El repositorio agrega el evento al arreglo
//   `bitacora_pendiente` del propio paciente EN EL MISMO updateOne/insertOne
//   (atomicidad de documento). Después se copia a bitacora_acceso (idempotente
//   por id_evento, índice único) y se retira del paciente. Si la copia falla,
//   el evento sigue guardado en el paciente y `reenviarPendientes` lo entrega
//   más tarde: nunca se pierde, aunque llegue a la bitácora con retraso.
const { AsyncLocalStorage } = require('node:async_hooks');
const contexto = new AsyncLocalStorage();

// Opciones que cada repositorio agrega a sus operaciones para participar
// en la transacción activa, si existe.
const opcionesSesion = (extra = {}) => {
  const session = contexto.getStore()?.session;
  return session ? { ...extra, session } : extra;
};

// Evento pendiente que el repositorio de pacientes debe embeber en su escritura
// (solo sin transacciones). Marca que ya fue embebido para no duplicarlo.
function tomarEventoPendiente() {
  const store = contexto.getStore();
  if (!store?.evento || store.session || store.embebido) return null;
  store.embebido = true;
  return store.evento;
}

function crearUnidadDeTrabajo(client, db) {
  let soporte = null;
  const bitacora = () => db.collection('bitacora_acceso');
  const pacientes = () => db.collection('pacientes');

  async function soportaTransacciones() {
    if (soporte === null) {
      const hello = await db.command({ hello: 1 });
      soporte = Boolean(hello.setName || hello.msg === 'isdbgrid');
    }
    return soporte;
  }

  // Copia idempotente a bitacora_acceso y retiro del pendiente embebido.
  async function entregar(evento) {
    try {
      await bitacora().insertOne({ ...evento });
    } catch (e) {
      if (e.code !== 11000) throw e; // ya entregado antes: se continúa con el retiro
    }
    if (evento.id_paciente) {
      await pacientes().updateOne({ id_paciente: evento.id_paciente },
        { $pull: { bitacora_pendiente: { id_evento: evento.id_evento } } });
    }
  }

  async function ejecutar(fn, evento = null) {
    if (await soportaTransacciones()) {
      const session = client.startSession();
      try {
        let resultado;
        await session.withTransaction(async () => {
          resultado = await contexto.run({ session }, async () => {
            const r = await fn();
            if (evento) await bitacora().insertOne({ ...evento }, { session });
            return r;
          });
        });
        return resultado;
      } finally {
        await session.endSession();
      }
    }
    const store = { evento, embebido: false };
    const resultado = await contexto.run(store, fn);
    if (evento) {
      try {
        if (store.embebido) await entregar(evento);
        else await bitacora().insertOne({ ...evento }); // mutación sin documento de paciente
      } catch (e) {
        // Embebido: queda pendiente en el paciente y se reenviará. No embebido: se informa.
        console.error(`[auditoria] ${evento.accion} ${store.embebido ? 'pendiente de entrega' : 'no registrada'}: ${e.message}`);
      }
    }
    return resultado;
  }

  // Entrega los eventos que quedaron embebidos por un fallo previo.
  async function reenviarPendientes() {
    const conPendientes = pacientes().find({ 'bitacora_pendiente.id_evento': { $exists: true } },
      { projection: { _id: 0, id_paciente: 1, bitacora_pendiente: 1 } });
    let entregados = 0;
    for await (const p of conPendientes) {
      for (const e of p.bitacora_pendiente) { await entregar(e); entregados++; }
    }
    return entregados;
  }

  return { ejecutar, soportaTransacciones, reenviarPendientes };
}

module.exports = { crearUnidadDeTrabajo, opcionesSesion, tomarEventoPendiente };
