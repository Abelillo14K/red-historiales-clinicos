'use strict';
// Catálogos de la clínica: odontólogos (id = número de colegiado) y procedimientos (id = código).
// Usar esos valores como id del documento hace que Firestore garantice que no se repitan.
const E = require('../domain/errors');

function crearCatalogosService({ catalogos }, comun) {
  const { escribir } = comun;
  return {
    odontologos: () => catalogos.odontologos(),
    crearOdontologo: (actor, d) => escribir(actor, 'CREAR_ODONTOLOGO', { recurso: 'odontologos', detalle: d.colegiado }, async tx => {
      await tx.catalogos.crearOdontologo({ ...d, id_odontologo: d.colegiado, activo: true });
      return { id_odontologo: d.colegiado };
    }),
    procedimientos: () => catalogos.procedimientos(),
    async obtenerProcedimiento(id) {
      const p = await catalogos.obtenerProcedimiento(id);
      if (!p) throw E.notFound('Procedimiento inexistente');
      return p;
    },
    crearProcedimiento: (actor, d) => escribir(actor, 'CREAR_PROCEDIMIENTO', { recurso: 'procedimientos', detalle: d.codigo }, async tx => {
      await tx.catalogos.crearProcedimiento({ ...d, id_procedimiento: d.codigo });
      return { id_procedimiento: d.codigo };
    })
  };
}

module.exports = { crearCatalogosService };
