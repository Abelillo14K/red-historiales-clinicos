// Utilidades de formato comunes a todos los módulos. Las fechas se guardan en UTC (BSON Date) y se muestran en hora local.
const locale = 'es-GT';
export const fecha = v => (v ? new Date(v).toLocaleDateString(locale, { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—');
// Fechas sin hora (nacimiento, dosis programadas) se guardan a medianoche UTC: se muestran en UTC.
// Fechas con hora (consultas, controles, archivo) se muestran en la zona horaria local.
export const fechaLocal = v => (v ? new Date(v).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fechaHora = v => (v ? new Date(v).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export function edad(fechaNacimiento, referencia = new Date()) {
  if (!fechaNacimiento) return '—';
  const n = new Date(fechaNacimiento), r = new Date(referencia);
  let meses = (r.getUTCFullYear() - n.getUTCFullYear()) * 12 + (r.getUTCMonth() - n.getUTCMonth());
  if (r.getUTCDate() < n.getUTCDate()) meses -= 1;
  if (meses < 0) return '—';
  if (meses < 24) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const a = Math.floor(meses / 12), m = meses % 12;
  return `${a} años${m ? ` ${m} m` : ''}`;
}

// <input type="datetime-local"> trabaja en hora local sin zona; la API espera ISO 8601.
export const aIso = local => (local ? new Date(local).toISOString() : undefined);
export function localAhora(desplazamientoMin = 0) {
  const d = new Date(Date.now() + desplazamientoMin * 60000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
export const hoy = () => localAhora().slice(0, 10);

export const nombreCompleto = p => (p ? `${p.nombres} ${p.apellidos}` : '');
