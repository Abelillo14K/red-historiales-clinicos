// Punto de integración del Laboratorio Clínico con SU backend.
//
// ESTADO: sin operaciones. No se declaran llamadas a endpoints que todavía no existen;
// las páginas muestran el estado «pendiente de integración» mientras tanto.
//
// Cómo conectar (docs/FRONTEND_EQUIPO.md §5): declare cada operación sobre el cliente
// común `http` (agrega el token, cierra la sesión ante 401 y convierte los errores en
// ApiError { status, codigo, detalles }). Ejemplo, cuando la ruta ya exista:
//
//   import { seg } from '@plataforma/api/http.js';
//   export function crearApiLaboratorio({ get, post, put, patch }) {
//     const P = id => `/api/pacientes/${seg(id)}`;
//     return {
//       pacientes: { listar: params => get('/api/pacientes', params), crear: datos => post('/api/pacientes', datos) },
//       ...
//     };
//   }
//
// Operaciones comunes esperadas (rutas SUGERIDAS en docs/GUIA_INTEGRACION_EQUIPO.md §5.1;
// el backend del Laboratorio decide las definitivas y su persistencia interna):
//   pacientes.listar(params)      GET   /api/pacientes?q=&estado=&limite=&pagina=  → { items, total }
//   pacientes.crear(datos)        POST  /api/pacientes                             → 201 { id_paciente }
//   pacientes.obtener(id)         GET   /api/pacientes/:id
//   pacientes.archivar(id, m)     PATCH /api/pacientes/:id/archivar               { motivo_archivado }
//   consultas.listar(id)          GET   /api/pacientes/:id/consultas   (atenciones relacionadas, si el laboratorio las registra)
// Extensiones propias (propuesta, sin contrato todavía): solicitudes de examen y resultados.
// Los resultados NO tienen un esquema común: cada tipo de examen puede traer campos distintos
// (componentes/VisorResultado.jsx los presenta por tipo). Errores: formato común { error, codigo, detalles? }.
export function crearApiLaboratorio(http) { // eslint-disable-line no-unused-vars
  return {};
}
