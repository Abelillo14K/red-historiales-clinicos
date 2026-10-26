import { Campo } from '@plataforma/ui/index.js';

// El contenido clínico lo escribe el médico; el sistema no sugiere diagnósticos ni dosis.
export const medicamentoVacio = () => ({ nombre: '', dosis: '', frecuencia: '', duracion: '', via_administracion: '' });
export const diagnosticoVacio = () => ({ codigo: '', descripcion: '' });
const CAMPOS_MED = [['nombre', 'Medicamento'], ['dosis', 'Dosis'], ['frecuencia', 'Frecuencia'], ['duracion', 'Duración'], ['via_administracion', 'Vía de administración']];

export const recortar = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
export const medicamentoCompleto = m => CAMPOS_MED.every(([k]) => m[k]?.trim());
export const diagnosticoCompleto = d => d.codigo.trim() && d.descripcion.trim();
export const filaVacia = o => Object.values(o).every(v => !String(v).trim());

export function DiagnosticosEditor({ lista, onChange, error }) {
  const set = (i, c, v) => onChange(lista.map((d, j) => (j === i ? { ...d, [c]: v } : d)));
  return (
    <div className="sub-list">
      {error && <span className="error-text" role="alert">{error}</span>}
      {lista.map((d, i) => (
        <div className="sub-item" key={i}>
          <div className="form-grid dx">
            <Campo label="Código">{a => <input {...a} value={d.codigo} onChange={e => set(i, 'codigo', e.target.value)} maxLength={20} placeholder="p. ej. CIE-10" />}</Campo>
            <Campo label="Descripción">{a => <input {...a} value={d.descripcion} onChange={e => set(i, 'descripcion', e.target.value)} maxLength={255} />}</Campo>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(lista.filter((_, j) => j !== i))} aria-label={`Quitar diagnóstico ${i + 1}`}>Quitar</button>
          </div>
        </div>
      ))}
      <div><button type="button" className="btn btn-sm" disabled={lista.length >= 20} onClick={() => onChange([...lista, diagnosticoVacio()])}>Agregar diagnóstico</button></div>
    </div>
  );
}

export function MedicamentosEditor({ lista, onChange, error }) {
  const set = (i, c, v) => onChange(lista.map((m, j) => (j === i ? { ...m, [c]: v } : m)));
  return (
    <div className="sub-list">
      {error && <span className="error-text" role="alert">{error}</span>}
      {lista.map((m, i) => (
        <div className="sub-item" key={i}>
          <div className="sub-item-head">
            <h3>Medicamento {i + 1}</h3>
            {lista.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(lista.filter((_, j) => j !== i))}>Quitar</button>}
          </div>
          <div className="form-grid">
            {CAMPOS_MED.map(([k, l]) => (
              <Campo key={k} label={l} required>{a => <input {...a} value={m[k]} onChange={e => set(i, k, e.target.value)} maxLength={255} />}</Campo>
            ))}
          </div>
        </div>
      ))}
      <div><button type="button" className="btn btn-sm" disabled={lista.length >= 20} onClick={() => onChange([...lista, medicamentoVacio()])}>Agregar medicamento</button></div>
    </div>
  );
}

export function MedicoSelect({ medicos, value, onChange, error, label = 'Médico responsable' }) {
  return (
    <Campo label={label} error={error} required>
      {a => <select {...a} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Seleccione…</option>
        {medicos.map(m => <option key={m.id_medico} value={m.id_medico}>{m.nombres} {m.apellidos} — {m.especialidad?.nombre}</option>)}
      </select>}
    </Campo>
  );
}

// Mediciones de crecimiento. El perímetro cefálico es opcional ("si corresponde",
// Fase I) solo cuando el validador instalado en MongoDB lo permite.
export const LIMITES_MEDICION = { peso_kg: 250, talla_cm: 250, perimetro_cefalico_cm: 100 };
export function validarMedicion(v, perimetroOpcional) {
  const e = {};
  for (const [k, max] of Object.entries(LIMITES_MEDICION)) {
    if (k === 'perimetro_cefalico_cm' && perimetroOpcional && !String(v[k] ?? '').trim()) continue;
    const n = Number(v[k]);
    if (!String(v[k] ?? '').trim() || !(n > 0) || n > max) e[k] = `Valor mayor que 0 y hasta ${max}`;
  }
  return e;
}
export function medicionParaApi(v) {
  const m = { peso_kg: Number(v.peso_kg), talla_cm: Number(v.talla_cm) };
  if (String(v.perimetro_cefalico_cm ?? '').trim()) m.perimetro_cefalico_cm = Number(v.perimetro_cefalico_cm);
  return m;
}
