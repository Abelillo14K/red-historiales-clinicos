'use strict';
// Catálogos del laboratorio: tipos de muestra, parámetros, tipos de examen, médicos solicitantes y personal.
// Las altas se registran en la bitácora dentro de la misma transacción.
const E = require('../domain/errors');
const R = require('../domain/reglas');

function crearCatalogosService({ catalogos }, comun) {
  const { escribir } = comun;
  const alta = (actor, accion, recurso, fn) => escribir(actor, accion, r => ({ recurso, detalle: `id ${Object.values(r)[0]}` }), fn);

  return {
    tiposMuestra: () => catalogos.tiposMuestra(),
    crearTipoMuestra: (actor, d) => alta(actor, 'CREAR_TIPO_MUESTRA', 'tipos_muestra',
      async tx => ({ id_tipo_muestra: await tx.catalogos.crearTipoMuestra(d) })),

    parametros: () => catalogos.parametros(),
    crearParametro: (actor, d) => alta(actor, 'CREAR_PARAMETRO', 'parametros',
      async tx => ({ id_parametro: await tx.catalogos.crearParametro(d) })),

    tiposExamen: () => catalogos.tiposExamen(),
    async obtenerTipoExamen(id) {
      const t = await catalogos.obtenerTipoExamen(id);
      if (!t) throw E.notFound('Tipo de examen inexistente');
      return t;
    },
    crearTipoExamen(actor, { parametros, ...tipo }) {
      R.sinRepetidos(parametros.map(p => p.id_parametro), 'Parámetro');
      R.sinRepetidos(parametros.map(p => p.orden_presentacion), 'Orden de presentación');
      return alta(actor, 'CREAR_TIPO_EXAMEN', 'tipos_examen', async tx => {
        const muestras = await tx.catalogos.tiposMuestra();
        if (!muestras.some(m => m.id_tipo_muestra === String(tipo.id_tipo_muestra))) throw E.badReference('Tipo de muestra inexistente');
        const existentes = new Map((await tx.catalogos.parametros()).map(p => [p.id_parametro, p]));
        for (const p of parametros) {
          const def = existentes.get(String(p.id_parametro));
          if (!def) throw E.badReference(`Parámetro inexistente: ${p.id_parametro}`);
          if (def.tipo_dato === 'Numerico' && p.valor_ref_texto) throw E.invalid(`${def.nombre}: un parámetro numérico usa rango mínimo y máximo`);
          if (def.tipo_dato === 'Texto' && (p.valor_ref_min != null || p.valor_ref_max != null)) throw E.invalid(`${def.nombre}: un parámetro de texto usa referencia de texto`);
        }
        return { id_tipo_examen: await tx.catalogos.crearTipoExamen(tipo, parametros) };
      });
    },

    medicos: () => catalogos.medicos(),
    crearMedico: (actor, d) => alta(actor, 'CREAR_MEDICO', 'medicos',
      async tx => ({ id_medico: await tx.catalogos.crearMedico(d) })),

    personal: () => catalogos.personal(),
    crearPersonal: (actor, d) => alta(actor, 'CREAR_PERSONAL', 'personal',
      async tx => ({ id_personal: await tx.catalogos.crearPersonal(d) }))
  };
}

module.exports = { crearCatalogosService };
