// Presentaciones de todas las instituciones (instituciones/<carpeta>/frontend/presentacion.js),
// descubiertas por Vite. Solo trae nombre, sigla, descripción e icono: ni identificadores
// ni páginas de los módulos sin conectar, así que puede formar parte de la compilación de producción.
const archivos = import.meta.glob('@instituciones/*/frontend/presentacion.js', { eager: true, import: 'default' });

export const presentaciones = Object.entries(archivos).map(([ruta, p]) => ({ carpeta: ruta.split('/').at(-3), ...p }));
