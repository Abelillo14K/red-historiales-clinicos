const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../backend/schema');

test('El control de crecimiento rechaza valores negativos', () => {
  const r = S.crecimiento.safeParse({
    id_control: 'CR004', id_consulta: 'C004', fecha: '2026-10-23T15:00:00Z',
    peso_kg: -2, talla_cm: 90, perimetro_cefalico_cm: 50
  });
  assert.equal(r.success, false);
});

test('La consulta guarda diagnóstico, tratamiento, receta y fechas BSON', () => {
  const result = S.consulta.safeParse({
    id_consulta: 'C004', id_medico: 'M001', fecha_hora: '2026-10-23T15:00:00Z',
    motivo: 'Ejemplo académico', diagnosticos: [{ codigo: 'DEMO', descripcion: 'Ficticio' }],
    tratamiento: { descripcion: 'Seguimiento de demostración', recomendaciones: 'Sin indicación médica' },
    prescripciones: [{
      id_prescripcion: 'RX004', fecha_emision: '2026-10-23T16:00:00Z',
      indicaciones_generales: 'Prueba de software', medicamentos: [{
        id_medicamento: 'MED-DEMO', nombre: 'Ficticio', dosis: 'No aplica',
        frecuencia: 'No aplica', duracion: 'No aplica', via_administracion: 'No aplica'
      }]
    }]
  });
  assert.equal(result.success, true);
  assert.ok(result.data.fecha_hora instanceof Date);
  assert.ok(result.data.prescripciones[0].fecha_emision instanceof Date);
});

test('El esquema de vacunación rechaza un estado no reconocido', () => {
  const r = S.dosis.safeParse({
    id_esquema: 'EV004', id_vacuna: 'V001', numero_dosis: 1,
    fecha_programada: '2026-11-15T00:00:00Z', estado: 'Incorrecta'
  });
  assert.equal(r.success, false);
});

test('Los datos de un paciente convierten la fecha a BSON Date', () => {
  const r = S.patient.safeParse({
    id_paciente: 'P004', nombres: 'Paciente', apellidos: 'Ficticio',
    fecha_nacimiento: '2023-04-21', sexo: 'F',
    tutores: [{
      id_tutor: 'T004', dpi: 'FICTICIO-004', nombres: 'Tutor',
      apellidos: 'Ficticio', parentesco: 'Madre', es_principal: true
    }]
  });
  assert.equal(r.success, true);
  assert.ok(r.data.fecha_nacimiento instanceof Date);
});

test('El archivo requiere motivo administrativo', () => {
  assert.equal(S.archivar.safeParse({}).success, false);
  assert.equal(S.archivar.safeParse({motivo_archivado: 'Traslado'}).success, true);
});
