import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icon.jsx';

// Diálogo modal nativo (<dialog>): foco atrapado, Escape y fondo inerte por el navegador.
export function Dialogo({ abierto, titulo, descripcion, onCerrar, children, acciones, ancho }) {
  const ref = useRef(null);
  const tid = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} className={ancho ? 'wide' : undefined} onCancel={e => { e.preventDefault(); onCerrar?.(); }} aria-labelledby={titulo ? tid : undefined}>
      {abierto && <>
        <div className="dialog-head">
          <div>
            {titulo && <h2 id={tid}>{titulo}</h2>}
            {descripcion && <p className="meta">{descripcion}</p>}
          </div>
          {onCerrar && <button type="button" className="icon-btn" onClick={onCerrar} aria-label="Cerrar diálogo"><Icon name="cerrar" /></button>}
        </div>
        <div className="dialog-body">{children}</div>
        {acciones && <div className="dialog-actions">{acciones}</div>}
      </>}
    </dialog>
  );
}
