import { Link } from 'react-router-dom';
import { useModulo } from '../modulos/ModuloContext.jsx';
import { Icon } from '../ui/index.js';
import Breadcrumbs from './Breadcrumbs.jsx';
import InstitutionIndicator from './InstitutionIndicator.jsx';
import UserMenu from './UserMenu.jsx';

// Encabezado global: menú (móvil), migas de pan, acción rápida del módulo,
// institución de la sesión y menú de usuario.
export default function Header({ menuAbierto, onMenu, sidebarId, fin }) {
  const { modulo, puede, enlace } = useModulo();
  const accion = modulo.accionRapida && puede(modulo.accionRapida.permiso) ? modulo.accionRapida : null;
  return (
    <header className="header">
      <button type="button" className="icon-btn menu-btn" aria-label="Abrir menú" aria-expanded={menuAbierto} aria-controls={sidebarId} onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <Breadcrumbs />
      <div className="header-end">
        {accion && <Link className="btn btn-primary btn-sm header-action" to={enlace(accion.to)}><Icon name="mas" size={16} /><span>{accion.etiqueta}</span></Link>}
        {fin || <>
          <InstitutionIndicator />
          <span className="header-divider" aria-hidden="true" />
          <UserMenu />
        </>}
      </div>
    </header>
  );
}
