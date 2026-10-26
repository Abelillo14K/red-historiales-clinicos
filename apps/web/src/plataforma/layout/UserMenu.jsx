import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext.jsx';
import { TEMAS, useTema } from '../tema.js';
import { fechaHora } from '../formato.js';
import { Icon } from '../ui/index.js';
import { RUTA_PORTAL } from '../portal/portal.js';

const iniciales = t => String(t || '?').replace(/[^A-Za-z0-9]/g, ' ').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';

// Menú de usuario: identidad, rol, institución, expiración, tema, regreso al portal y
// cierre de sesión. También se muestra en el portal, donde todavía no hay módulo abierto.
export default function UserMenu() {
  const { sesion, rolEtiqueta, modulo, cerrarSesion } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useTema();
  const ref = useRef(null);
  const { pathname } = useLocation();
  const enPortal = pathname === RUTA_PORTAL;
  const menuId = useId();

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = e => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    const escape = e => { if (e.key === 'Escape') { setAbierto(false); ref.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', escape); };
  }, [abierto]);

  return (
    <div className="user-menu" ref={ref}
      onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setAbierto(false); }}>
      <button type="button" className="user-trigger" aria-haspopup="true" aria-expanded={abierto} aria-controls={menuId}
        onClick={() => setAbierto(a => !a)} aria-label={`Menú de usuario: ${sesion.usuario}, ${rolEtiqueta}`}>
        <span className="avatar sm" aria-hidden="true">{iniciales(sesion.usuario)}</span>
        <span className="user-trigger-text"><b>{sesion.usuario}</b><small>{rolEtiqueta}</small></span>
        <Icon name="abajo" size={16} />
      </button>
      {abierto && (
        <div className="user-panel" id={menuId}>
          <div className="user-panel-head">
            <span className="avatar" aria-hidden="true">{iniciales(sesion.usuario)}</span>
            <div><b>{sesion.usuario}</b><div className="meta">{rolEtiqueta} · {sesion.institucion_nombre || modulo?.nombre || sesion.institucion}</div></div>
          </div>
          <div className="meta user-panel-row">Sesión válida hasta {fechaHora(sesion.expira)}</div>
          <fieldset className="theme-picker">
            <legend>Tema</legend>
            {TEMAS.map(([k, t, icono]) => (
              <label key={k} className={tema === k ? 'active' : undefined}>
                <input type="radio" name="tema" value={k} checked={tema === k} onChange={() => setTema(k)} />
                <Icon name={icono} size={16} />{t}
              </label>
            ))}
          </fieldset>
          {!enPortal && <Link className="btn btn-block" to={RUTA_PORTAL}><Icon name="izquierda" /> Volver a instituciones</Link>}
          <button type="button" className="btn btn-block" onClick={() => cerrarSesion(null, true)}><Icon name="salir" /> Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}
