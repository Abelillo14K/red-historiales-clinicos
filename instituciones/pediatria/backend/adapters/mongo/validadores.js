'use strict';
// Validadores $jsonSchema de Fase II para las 4 colecciones.
// Reflejan las mismas restricciones que los esquemas Zod de src/schema.js
// (longitudes, rangos, enumeraciones, formato de identificadores) para que una
// escritura que no pase por la API tampoco pueda romper el modelo.
// Se permiten campos adicionales (trazas registrado_por, aplicado_por, etc.).
const ID = '^[A-Za-z0-9_-]{1,40}$';
const id = { bsonType: 'string', pattern: ID };
const texto = (max = 255) => ({ bsonType: 'string', minLength: 1, maxLength: max });
const textoOpc = (max = 1000) => ({ bsonType: ['string', 'null'], maxLength: max });
const medida = max => ({ bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0, exclusiveMinimum: true, maximum: max });
const fecha = { bsonType: 'date' };
const fechaOpc = { bsonType: ['date', 'null'] };
const traza = {
  bsonType: 'object', required: ['id_usuario', 'rol', 'fecha'],
  properties: { id_usuario: texto(80), rol: { enum: ['medico', 'secretaria', 'administrador'] }, fecha }
};
const tratamiento = {
  bsonType: 'object', required: ['descripcion'],
  properties: { descripcion: texto(), recomendaciones: textoOpc(), registrado_por: traza }
};
// Evento de auditoría (colección bitacora_acceso y bandeja pendiente embebida).
const evento = {
  bsonType: 'object', required: ['id_usuario', 'accion', 'fecha_hora'],
  properties: {
    id_evento: { bsonType: ['string', 'null'], maxLength: 64 }, id_usuario: texto(80),
    rol: textoOpc(40), id_paciente: { bsonType: ['string', 'null'], maxLength: 40 },
    accion: { bsonType: 'string', pattern: '^[A-Z_]{1,60}$' }, fecha_hora: fecha,
    recurso: textoOpc(60), referencia: textoOpc(80), resultado: textoOpc(20), detalle: textoOpc(500)
  }
};

const pacientes = {
  bsonType: 'object',
  required: ['id_paciente', 'nombres', 'apellidos', 'fecha_nacimiento', 'sexo', 'estado_historial',
    'tutores', 'consultas', 'controles_crecimiento', 'esquema_vacunacion'],
  properties: {
    id_paciente: id, nombres: texto(), apellidos: texto(), fecha_nacimiento: fecha,
    sexo: { enum: ['M', 'F'] },
    estado_historial: { enum: ['Activo', 'Archivado'] },
    fecha_archivado: fecha, motivo_archivado: texto(), fecha_registro: fecha,
    registrado_por: traza, archivado_por: traza, ultima_actualizacion: traza,
    bitacora_pendiente: { bsonType: 'array', items: evento },
    tutores: {
      bsonType: 'array', minItems: 1, maxItems: 10,
      items: {
        bsonType: 'object', required: ['id_tutor', 'dpi', 'nombres', 'apellidos', 'parentesco', 'es_principal'],
        properties: {
          id_tutor: id, dpi: texto(), nombres: texto(), apellidos: texto(), parentesco: texto(),
          telefono: textoOpc(), correo: textoOpc(255), direccion: textoOpc(), es_principal: { bsonType: 'bool' }
        }
      }
    },
    consultas: {
      bsonType: 'array',
      items: {
        bsonType: 'object', required: ['id_consulta', 'id_medico', 'fecha_hora', 'motivo'],
        properties: {
          id_consulta: id, id_medico: id, fecha_hora: fecha, motivo: texto(), observaciones: textoOpc(2000),
          registrado_por: traza,
          diagnosticos: {
            bsonType: 'array', maxItems: 20,
            items: { bsonType: 'object', required: ['codigo', 'descripcion'], properties: { codigo: texto(20), descripcion: texto() } }
          },
          tratamiento: { ...tratamiento, bsonType: ['object', 'null'] },
          tratamientos_anteriores: { bsonType: 'array', items: tratamiento },
          prescripciones: {
            bsonType: 'array',
            items: {
              bsonType: 'object', required: ['id_prescripcion', 'fecha_emision', 'medicamentos'],
              properties: {
                id_prescripcion: id, fecha_emision: fecha, indicaciones_generales: textoOpc(),
                medicamentos: {
                  bsonType: 'array', minItems: 1, maxItems: 20,
                  items: {
                    bsonType: 'object', required: ['nombre', 'dosis', 'frecuencia', 'duracion', 'via_administracion'],
                    properties: {
                      id_medicamento: id, nombre: texto(), dosis: texto(), frecuencia: texto(),
                      duracion: texto(), via_administracion: texto()
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    controles_crecimiento: {
      bsonType: 'array',
      items: {
        // Fase I: el perímetro cefálico se registra "si corresponde" (opcional).
        bsonType: 'object', required: ['id_control', 'id_consulta', 'fecha', 'peso_kg', 'talla_cm'],
        properties: {
          id_control: id, id_consulta: id, fecha,
          peso_kg: medida(250), talla_cm: medida(250), perimetro_cefalico_cm: medida(100)
        }
      }
    },
    esquema_vacunacion: {
      bsonType: 'array',
      items: {
        bsonType: 'object', required: ['id_esquema', 'id_vacuna', 'numero_dosis', 'fecha_programada', 'estado'],
        properties: {
          id_esquema: id, id_vacuna: id, numero_dosis: { bsonType: ['int', 'long', 'double'], minimum: 1, maximum: 20 },
          fecha_programada: fecha, fecha_aplicacion: fechaOpc,
          estado: { enum: ['Pendiente', 'Aplicada', 'Cancelada'] },
          lote: { bsonType: ['string', 'null'], maxLength: 60 }, id_medico: { bsonType: ['string', 'null'], pattern: ID },
          motivo_cancelacion: texto()
        }
      }
    }
  }
};

const medicos = {
  bsonType: 'object', required: ['id_medico', 'colegiado', 'nombres', 'apellidos', 'especialidad'],
  properties: {
    id_medico: id, colegiado: texto(), nombres: texto(), apellidos: texto(),
    especialidad: { bsonType: 'object', required: ['id_especialidad', 'nombre'], properties: { id_especialidad: id, nombre: texto() } }
  }
};

const vacunas = {
  bsonType: 'object', required: ['id_vacuna', 'nombre'],
  properties: { id_vacuna: id, nombre: texto(), descripcion: textoOpc() }
};

const bitacora_acceso = evento;

module.exports = { VALIDADORES: { pacientes, medicos, vacunas, bitacora_acceso } };
