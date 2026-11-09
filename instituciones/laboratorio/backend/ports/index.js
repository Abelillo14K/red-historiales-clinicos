'use strict';
// Puertos (contratos de persistencia) del laboratorio. La capa de aplicación solo conoce estos
// métodos; el adaptador PostgreSQL y el doble en memoria de las pruebas los implementan igual.
// Los identificadores viajan como texto. { bloquear: true } pide bloquear la fila hasta el fin de la transacción.
const PUERTOS = {
  PacienteRepository: [
    'crear',          // (datos) -> id_paciente; documento repetido -> conflicto
    'obtener',        // (id, {bloquear}?) -> paciente|null
    'listar',         // ({texto, estado, limite, saltar}) -> {items, total}
    'archivar',       // (id, {motivo_archivado, fecha_archivado}) -> bool (solo si Activo)
    'resumen'         // () -> {pacientes_activos, pacientes_archivados}
  ],
  SolicitudRepository: [
    'crear',              // (solicitud, examenes) -> id_solicitud; código de muestra repetido -> conflicto
    'obtener',            // (id) -> solicitud con examenes[] y sus resultados|null
    'listar',             // ({estado, limite, saltar}) -> {items, total}
    'dePaciente',         // (idPaciente) -> solicitudes con examenes[] y resultados, más reciente primero
    'cambiarEstadoExamen', // (idExamen, estado) -> [estados de todos los exámenes de su solicitud]
    'cambiarEstado',      // (idSolicitud, estado) -> void
    'resumen'             // () -> {pendientes, en_proceso, completadas}
  ],
  ResultadoRepository: [
    'contexto',   // ({id_examen}|{id_resultado}, {bloquear}?) -> {id_examen, id_solicitud, estado_solicitud,
                  //   id_paciente, estado_historial, tipo_examen, parametros[], resultado|null}|null
    'guardar',    // (idExamen, {fecha_analisis, observaciones}, detalles[]) -> id_resultado (crea o actualiza el preliminar)
    'validar',    // (idResultado, {id_personal_valida, fecha_emision}) -> bool (solo si Preliminar)
    'obtener',    // (id) -> resultado con paciente, examen, parámetros y valores|null
    'listar'      // ({estado, limite, saltar}) -> {items, total}
  ],
  CatalogoRepository: [
    'tiposMuestra', 'crearTipoMuestra',
    'parametros', 'crearParametro',
    'tiposExamen', 'obtenerTipoExamen', 'crearTipoExamen', // crearTipoExamen(tipo, parametros[]) -> id
    'medicos', 'obtenerMedico', 'crearMedico',
    'personal', 'personalPorUsuario', 'crearPersonal'
  ],
  CuentaRepository: [
    'obtener',              // (usuario) -> {usuario, rol, hash_contrasena, activo}|null
    'crear',                // ({usuario, rol, hash_contrasena}) -> void; usuario repetido -> conflicto
    'actualizarContrasena'  // (usuario, hash) -> void
  ],
  AuditoriaRepository: ['registrar', 'listar'],
  // ejecutar(fn): llama fn(repos) con repositorios ligados a una transacción; confirma si fn termina, revierte si lanza.
  UnidadDeTrabajo: ['ejecutar']
};

const REPOSITORIOS = {
  pacientes: 'PacienteRepository', solicitudes: 'SolicitudRepository', resultados: 'ResultadoRepository',
  catalogos: 'CatalogoRepository', cuentas: 'CuentaRepository', auditoria: 'AuditoriaRepository'
};

function verificarPuerto(nombre, implementacion) {
  const faltantes = PUERTOS[nombre].filter(m => typeof implementacion?.[m] !== 'function');
  if (faltantes.length) throw new Error(`${nombre} incompleto: faltan ${faltantes.join(', ')}`);
  return implementacion;
}

function verificarRepositorios(repos) {
  for (const [clave, puerto] of Object.entries(REPOSITORIOS)) verificarPuerto(puerto, repos[clave]);
  verificarPuerto('UnidadDeTrabajo', repos.unidad);
  return repos;
}

module.exports = { PUERTOS, REPOSITORIOS, verificarPuerto, verificarRepositorios };
