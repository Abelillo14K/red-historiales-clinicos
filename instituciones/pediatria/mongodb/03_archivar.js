// HISTÓRICO — registro de lo ejecutado en mongosh al inicio de la Fase II. NO volver a ejecutar:
// usa campos/estados anteriores (plan_tratamiento, receta, 'Omitida') incompatibles con la API
// actual y podría reemplazar el validador o modificar P001. Use en su lugar:
//   npm run db:indices      (índices)      npm run db:validadores   (validadores con respaldo y reversión)
if (typeof EJECUTAR_SCRIPT_HISTORICO === 'undefined') { print('Script histórico: no se ejecuta (ver comentario inicial).'); quit(1); }
// NOTA Fase II: el archivado se realiza desde la API/frontend (PATCH /api/pacientes/:id/archivar)
// que además guarda fecha_archivado, motivo_archivado y archivado_por.
// Ejecutar en mongosh SOLO después de probar las otras operaciones.
const p = db.getSiblingDB('centro_pediatrico_db');
const r=p.pacientes.updateOne({id_paciente:'P001',estado_historial:'Activo'},{$set:{estado_historial:'Archivado'}});
if(r.modifiedCount) p.bitacora_acceso.insertOne({id_usuario:'DEMO_ADMIN',id_paciente:'P001',accion:'ARCHIVAR_HISTORIAL',fecha_hora:new Date(),detalle:'Archivado lógico de prueba'});
printjson({modificados:r.modifiedCount,estado:p.pacientes.findOne({id_paciente:'P001'},{projection:{_id:0,id_paciente:1,estado_historial:1}})});
