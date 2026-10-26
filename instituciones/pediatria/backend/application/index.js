'use strict';
// Composición de la capa de aplicación a partir de repositorios que cumplen los puertos.
const E = require('../domain/errors');
const { verificarRepositorios } = require('../ports');
const { crearComun, crearEvento } = require('./comun');
const { crearPacientesService } = require('./pacientesService');
const { crearConsultasService } = require('./consultasService');
const { crearCrecimientoService } = require('./crecimientoService');
const { crearVacunacionService } = require('./vacunacionService');

function crearCatalogosService({ medicos, vacunas, unidad }) {
  // Alta y evento en la misma unidad de trabajo: con replica set se confirman o
  // revierten juntos (transacción). En standalone no hay documento de paciente
  // donde embeber el evento (outbox): se inserta justo después y, si la bitácora
  // falla, el alta queda hecha y solo se informa en el registro del servidor
  // (docs/OPERACION_MONGODB.md §4).
  const altaAuditada = (actor, accion, recurso, referencia, alta) =>
    unidad.ejecutar(alta, crearEvento(actor, accion, { recurso, referencia }));
  return {
    listarMedicos: filtros => medicos.listar(filtros),
    async obtenerMedico(id) {
      const m = await medicos.obtener(id);
      if (!m) throw E.notFound('Médico inexistente');
      return m;
    },
    async especialidades() {
      const porNombre = new Map();
      for (const m of await medicos.listar()) {
        const e = porNombre.get(m.especialidad.nombre) || { nombre: m.especialidad.nombre, medicos: 0 };
        e.medicos += 1;
        porNombre.set(e.nombre, e);
      }
      return [...porNombre.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    async crearMedico(actor, m) {
      await altaAuditada(actor, 'CREAR_MEDICO', 'medicos', m.id_medico, () => medicos.crear(m));
      return { id_medico: m.id_medico };
    },
    listarVacunas: () => vacunas.listar(),
    async crearVacuna(actor, v) {
      await altaAuditada(actor, 'CREAR_VACUNA', 'vacunas', v.id_vacuna, () => vacunas.crear(v));
      return { id_vacuna: v.id_vacuna };
    }
  };
}

function crearServicios(repos) {
  verificarRepositorios(repos);
  const comun = crearComun(repos);
  const vacunacion = crearVacunacionService(repos, comun);
  return {
    comun,
    pacientes: crearPacientesService(repos, comun),
    consultas: crearConsultasService(repos, comun),
    crecimiento: crearCrecimientoService(repos, comun),
    vacunacion,
    catalogos: crearCatalogosService(repos),
    capacidades: comun.capacidades,
    auditoria: {
      // Entrega antes los eventos pendientes para que la consulta esté al día.
      async listar(filtros) {
        try { await repos.unidad.reenviarPendientes(); } catch (e) { console.error(`[auditoria] reenvío: ${e.message}`); }
        return repos.auditoria.listar(filtros);
      }
    },
    panel: {
      async resumen(actor) {
        const r = await repos.pacientes.resumen();
        if (actor.rol === 'secretaria') {
          return { pacientes_activos: r.pacientes_activos, pacientes_archivados: r.pacientes_archivados };
        }
        return { ...r, proximas_dosis: await vacunacion.pendientes(actor, { limite: 6 }) };
      }
    }
  };
}

module.exports = { crearServicios };
