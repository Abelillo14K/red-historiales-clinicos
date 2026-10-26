'use strict';
// Utilidades compartidas por los casos de uso.
const { randomUUID } = require('node:crypto');
const E = require('../domain/errors');
const R = require('../domain/reglas');

const traza = actor => ({ id_usuario: actor.id, rol: actor.rol, fecha: new Date() });

// Elimina campos nulos/indefinidos para no guardar valores vacíos en BSON.
function limpiar(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));
}

// Evento de bitacora_acceso. id_evento permite entregarlo de forma idempotente.
function crearEvento(actor, accion, datos = {}) {
  const evento = {
    id_evento: randomUUID(), id_usuario: actor.id, rol: actor.rol, id_paciente: datos.id_paciente ?? null, accion,
    recurso: datos.recurso ?? null, referencia: datos.referencia ?? null,
    resultado: datos.resultado ?? 'EXITOSO', fecha_hora: new Date()
  };
  if (datos.detalle) evento.detalle = String(datos.detalle).slice(0, 500);
  return evento;
}

// El personal médico ve el DPI de los tutores enmascarado (dato restringido, Fase I).
function protegerTutores(paciente, actor) {
  if (actor.rol !== 'medico' || !Array.isArray(paciente?.tutores)) return paciente;
  return { ...paciente, tutores: paciente.tutores.map(t => ({ ...t, dpi: R.enmascararDpi(t.dpi) })) };
}

const CAPACIDADES_FASE2 = async () => ({ perimetro_cefalico_opcional: true });

function crearComun({ pacientes, auditoria, unidad, capacidades = CAPACIDADES_FASE2 }) {
  // Lecturas y accesos denegados: no hay escritura clínica con la que agruparlos,
  // así que se insertan directamente. Sin transacciones, un fallo aquí se informa
  // en el registro del servidor y no impide la lectura.
  async function auditar(actor, accion, datos = {}) {
    try {
      await auditoria.registrar(crearEvento(actor, accion, datos));
    } catch (e) {
      if (await unidad.soportaTransacciones()) throw e;
      console.error(`[auditoria] no se pudo registrar ${accion}: ${e.message}`);
    }
  }

  // Lectura de historial con la política de archivados: solo el administrador
  // puede consultar un historial archivado (solo lectura).
  async function leerHistorial(actor, id, accion) {
    const p = await pacientes.obtener(id);
    if (!p) throw E.notFound('Paciente inexistente');
    if (p.estado_historial !== 'Activo' && actor.rol !== 'administrador') {
      await auditar(actor, accion, { id_paciente: id, resultado: 'DENEGADO', detalle: 'Historial archivado' });
      throw E.forbidden('Historial archivado: solo el administrador puede consultarlo');
    }
    await auditar(actor, p.estado_historial === 'Activo' ? accion : `${accion}_ARCHIVADO`, { id_paciente: id });
    return protegerTutores(p, actor);
  }

  async function cargarActivo(id) {
    const p = await pacientes.obtener(id);
    if (!p) throw E.notFound('Paciente inexistente');
    if (p.estado_historial !== 'Activo') throw E.conflict('El historial está archivado; no admite modificaciones');
    return p;
  }

  // Escritura clínica + evento de auditoría en la misma unidad de trabajo:
  // transacción (replica set) o evento embebido en el mismo updateOne (standalone).
  async function escribir(actor, accion, auditoriaDatos, mutacion, mensajeFallo) {
    return unidad.ejecutar(async () => {
      const ok = await mutacion();
      if (!ok) throw E.conflict(mensajeFallo || 'El historial cambió durante la operación; vuelva a intentarlo');
      return ok;
    }, crearEvento(actor, accion, auditoriaDatos));
  }

  // Perímetro cefálico: opcional según la Fase I ("si corresponde"), pero solo se
  // puede omitir cuando el validador instalado en la base ya lo permite.
  async function prepararMedicion({ peso_kg, talla_cm, perimetro_cefalico_cm }) {
    const m = { peso_kg, talla_cm };
    if (perimetro_cefalico_cm != null) m.perimetro_cefalico_cm = perimetro_cefalico_cm;
    else if (!(await capacidades()).perimetro_cefalico_opcional) {
      throw E.invalid('El validador instalado en MongoDB todavía exige el perímetro cefálico. ' +
        'Indíquelo o aplique los validadores de Fase II (npm run db:validadores -- --aplicar).');
    }
    return m;
  }

  return { auditar, leerHistorial, cargarActivo, escribir, protegerTutores, prepararMedicion, capacidades };
}

module.exports = { crearComun, crearEvento, traza, limpiar, protegerTutores };
