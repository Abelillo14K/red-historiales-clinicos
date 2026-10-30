import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';

// Primitivas del mockup: comparten estructura visual, sin conocer modelos ni APIs.
export function SectionHeading({ numero, titulo, descripcion }) {
  return <div className="section-heading">
    <span className="section-number" aria-hidden="true">{numero}</span>
    <div><h2>{titulo}</h2>{descripcion && <p className="meta">{descripcion}</p>}</div>
  </div>;
}

export function FormSteps({ pasos }) {
  return <nav className="form-steps" aria-label="Secciones del formulario"><ol>
    {pasos.map((p, i) => <li key={p.id} className={p.completo ? 'complete' : undefined}>
      <a href={`#${p.id}`}><span aria-hidden="true">{p.completo ? '✓' : i + 1}</span>{p.titulo}
        {p.completo && <span className="sr-only">: completo</span>}</a>
    </li>)}
  </ol></nav>;
}

export function FormSummary({ titulo = 'Resumen', items = [], children }) {
  return <aside className="form-summary mockup-dark" aria-label={titulo}>
    <h2>{titulo}</h2>
    {items.length > 0 && <dl>{items.map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}</dl>}
    {children}
  </aside>;
}

export function PatientCallout({ to }) {
  return <section className="patient-callout mockup-dark" aria-label="Registrar un paciente nuevo">
    <span className="callout-icon" aria-hidden="true"><Icon name="mas" size={26} /></span>
    <div><h2>¿No aparece la persona?</h2><p>Regístrala como paciente nuevo y el sistema le asignará su expediente.</p></div>
    <Link className="btn" to={to} aria-label="Crear un expediente nuevo">Registrar paciente<Icon name="derecha" size={16} /></Link>
  </section>;
}
