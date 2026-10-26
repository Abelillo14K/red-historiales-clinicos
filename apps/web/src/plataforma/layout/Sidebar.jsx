import { Link, NavLink } from 'react-router-dom';
import { useModulo } from '../modulos/ModuloContext.jsx';
import { NOMBRE_PLATAFORMA } from '../modulos/registro.js';
import { RUTA_PORTAL } from '../portal/portal.js';
import { Icon } from '../ui/index.js';

export function Logo() {
  return <span className="brand-logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" /></svg></span>;
}

// Navegación lateral: solo las entradas del módulo activo que los permisos de la
// sesión (informados por el backend) permiten ver (navegacionPara en contrato.js). Contraída (escritorio) muestra
// solo iconos; el texto se conserva para lectores de pantalla y como información emergente.
export default function Sidebar({ id, contraida, onContraer }) {
  const { modulo, puede, enlace } = useModulo();
  let grupoPrevio;
  return (
    <aside className="sidebar" id={id} aria-label="Navegación principal">
      <NavLink to={enlace('/')} className="brand" title={contraida ? NOMBRE_PLATAFORMA : undefined}>
        <Logo />
        <span><b>{NOMBRE_PLATAFORMA}</b><small>Historiales clínicos</small></span>
      </NavLink>
      <div className="sidebar-institution" title={contraida ? modulo.nombre : undefined}>
        <span className="inst-mark" aria-hidden="true">{modulo.sigla}</span>
        <span><small>Institución</small><b>{modulo.nombre}</b></span>
      </div>
      {/* Regreso al portal: solo navegación, conserva la sesión y el tema. */}
      <Link to={RUTA_PORTAL} className="sidebar-portal" title={contraida ? 'Volver a instituciones' : undefined}>
        <Icon name="izquierda" /><span className="nav-label">Volver a instituciones</span>
      </Link>
      <nav className="nav" aria-label={`Secciones de ${modulo.nombre}`}>
        {(modulo.navegacion || []).filter(e => puede(e.permiso)).map(e => {
          const titulo = e.grupo && e.grupo !== grupoPrevio ? <div className="nav-title" key={`g-${e.grupo}`}>{e.grupo}</div> : null;
          grupoPrevio = e.grupo;
          return [titulo, (
            <NavLink key={e.to} to={enlace(e.to)} end={e.exacto} title={contraida ? e.etiqueta : undefined}>
              <Icon name={e.icono} /><span className="nav-label">{e.etiqueta}</span>
            </NavLink>
          )];
        })}
      </nav>
      <div className="sidebar-foot">
        <p className="sidebar-note">Proyecto académico · datos ficticios · el sistema no emite indicaciones clínicas</p>
        {onContraer && (
          <button type="button" className="collapse-btn" onClick={onContraer} aria-expanded={!contraida} aria-controls={id}
            aria-label={contraida ? 'Expandir menú lateral' : 'Contraer menú lateral'}>
            <Icon name="contraer" /><span>{contraida ? 'Expandir menú' : 'Contraer menú'}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
