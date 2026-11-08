'use strict';
// Utilidades compartidas por los casos de uso: bitácora, lectura de historiales y escrituras auditadas.
const E = require('../domain/errors');
const { tienePermiso } = require('../permisos');

function crearEvento(actor, accion, datos = {}) {
  return {
    usuario: actor.id, rol: actor.rol, accion,
    id_paciente: datos.id_paciente ?? null, recurso: datos.recurso ?? null,
    resultado: datos.resultado ?? 'PERMITIDO', detalle: datos.detalle ? String(datos.detalle).slice(0, 200) : null
  };
}

const paginar = ({ limite = 20, pagina = 1 }) => ({ limite, pagina, saltar: (pagina - 1) * limite });

function crearComun({ pacientes, auditoria, unidad }) {
  // Una lectura se entrega solo después de quedar en la bitácora.
  async function auditar(actor, accion, datos) {
    try {
      await auditoria.registrar(crearEvento(actor, accion, datos));
    } catch (e) {
      console.error(`[auditoria] no se pudo registrar ${accion}: ${e.message}`);
      throw new E.DomainError('No se pudo registrar el acceso en la bitácora. Vuelva a intentarlo.', 503, 'AUDITORIA_NO_DISPONIBLE');
    }
  }

  // Escritura y evento en la misma transacción: se confirman o se revierten juntos.
  // datosEvento puede ser una función del resultado (p. ej., para conocer el id recién creado).
  function escribir(actor, accion, datosEvento, fn) {
    return unidad.ejecutar(async tx => {
      const r = await fn(tx);
      await tx.auditoria.registrar(crearEvento(actor, accion, typeof datosEvento === 'function' ? datosEvento(r) : datosEvento));
      return r;
    });
  }

  // Un historial archivado solo lo consulta quien tiene historial.leer_archivados (solo lectura).
  async function exigirLectura(actor, paciente, accion) {
    if (!paciente) throw E.notFound('Paciente inexistente');
    const id_paciente = paciente.id_paciente;
    if (paciente.estado_historial !== 'Activo' && !tienePermiso(actor.rol, 'historial.leer_archivados')) {
      await auditar(actor, accion, { id_paciente, resultado: 'DENEGADO', detalle: 'Historial archivado' }).catch(() => {});
      throw E.forbidden('Historial archivado: solo el administrador puede consultarlo');
    }
    await auditar(actor, paciente.estado_historial === 'Activo' ? accion : `${accion}_ARCHIVADO`, { id_paciente });
  }

  async function leerPaciente(actor, id, accion) {
    const p = await pacientes.obtener(id);
    await exigirLectura(actor, p, accion);
    return p;
  }

  return { auditar, escribir, exigirLectura, leerPaciente };
}

module.exports = { crearComun, crearEvento, paginar };
