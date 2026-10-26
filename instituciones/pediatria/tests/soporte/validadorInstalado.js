'use strict';
// Copia fiel del validador que tiene HOY la colección `pacientes` en
// centro_pediatrico_db (leído con listCollections el 23/10/2026). Las pruebas lo
// instalan en la base desechable para reproducir el estado real antes de aplicar
// los validadores de Fase II (en particular: perímetro cefálico obligatorio).
const num = { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 };
module.exports = {
  pacientes: {
    bsonType: 'object',
    required: ['id_paciente', 'nombres', 'apellidos', 'fecha_nacimiento', 'sexo', 'estado_historial'],
    properties: {
      id_paciente: { bsonType: 'string', minLength: 1 },
      nombres: { bsonType: 'string', minLength: 1 },
      apellidos: { bsonType: 'string', minLength: 1 },
      fecha_nacimiento: { bsonType: 'date' },
      sexo: { enum: ['M', 'F'] },
      estado_historial: { enum: ['Activo', 'Archivado'] },
      tutores: { bsonType: 'array' },
      consultas: { bsonType: 'array' },
      controles_crecimiento: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['id_control', 'id_consulta', 'fecha', 'peso_kg', 'talla_cm', 'perimetro_cefalico_cm'],
          properties: {
            id_control: { bsonType: 'string' }, id_consulta: { bsonType: 'string' }, fecha: { bsonType: 'date' },
            peso_kg: num, talla_cm: num, perimetro_cefalico_cm: num
          }
        }
      },
      esquema_vacunacion: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          properties: {
            estado: { enum: ['Pendiente', 'Aplicada', 'Cancelada'] },
            fecha_programada: { bsonType: 'date' }, fecha_aplicacion: { bsonType: ['date', 'null'] }
          }
        }
      }
    }
  }
};
