'use strict';
// Composición de la capa de aplicación a partir de repositorios que cumplen los puertos.
const { verificarRepositorios } = require('../ports');
const { crearComun } = require('./comun');
const { crearPacientesService } = require('./pacientesService');
const { crearConsultasService } = require('./consultasService');
const { crearCitasService } = require('./citasService');
const { crearCatalogosService } = require('./catalogosService');

function crearServicios(repos) {
  verificarRepositorios(repos);
  const comun = crearComun(repos);
  return {
    comun,
    pacientes: crearPacientesService(repos, comun),
    consultas: crearConsultasService(repos, comun),
    citas: crearCitasService(repos, comun),
    catalogos: crearCatalogosService(repos, comun),
    auditoria: { listar: filtros => repos.auditoria.listar(filtros) },
    panel: {
      async resumen(actor) {
        const ahora = new Date();
        const [pacientes, consultas, proximas] = await Promise.all([
          repos.pacientes.resumen(), repos.consultas.contar(),
          repos.citas.listar({ desde: ahora, hasta: new Date(ahora.getTime() + 7 * 864e5), estado: 'Programada' })
        ]);
        await comun.auditar(actor, 'LEER_PANEL', { recurso: 'panel' });
        return { ...pacientes, consultas, citas_proximas: proximas.length, proximas_citas: proximas.slice(0, 5) };
      }
    }
  };
}

module.exports = { crearServicios };
