// Utilidades de presentación propias del laboratorio (sin React).

// Tono visual de los estados del laboratorio (StatusBadge acepta `tono`).
export const TONO_ESTADO = {
  Pendiente: 'info', 'En proceso': 'warn', Completada: 'ok', Anulada: 'bad',
  'Muestra tomada': 'info', Procesando: 'warn', 'Resultado listo': 'ok',
  Preliminar: 'warn', Validado: 'ok', Urgente: 'bad', Rutina: 'info'
};

// Rango o texto de referencia de un parámetro del catálogo.
export function referencia(p) {
  if (!p) return '—';
  if (p.valor_ref_texto) return p.valor_ref_texto;
  const u = p.unidad_medida ? ` ${p.unidad_medida}` : '';
  if (p.valor_ref_min != null && p.valor_ref_max != null) return `${p.valor_ref_min} – ${p.valor_ref_max}${u}`;
  if (p.valor_ref_min != null) return `≥ ${p.valor_ref_min}${u}`;
  if (p.valor_ref_max != null) return `≤ ${p.valor_ref_max}${u}`;
  return '—';
}

export const valorDe = d => (d ? (d.valor_numerico ?? d.valor_texto ?? '—') : '—');
