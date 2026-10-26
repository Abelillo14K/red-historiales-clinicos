// Presentación de Hospital General en el portal de instituciones: nombre, sigla, descripción e
// icono. La reutiliza su manifiesto (modulo.js), así que hay un solo lugar para estos datos.
// Sin identificador de institución ni páginas: el portal carga este archivo también en
// producción, aunque el módulo no esté conectado (apps/web/src/plataforma/portal/).
export default {
  nombre: 'Hospital General',
  sigla: 'HG',
  descripcion: 'Expedientes clínicos, consultas, diagnósticos, tratamientos y citas',
  icono: 'hospital',
  orden: 2
};
