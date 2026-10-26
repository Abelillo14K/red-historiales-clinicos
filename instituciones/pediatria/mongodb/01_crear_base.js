// HISTÓRICO — registro de lo ejecutado en mongosh al inicio de la Fase II. NO volver a ejecutar:
// usa campos/estados anteriores (plan_tratamiento, receta, 'Omitida') incompatibles con la API
// actual y podría reemplazar el validador o modificar P001. Use en su lugar:
//   npm run db:indices      (índices)      npm run db:validadores   (validadores con respaldo y reversión)
if (typeof EJECUTAR_SCRIPT_HISTORICO === 'undefined') { print('Script histórico: no se ejecuta (ver comentario inicial).'); quit(1); }
// Fase II - Centro Médico Pediátrico. Ejecutar en mongosh (no en Node.js).
// No elimina colecciones ni documentos existentes.
// ACTUALIZADO: alineado con los documentos reales (tratamiento, prescripciones, estado Cancelada).
// La definición completa y vigente está en instituciones/pediatria/backend/adapters/mongo/validadores.js y se
// verifica/aplica con: node instituciones/pediatria/scripts/validadores.js [--aplicar] (collMod requiere dbAdmin).
const pediatria = db.getSiblingDB('centro_pediatrico_db');
function asegurarColeccion(nombre, validador) {
  if (!pediatria.getCollectionNames().includes(nombre)) {
    pediatria.createCollection(nombre, { validator: {$jsonSchema: validador}, validationAction:'error' });
  } else {
    pediatria.runCommand({collMod:nombre, validator:{$jsonSchema:validador},validationAction:'error'});
  }
}
const texto = {bsonType:'string', minLength:1};
asegurarColeccion('pacientes',{
  bsonType:'object',required:['id_paciente','nombres','apellidos','fecha_nacimiento','sexo','estado_historial','tutores','consultas','controles_crecimiento','esquema_vacunacion'],
  properties:{id_paciente:texto,nombres:texto,apellidos:texto,fecha_nacimiento:{bsonType:'date'},sexo:texto,
    estado_historial:{enum:['Activo','Archivado']},
    tutores:{bsonType:'array',items:{bsonType:'object',required:['id_tutor','dpi','nombres','apellidos','parentesco','es_principal'],properties:{id_tutor:texto,dpi:texto,nombres:texto,apellidos:texto,telefono:{bsonType:'string'},correo:{bsonType:'string'},direccion:{bsonType:'string'},parentesco:texto,es_principal:{bsonType:'bool'}}}},
    consultas:{bsonType:'array',items:{bsonType:'object',required:['id_consulta','id_medico','fecha_hora','motivo'],properties:{id_consulta:texto,id_medico:texto,fecha_hora:{bsonType:'date'},motivo:texto,observaciones:{bsonType:'string'},diagnosticos:{bsonType:'array'},tratamiento:{bsonType:['object','null']},prescripciones:{bsonType:'array'}}}},
    controles_crecimiento:{bsonType:'array',items:{bsonType:'object',required:['id_control','id_consulta','fecha','peso_kg','talla_cm','perimetro_cefalico_cm'],properties:{id_control:texto,id_consulta:texto,fecha:{bsonType:'date'},peso_kg:{bsonType:['double','int','long','decimal']},talla_cm:{bsonType:['double','int','long','decimal']},perimetro_cefalico_cm:{bsonType:['double','int','long','decimal']}}}},
    esquema_vacunacion:{bsonType:'array',items:{bsonType:'object',required:['id_esquema','id_vacuna','numero_dosis','fecha_programada','estado'],properties:{id_esquema:texto,id_vacuna:texto,numero_dosis:{bsonType:['int','long','double']},fecha_programada:{bsonType:'date'},fecha_aplicacion:{bsonType:['date','null']},estado:{enum:['Pendiente','Aplicada','Cancelada']},lote:{bsonType:['string','null']},id_medico:{bsonType:['string','null']}}}}
  }
});
asegurarColeccion('medicos',{bsonType:'object',required:['id_medico','colegiado','nombres','apellidos','especialidad'],properties:{id_medico:texto,colegiado:texto,nombres:texto,apellidos:texto,especialidad:{bsonType:'object',required:['id_especialidad','nombre'],properties:{id_especialidad:texto,nombre:texto}}}});
asegurarColeccion('vacunas',{bsonType:'object',required:['id_vacuna','nombre'],properties:{id_vacuna:texto,nombre:texto,descripcion:{bsonType:'string'}}});
// Extensión para Fase II: bitácora de accesos/cambios, no incluida en las 3 colecciones iniciales.
asegurarColeccion('bitacora_acceso',{bsonType:'object',required:['id_usuario','accion','fecha_hora'],properties:{id_usuario:texto,id_paciente:{bsonType:['string','null']},accion:texto,fecha_hora:{bsonType:'date'},detalle:{bsonType:['string','null']},rol:{bsonType:['string','null']},recurso:{bsonType:['string','null']},referencia:{bsonType:['string','null']},resultado:{bsonType:['string','null']}}});
pediatria.pacientes.createIndex({id_paciente:1},{unique:true});
pediatria.medicos.createIndex({id_medico:1},{unique:true});
pediatria.medicos.createIndex({colegiado:1},{unique:true});
pediatria.vacunas.createIndex({id_vacuna:1},{unique:true});
pediatria.pacientes.createIndex({'tutores.dpi':1});
pediatria.bitacora_acceso.createIndex({id_paciente:1,fecha_hora:-1});
print('Base preparada: centro_pediatrico_db');
printjson(pediatria.getCollectionNames());
