'use strict';
// Intercalación determinista: la operación clínica ya validó el historial,
// luego cambia el nacimiento y finalmente se intenta la escritura pendiente.
// Se ejecuta sobre el doble y sobre MongoDB real (standalone y replica set).
const assert = require('node:assert/strict');

const fecha = () => new Date('2024-01-15T12:00:00Z');
const CASOS_NACIMIENTO = [
  {
    nombre: 'consulta con control', metodo: 'agregarConsulta', accion: 'REGISTRAR_CONSULTA',
    preparar: async () => null,
    escribir: (S, actor, id) => S.consultas.registrar(actor, id, {
      id_medico: 'M001', fecha_hora: fecha(), motivo: 'Carrera de nacimiento', diagnosticos: [], prescripciones: [],
      control_crecimiento: { peso_kg: 12, talla_cm: 80, perimetro_cefalico_cm: 47 }
    })
  },
  {
    nombre: 'control de crecimiento', metodo: 'agregarControl', accion: 'REGISTRAR_CRECIMIENTO',
    preparar: (S, actor, id) => S.consultas.registrar(actor, id, {
      id_medico: 'M001', fecha_hora: new Date('2026-01-01T12:00:00Z'), motivo: 'Consulta de referencia', diagnosticos: [], prescripciones: []
    }),
    escribir: (S, actor, id, ref) => S.crecimiento.registrar(actor, id, {
      id_consulta: ref.id_consulta, fecha: fecha(), peso_kg: 12, talla_cm: 80, perimetro_cefalico_cm: 47
    })
  },
  {
    nombre: 'programación de vacuna', metodo: 'programarDosis', accion: 'PROGRAMAR_VACUNA',
    preparar: async () => null,
    escribir: (S, actor, id) => S.vacunacion.programar(actor, id, { id_vacuna: 'V001', numero_dosis: 1, fecha_programada: fecha() })
  },
  {
    nombre: 'aplicación de vacuna', metodo: 'aplicarDosis', accion: 'APLICAR_VACUNA',
    preparar: (S, actor, id) => S.vacunacion.programar(actor, id, {
      id_vacuna: 'V001', numero_dosis: 1, fecha_programada: new Date('2024-03-01T00:00:00Z')
    }),
    escribir: (S, actor, id, ref) => S.vacunacion.aplicar(actor, id, ref.id_esquema, {
      fecha_aplicacion: fecha(), lote: 'LOTE-CARRERA', id_medico: 'M001'
    })
  }
];

async function comprobarCarreraNacimiento(repos, S, id, medico, secretaria, caso) {
  const ref = await caso.preparar(S, medico, id);
  const original = repos.pacientes[caso.metodo];
  let avisar, continuar;
  const listo = new Promise(r => { avisar = r; });
  const pausa = new Promise(r => { continuar = r; });
  repos.pacientes[caso.metodo] = async (...args) => { avisar(); await pausa; return original(...args); };
  const antes = await repos.pacientes.obtener(id);
  const escritura = caso.escribir(S, medico, id, ref).then(() => null, e => e);
  try {
    await listo;
    await S.pacientes.actualizarDatos(secretaria, id, { fecha_nacimiento: new Date('2024-02-01T00:00:00Z') });
  } finally {
    continuar();
    repos.pacientes[caso.metodo] = original;
  }
  const error = await escritura;
  assert.equal(error?.status, 409, 'la escritura basada en una fecha de nacimiento obsoleta debe rechazarse');
  const despues = await repos.pacientes.obtener(id);
  assert.equal(+despues.fecha_nacimiento, +new Date('2024-02-01T00:00:00Z'));
  for (const campo of ['consultas', 'controles_crecimiento', 'esquema_vacunacion']) {
    assert.deepEqual(despues[campo], antes[campo], `${campo} no cambia al rechazar la operación clínica`);
  }
  const eventos = await repos.auditoria.listar({ id_paciente: id, accion: caso.accion, limite: 100 });
  assert.equal(eventos.length, 0, 'no se registra un éxito para una escritura rechazada');
}

module.exports = { CASOS_NACIMIENTO, comprobarCarreraNacimiento };
