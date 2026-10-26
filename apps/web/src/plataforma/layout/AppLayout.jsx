import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

// Preferencia local (solo presentación): menú lateral contraído en escritorio.
const CLAVE_MENU = 'plataforma.menu_contraido';
const leerContraido = () => { try { return localStorage.getItem(CLAVE_MENU) === '1'; } catch { return false; } };

// Estructura común de la plataforma: navegación lateral, encabezado global y contenido.
// encabezadoFin: contenido del extremo derecho del encabezado (por defecto, institución y
// menú de usuario de la sesión; la vista previa de desarrollo pasa sus propios controles).
export default function AppLayout({ children, encabezadoFin }) {
  const [menu, setMenu] = useState(false);
  const [contraida, setContraida] = useState(leerContraido);
  const { pathname } = useLocation();
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return undefined;
    const escape = e => e.key === 'Escape' && setMenu(false);
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [menu]);
  useEffect(() => { try { localStorage.setItem(CLAVE_MENU, contraida ? '1' : '0'); } catch { /* sin almacenamiento */ } }, [contraida]);

  return (
    <div className={`app${menu ? ' menu-open' : ''}${contraida ? ' sidebar-collapsed' : ''}`}>
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <Sidebar id="navegacion-principal" contraida={contraida} onContraer={() => setContraida(c => !c)} />
      {menu && <div className="backdrop" onClick={() => setMenu(false)} aria-hidden="true" />}
      <div className="main">
        <Header menuAbierto={menu} onMenu={() => setMenu(true)} sidebarId="navegacion-principal" fin={encabezadoFin} />
        <main id="contenido" className="content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
