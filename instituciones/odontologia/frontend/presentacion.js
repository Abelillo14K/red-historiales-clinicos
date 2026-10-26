// Presentación de Clínica Odontológica en el portal de instituciones: nombre, sigla, descripción e
// icono. La reutiliza su manifiesto (modulo.js), así que hay un solo lugar para estos datos.
// Sin identificador de institución ni páginas: el portal carga este archivo también en
// producción, aunque el módulo no esté conectado (apps/web/src/plataforma/portal/).
export default {
  nombre: 'Clínica Odontológica',
  sigla: 'CO',
  descripcion: 'Expedientes odontológicos, citas, tratamientos y espacio para piezas dentales',
  icono: 'diente',
  orden: 3
};
