'use strict';
// Adaptador PostgreSQL: repositorios sobre el pool, unidad de trabajo con transacciones reales
// y traducción de los errores del motor a errores de dominio.
const E = require('../../domain/errors');
const { crearRepositorios } = require('./repositorios');

// Mensajes legibles para las restricciones UNIQUE del esquema.
const DUPLICADOS = {
  paciente_documento_identidad_key: 'Ya existe un paciente con ese documento de identidad',
  medico_solicitante_numero_colegiado_key: 'Ya existe un médico con ese número de colegiado',
  personal_laboratorio_usuario_key: 'Ya existe personal con ese usuario',
  personal_laboratorio_numero_colegiado_key: 'Ya existe personal con ese número de colegiado',
  tipo_muestra_nombre_key: 'Ya existe ese tipo de muestra',
  tipo_examen_nombre_key: 'Ya existe ese tipo de examen',
  parametro_nombre_key: 'Ya existe ese parámetro',
  examen_codigo_muestra_key: 'Código de muestra repetido'
};

function traducirError(e) {
  if (e instanceof E.DomainError) return e;
  if (e.code === '23505') return E.conflict(DUPLICADOS[e.constraint] || 'Registro duplicado');
  if (e.code === '23503') return E.badReference('Referencia inexistente');
  if (e.code === '23514' || e.code === '23502' || e.code === '22001') {
    return new E.DomainError('Datos rechazados por las restricciones de PostgreSQL', 422, 'VALIDACION_MOTOR');
  }
  if (e.code === '22P02' || e.code === '22007' || e.code === '22003') return new E.DomainError('Dato con formato inválido', 400, 'VALIDACION');
  return e;
}

const consultar = ejecutor => async (sql, params) => {
  try {
    return await ejecutor.query(sql, params);
  } catch (e) {
    throw traducirError(e);
  }
};

function crearRepositoriosPostgres(pool) {
  const repos = crearRepositorios(consultar(pool));
  const unidad = {
    async ejecutar(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const r = await fn(crearRepositorios(consultar(cliente)));
        await cliente.query('COMMIT');
        return r;
      } catch (e) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw traducirError(e);
      } finally {
        cliente.release();
      }
    }
  };
  return { ...repos, unidad };
}

module.exports = { crearRepositoriosPostgres, traducirError };
