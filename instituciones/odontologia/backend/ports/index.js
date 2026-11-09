'use strict';
// Puertos (contratos de persistencia) de la clínica odontológica. La capa de aplicación solo conoce
// estos métodos; el adaptador Firestore y el doble en memoria de las pruebas los implementan igual.
// Dentro de una unidad de trabajo las lecturas ven el estado previo y las escrituras se aplican juntas
// al confirmar (como en una transacción de Firestore): no se lee lo que se acaba de escribir.
const PUERTOS = {
  PacienteRepository: [
    'siguienteId',        // () -> 'OD000001' (contador transaccional; solo en unidad de trabajo)
    'reservarDocumento',  // (documento, idPaciente) -> void; repetido -> conflicto (solo en unidad de trabajo)
    'crear',              // (paciente) -> void
    'obtener',            // (id) -> paciente|null
    'listar',             // ({texto, estado, limite, saltar}) -> {items, total}
    'actualizar',         // (id, cambios) -> void; 'piezas.16' actualiza solo esa pieza
    'resumen'             // () -> {pacientes_activos, pacientes_archivados}
  ],
  ConsultaRepository: [
    'nuevoId',            // () -> id para una consulta nueva
    'crear',              // (idPaciente, id, consulta) -> void
    'obtener',            // (idPaciente, idConsulta) -> consulta|null
    'listar',             // (idPaciente) -> consultas, más reciente primero
    'actualizar',         // (idPaciente, idConsulta, cambios) -> void
    'contar'              // () -> total de consultas de todos los pacientes
  ],
  CitaRepository: [
    'nuevoId', 'crear',   // (id, cita) -> void
    'obtener',            // (id) -> cita|null
    'listar',             // ({desde, hasta, estado, id_paciente, limite}) -> citas por fecha ascendente
    'actualizar'          // (id, cambios) -> void
  ],
  CatalogoRepository: ['odontologos', 'obtenerOdontologo', 'crearOdontologo', 'procedimientos', 'obtenerProcedimiento', 'crearProcedimiento'],
  CuentaRepository: [
    'obtener',              // (usuario) -> {usuario, rol, hash_contrasena, activo}|null
    'crear',                // ({usuario, rol, hash_contrasena, activo, creado}) -> void; repetido -> conflicto
    'actualizarContrasena'  // (usuario, hash) -> void
  ],
  AuditoriaRepository: ['registrar', 'listar'],
  // ejecutar(fn): fn(repos) con lecturas consistentes; si fn termina, todas sus escrituras se confirman juntas.
  UnidadDeTrabajo: ['ejecutar']
};

const REPOSITORIOS = {
  pacientes: 'PacienteRepository', consultas: 'ConsultaRepository', citas: 'CitaRepository',
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
