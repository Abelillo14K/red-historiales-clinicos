import { useRef } from 'react';
import { Icon } from './Icon.jsx';

// Encabezado de página: título, descripción, metadatos y acciones.
export function PageHeader({ titulo, descripcion, acciones, children, antes }) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {antes}
        <div>
          <h1>{titulo}</h1>
          {descripcion && <p className="page-desc">{descripcion}</p>}
          {children}
        </div>
      </div>
      {acciones && <div className="actions">{acciones}</div>}
    </div>
  );
}

// Tarjeta con encabezado opcional.
export function Card({ titulo, acciones, children, className = '', id, descripcion, icono }) {
  return (
    <section id={id} className={`card ${className}`} aria-labelledby={titulo && id ? `${id}-t` : undefined}>
      {(titulo || acciones) && (
        <div className="card-head">
          <div>
            {titulo && <h2 className={icono ? 'card-heading-icon' : undefined} id={id ? `${id}-t` : undefined}>{icono && <span aria-hidden="true"><Icon name={icono} size={18} /></span>}{titulo}</h2>}
            {descripcion && <p className="meta">{descripcion}</p>}
          </div>
          {acciones && <div className="actions">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Pestañas accesibles (patrón WAI-ARIA tablist con flechas izquierda/derecha).
export function Tabs({ pestanas, actual, onCambiar, etiqueta }) {
  const ref = useRef(null);
  function teclado(e, i) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + pestanas.length) % pestanas.length;
    onCambiar(pestanas[j].clave);
    ref.current?.querySelectorAll('[role="tab"]')[j]?.focus();
  }
  return (
    <div className="tabs" role="tablist" aria-label={etiqueta} ref={ref}>
      {pestanas.map((p, i) => (
        <button key={p.clave} type="button" role="tab" aria-selected={p.clave === actual} tabIndex={p.clave === actual ? 0 : -1}
          onClick={() => onCambiar(p.clave)} onKeyDown={e => teclado(e, i)}>
          {p.titulo}{p.cuenta !== undefined && <span className="tab-count">{p.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}
