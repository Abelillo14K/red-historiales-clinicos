// HISTÓRICO — registro de lo ejecutado en mongosh al inicio de la Fase II. NO volver a ejecutar:
// usa campos/estados anteriores (plan_tratamiento, receta, 'Omitida') incompatibles con la API
// actual y podría reemplazar el validador o modificar P001. Use en su lugar:
//   npm run db:indices      (índices)      npm run db:validadores   (validadores con respaldo y reversión)
if (typeof EJECUTAR_SCRIPT_HISTORICO === 'undefined') { print('Script histórico: no se ejecuta (ver comentario inicial).'); quit(1); }
// NOTA Fase II: este script de demostración usa los campos iniciales (plan_tratamiento/receta).
// La API actual usa tratamiento/prescripciones. No es necesario ejecutarlo: los datos ya existen.
// Ejecutar en mongosh DESPUÉS de 01_crear_base.js. Todos los datos son ficticios.
const p = db.getSiblingDB('centro_pediatrico_db');
const registrar = (accion) => p.bitacora_acceso.insertOne({id_usuario:'DEMO_MEDICO',id_paciente:'P001',accion,fecha_hora:new Date(),detalle:'Ejecución demostrativa desde mongosh'});
// Datos de catálogos: upsert evita duplicar si se ejecuta varias veces.
p.medicos.updateOne({id_medico:'M001'},{$setOnInsert:{id_medico:'M001',colegiado:'COLEGIADO-FICTICIO-001',nombres:'Lucía',apellidos:'Ejemplo',especialidad:{id_especialidad:'ESP01',nombre:'Pediatría'}}},{upsert:true});
p.vacunas.updateOne({id_vacuna:'V001'},{$setOnInsert:{id_vacuna:'V001',nombre:'Vacuna demostrativa A',descripcion:'Dato ficticio, no constituye una recomendación médica'}},{upsert:true});
p.vacunas.updateOne({id_vacuna:'V002'},{$setOnInsert:{id_vacuna:'V002',nombre:'Vacuna demostrativa B',descripcion:'Dato ficticio, no constituye una recomendación médica'}},{upsert:true});
// 1. Registro de paciente con tutor.
p.pacientes.updateOne({id_paciente:'P001'},{$setOnInsert:{id_paciente:'P001',nombres:'Paciente',apellidos:'Demostración',fecha_nacimiento:ISODate('2020-05-20T00:00:00Z'),sexo:'F',estado_historial:'Activo',tutores:[{id_tutor:'T001',dpi:'DPI-FICTICIO-001',nombres:'Ana',apellidos:'Demostración',telefono:'00000000',correo:'tutora@example.com',direccion:'Dirección de prueba',parentesco:'Madre',es_principal:true}],consultas:[],controles_crecimiento:[],esquema_vacunacion:[]}},{upsert:true});
// 2. Registrar consulta con mejoras requeridas en Fase II.
const nuevaConsulta={id_consulta:'C001',id_medico:'M001',fecha_hora:ISODate('2026-10-18T10:00:00Z'),motivo:'Control general ficticio',observaciones:'Paciente de prueba',diagnosticos:[{codigo:'DEMO',descripcion:'Diagnóstico ficticio'}],plan_tratamiento:'Seguimiento de demostración',receta:[{medicamento:'Medicamento ficticio',dosis:'Dosis de demostración',frecuencia:'Frecuencia de demostración',duracion:'Duración de demostración'}]};
const c=p.pacientes.updateOne({id_paciente:'P001',estado_historial:'Activo','consultas.id_consulta':{$ne:'C001'}},{$push:{consultas:nuevaConsulta}});
if(c.modifiedCount) registrar('REGISTRAR_CONSULTA');
// 3. Agregar medición histórica (no sobrescribir).
const cr=p.pacientes.updateOne({id_paciente:'P001',estado_historial:'Activo','consultas.id_consulta':'C001','controles_crecimiento.id_control':{$ne:'CR001'}},{$push:{controles_crecimiento:{id_control:'CR001',id_consulta:'C001',fecha:ISODate('2026-10-18T10:15:00Z'),peso_kg:20.5,talla_cm:110.0,perimetro_cefalico_cm:50.0}}});
if(cr.modifiedCount) registrar('REGISTRAR_CRECIMIENTO');
// 4. Programar dosis (referencia al catálogo de vacunas).
const v=p.pacientes.updateOne({id_paciente:'P001',estado_historial:'Activo','esquema_vacunacion.id_esquema':{$ne:'EV001'}},{$push:{esquema_vacunacion:{id_esquema:'EV001',id_vacuna:'V001',numero_dosis:1,fecha_programada:ISODate('2026-10-20T00:00:00Z'),fecha_aplicacion:null,estado:'Pendiente',lote:null,id_medico:null}}});
if(v.modifiedCount) registrar('PROGRAMAR_VACUNA');
// 5. Aplicación condicional: solo si la dosis sigue Pendiente.
const aplicada=p.pacientes.updateOne({id_paciente:'P001',estado_historial:'Activo',esquema_vacunacion:{$elemMatch:{id_esquema:'EV001',estado:'Pendiente'}}},{$set:{'esquema_vacunacion.$.estado':'Aplicada','esquema_vacunacion.$.fecha_aplicacion':ISODate('2026-10-20T09:00:00Z'),'esquema_vacunacion.$.lote':'LOTE-DEMO-01','esquema_vacunacion.$.id_medico':'M001'}});
if(aplicada.modifiedCount) registrar('APLICAR_VACUNA');
// 6. Consultas de lectura.
print('=== Historial completo ===');printjson(p.pacientes.findOne({id_paciente:'P001'}));
print('=== Evolución de crecimiento por fecha ===');
printjson(p.pacientes.aggregate([{$match:{id_paciente:'P001'}},{$unwind:'$controles_crecimiento'},{$sort:{'controles_crecimiento.fecha':1}},{$project:{_id:0,control:'$controles_crecimiento'}}]).toArray());
print('=== Vacunas ===');printjson(p.pacientes.findOne({id_paciente:'P001'},{projection:{_id:0,esquema_vacunacion:1}}));
print('=== Bitácora ===');printjson(p.bitacora_acceso.find({id_paciente:'P001'}).sort({fecha_hora:-1}).toArray());
// Archivar historial es una acción separada y opcional en 03_archivar.js para poder probar las otras operaciones.
