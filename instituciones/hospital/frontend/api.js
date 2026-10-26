// Punto de integración del Hospital General con SU backend.
//
// ESTADO: sin operaciones. No se declaran llamadas a endpoints que todavía no existen;
// las páginas muestran el estado «pendiente de integración» mientras tanto.
//
// Cómo conectar (docs/FRONTEND_EQUIPO.md §5): declare cada operación sobre el cliente
// común `http` (agrega el token, cierra la sesión ante 401 y convierte los errores en
// ApiError { status, codigo, detalles }). Ejemplo, cuando la ruta ya exista:
//
//   import { seg } from '@plataforma/api/http.js';
//   export function crearApiHospital({ get, post, put, patch }) {
//     const P = id => `/api/pacientes/${seg(id)}`;
//     return {
//       pacientes: { listar: params => get('/api/pacientes', params), crear: datos => post('/api/pacientes', datos) },
//       ...
//     };
//   }
//
// Operaciones comunes esperadas (rutas SUGERIDAS en docs/GUIA_INTEGRACION_EQUIPO.md §5.1;
// el backend del Hospital decide las definitivas y su persistencia interna):
//   pacientes.listar(params)      GET   /api/pacientes?q=&estado=&limite=&pagina=  → { items, total }
//   pacientes.crear(datos)        POST  /api/pacientes                             → 201 { id_paciente }
//   pacientes.obtener(id)         GET   /api/pacientes/:id
//   pacientes.archivar(id, m)     PATCH /api/pacientes/:id/archivar               { motivo_archivado }
//   consultas.listar(id)          GET   /api/pacientes/:id/consultas
//   consultas.crear(id, datos)    POST  /api/pacientes/:id/consultas               → 201 { id_consulta }
//   consultas.agregarDiagnostico  POST  …/consultas/:c/diagnosticos               { codigo, descripcion }
//   consultas.establecerTratamiento PUT …/consultas/:c/tratamiento                { descripcion, recomendaciones? }
//   consultas.agregarPrescripcion POST  …/consultas/:c/prescripciones             { medicamentos: [...] }
//   consultas.prescripciones(id)  GET   /api/pacientes/:id/prescripciones
// Extensiones propias (propuesta): citas. Errores: formato común { error, codigo, detalles? }.
export function crearApiHospital(http) { // eslint-disable-line no-unused-vars
  return {};
}
