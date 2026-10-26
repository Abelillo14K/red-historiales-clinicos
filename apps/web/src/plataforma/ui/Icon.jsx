// Iconos de trazo (24x24) propios de la plataforma: sin dependencias externas.
const PATHS = {
  panel: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
  pacientes: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  vacuna: 'M18 2l4 4M17 7l3-3M19 9l-8.5 8.5-5 1 1-5L15 5zM9 11l4 4M2 22l4.5-4.5',
  medico: 'M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4M20 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  archivo: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  auditoria: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  vacio: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  buscar: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  menu: 'M3 12h18M3 6h18M3 18h18',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  cerrar: 'M18 6L6 18M6 6l12 12',
  mas: 'M12 5v14M5 12h14',
  institucion: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M10 10h4',
  chevron: 'M9 18l6-6-6-6',
  abajo: 'M6 9l6 6 6-6',
  consulta: 'M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h4',
  crecimiento: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  receta: 'M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7',
  calendario: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18',
  alerta: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  ok: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3',
  luna: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  monitor: 'M2 4h20v13H2zM8 21h8M12 17v4',
  llave: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  codigo: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  contraer: 'M11 17l-5-5 5-5M18 17l-5-5 5-5',
  derecha: 'M5 12h14M13 6l6 6-6 6',
  izquierda: 'M19 12H5M11 18l-6-6 6-6',
  pediatria: 'M12 21a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 4.5c0-1.2.9-2 2-2M9.2 11.5h.01M14.8 11.5h.01M9.5 15.2a3.6 3.6 0 0 0 5 0',
  reloj: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  usuario: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  diagnostico: 'M22 12h-4l-3 9L9 3l-3 9H2',
  enchufe: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4',
  hospital: 'M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M10 21v-4h4v4M12 7v6M9 10h6',
  diente: 'M12 5.5C10.5 4 8.6 3 6.8 3.4 4.4 4 3.5 6.6 4.2 9.2c.5 1.9 1 3.4 1.4 5.6.4 2.4.9 6.2 2.5 6.2 1.5 0 1.6-3.3 2.3-5.3.3-.9.9-1.2 1.6-1.2s1.3.3 1.6 1.2c.7 2 .8 5.3 2.3 5.3 1.6 0 2.1-3.8 2.5-6.2.4-2.2.9-3.7 1.4-5.6.7-2.6-.2-5.2-2.6-5.8-1.8-.4-3.7.6-5.2 2.1z',
  matraz: 'M9 3h6M10 3v6.5L4.5 19A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2L14 9.5V3M7.5 15h9',
  resultado: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h2M8 17h2M13 13h3M13 17h3',
  ojo: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  telefono: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z'
};

export function Icon({ name, title, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" className="icon" width={size} height={size} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
      focusable="false">
      {title && <title>{title}</title>}
      <path d={PATHS[name] || PATHS.info} />
    </svg>
  );
}
