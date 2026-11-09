import { z } from 'zod';
import { ApiError } from './errores.js';

export function validar(esquema, datos) {
  const r = esquema.safeParse(datos);
  if (!r.success) {
    throw new ApiError(400, 'VALIDACION', 'Datos inválidos',
      r.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })));
  }
  return r.data;
}

export const idParam = (v, nombre = 'id') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'VALIDACION', `${nombre} inválido`);
  return n;
};

// Texto opcional: '' / undefined / null → null
export const txt = (max = 255) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
export const txtReq = (max = 255) => z.string().trim().min(1, 'Requerido').max(max);
// Número opcional: '' / undefined / null → null
export const num = () => z.preprocess(v => (v === '' || v == null ? null : Number(v)), z.number().finite().nullable());
export const entero = () => z.preprocess(v => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive());
export const fecha = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD');
export const fechaOpc = () => z.preprocess(v => (v === '' ? null : v), fecha().nullish().transform(v => v || null));

// "2026-11-08T10:30" (datetime-local) → "2026-11-08 10:30:00"
export function fechaHora(v) {
  const s = String(v).replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) throw new ApiError(400, 'VALIDACION', 'Fecha y hora inválida');
  return s.length === 16 ? `${s}:00` : s;
}

export function paginacion(query, maxLimite = 100) {
  const limite = Math.min(Math.max(parseInt(query.limite, 10) || 20, 1), maxLimite);
  const pagina = Math.max(parseInt(query.pagina, 10) || 1, 1);
  return { limite, desplazamiento: (pagina - 1) * limite, pagina };
}

export const NOMBRE_PACIENTE = `CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)`;
export const NOMBRE_MEDICO = (a = 'm') => `CONCAT_WS(' ', ${a}.primer_nombre, ${a}.segundo_nombre, ${a}.primer_apellido, ${a}.segundo_apellido)`;
