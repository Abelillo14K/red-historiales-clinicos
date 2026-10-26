import { useId } from 'react';
import { Campo } from '@plataforma/ui/index.js';

export const tutorVacio = (principal = false) => ({ dpi: '', nombres: '', apellidos: '', parentesco: '', telefono: '', correo: '', direccion: '', es_principal: principal });

export function validarTutor(t) {
  const e = {};
  for (const c of ['dpi', 'nombres', 'apellidos', 'parentesco']) if (!t[c]?.trim()) e[c] = 'Obligatorio';
  if (t.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.correo)) e.correo = 'Correo no válido';
  return e;
}

// Convierte el formulario al contrato de la API (sin cadenas vacías).
export function tutorParaApi(t) {
  const r = { dpi: t.dpi.trim(), nombres: t.nombres.trim(), apellidos: t.apellidos.trim(), parentesco: t.parentesco.trim(), es_principal: !!t.es_principal };
  for (const c of ['telefono', 'correo', 'direccion']) if (t[c]?.trim()) r[c] = t[c].trim();
  return r;
}

export default function TutorCampos({ valor, errores = {}, onChange, mostrarPrincipal = true }) {
  const lista = useId();
  const set = c => e => onChange({ ...valor, [c]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const input = (c, label, extra = {}) => (
    <Campo label={label} error={errores[c]} required={['dpi', 'nombres', 'apellidos', 'parentesco'].includes(c)} full={extra.full}>
      {p => <input {...p} value={valor[c] ?? ''} onChange={set(c)} maxLength={255} {...extra.attrs} />}
    </Campo>
  );
  return (
    <div className="form-grid">
      {input('nombres', 'Nombres')}
      {input('apellidos', 'Apellidos')}
      {input('dpi', 'DPI', { attrs: { inputMode: 'numeric', autoComplete: 'off' } })}
      <Campo label="Parentesco" error={errores.parentesco} required>
        {p => <input {...p} list={lista} value={valor.parentesco} onChange={set('parentesco')} maxLength={60} />}
      </Campo>
      {input('telefono', 'Teléfono', { attrs: { type: 'tel', autoComplete: 'off' } })}
      {input('correo', 'Correo electrónico', { attrs: { type: 'email', autoComplete: 'off' } })}
      {input('direccion', 'Dirección', { full: true })}
      {mostrarPrincipal && (
        <label className="check field full"><input type="checkbox" checked={!!valor.es_principal} onChange={set('es_principal')} /> Responsable principal</label>
      )}
      <datalist id={lista}><option value="Madre" /><option value="Padre" /><option value="Abuela" /><option value="Abuelo" /><option value="Tutor legal" /></datalist>
    </div>
  );
}
