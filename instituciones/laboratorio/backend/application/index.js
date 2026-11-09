'use strict';
// Composición de la capa de aplicación a partir de repositorios que cumplen los puertos.
const { verificarRepositorios } = require('../ports');
const { crearComun } = require('./comun');
const { crearPacientesService } = require('./pacientesService');
const { crearSolicitudesService } = require('./solicitudesService');
const { crearResultadosService } = require('./resultadosService');
const { crearCatalogosService } = require('./catalogosService');
const { crearAccesoService } = require('./accesoService');

function crearServicios(repos) {
  verificarRepositorios(repos);
  const comun = crearComun(repos);
  return {
    comun,
    pacientes: crearPacientesService(repos, comun),
    solicitudes: crearSolicitudesService(repos, comun),
    resultados: crearResultadosService(repos, comun),
    catalogos: crearCatalogosService(repos, comun),
    acceso: crearAccesoService(repos, comun),
    auditoria: { listar: filtros => repos.auditoria.listar(filtros) },
    panel: {
      async resumen(actor) {
        const [pacientes, solicitudes] = await Promise.all([repos.pacientes.resumen(), repos.solicitudes.resumen()]);
        await comun.auditar(actor, 'LEER_PANEL', { recurso: 'panel' });
        return { ...pacientes, solicitudes };
      }
    }
  };
}

module.exports = { crearServicios };
