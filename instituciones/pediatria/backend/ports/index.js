'use strict';
// Puertos (contratos de persistencia) de la arquitectura hexagonal.
// La capa de aplicación solo conoce estos métodos; cualquier adaptador
// (MongoDB, memoria para pruebas u otro motor del proyecto compartido)
// debe implementarlos con la misma semántica.
//
// Convención: los métodos de mutación condicional devuelven `true` si el
// cambio se aplicó y `false` si no se cumplió la condición (paciente
// inexistente/archivado, identificador repetido, dosis no pendiente...).
// Cada mutación debe ser atómica sobre el historial del paciente.
const PUERTOS = {
  PacienteRepository: [
    'crear',               // (paciente) -> void; lanza conflicto si el id existe
    'siguienteId',         // () -> 'P###'
    'buscarDuplicado',     // ({nombres, apellidos, fecha_nacimiento}, excluirId?) -> paciente|null
    'listar',              // ({texto, estado, sexo, limite, saltar, buscarDpi}) -> {items, total}
    'obtener',             // (id) -> historial completo|null
    'obtenerAdministrativo', // (id) -> datos sin información clínica|null
    'actualizarDatos',     // (id, campos, identidadPrevia?) -> bool; compara identidad previa y fechas clínicas atómicamente
    'reemplazarTutores',   // (id, tutoresPrevios, tutoresNuevos) -> bool (concurrencia optimista)
    'agregarConsulta',     // (id, consulta, control|null) -> bool; fecha >= nacimiento vigente
    'agregarDiagnostico',  // (id, idConsulta, diagnostico) -> bool
    'establecerTratamiento', // (id, idConsulta, nuevo, previo|null, datosReemplazo) -> bool; conserva el previo
    'agregarPrescripcion', // (id, idConsulta, prescripcion) -> bool
    'agregarControl',      // (id, control) -> bool (consulta existente y fecha >= nacimiento vigente)
    'programarDosis',      // (id, dosis) -> bool (sin misma vacuna+dosis vigente; fecha >= nacimiento)
    'aplicarDosis',        // (id, idEsquema, datos) -> bool (Pendiente y fecha >= nacimiento vigente)
    'cancelarDosis',       // (id, idEsquema, datos) -> bool (solo si Pendiente)
    'archivar',            // (id, datos) -> bool (solo si Activo)
    'resumen',             // () -> contadores para el panel
    'dosisPendientes'      // ({limite}) -> dosis pendientes de historiales activos
  ],
  MedicoRepository: ['listar', 'obtener', 'crear'],
  VacunaRepository: ['listar', 'obtener', 'crear'],
  AuditoriaRepository: ['registrar', 'listar'],
  // ejecutar(fn, evento): el evento de auditoría queda registrado si y solo si
  // fn confirma su escritura (transacción o outbox embebido, según el motor).
  // reenviarPendientes(): entrega eventos que quedaron pendientes por un fallo.
  UnidadDeTrabajo: ['ejecutar', 'soportaTransacciones', 'reenviarPendientes']
};

function verificarPuerto(nombre, implementacion) {
  const faltantes = PUERTOS[nombre].filter(m => typeof implementacion?.[m] !== 'function');
  if (faltantes.length) throw new Error(`${nombre} incompleto: faltan ${faltantes.join(', ')}`);
  return implementacion;
}

function verificarRepositorios(repos) {
  verificarPuerto('PacienteRepository', repos.pacientes);
  verificarPuerto('MedicoRepository', repos.medicos);
  verificarPuerto('VacunaRepository', repos.vacunas);
  verificarPuerto('AuditoriaRepository', repos.auditoria);
  verificarPuerto('UnidadDeTrabajo', repos.unidad);
  if (repos.capacidades !== undefined && typeof repos.capacidades !== 'function') throw new Error('capacidades debe ser una función async');
  return repos;
}

module.exports = { PUERTOS, verificarPuerto, verificarRepositorios };
