import { Link, useLocation } from 'react-router-dom';
import { useModulo } from '../modulos/ModuloContext.jsx';
import { migasPara } from '../modulos/contrato.js';
import { Icon } from '../ui/index.js';

// Migas de pan derivadas de los títulos que declara el módulo en su manifiesto.
export default function Breadcrumbs() {
  const { modulo, base, vistaPrevia, enlace } = useModulo();
  const { pathname } = useLocation();
  const migas = migasPara(modulo, pathname.slice(base.length) || '/', { vistaPrevia });
  return (
    <nav className="breadcrumbs" aria-label="Ruta de navegación">
      <ol>
        <li><Link to={enlace('/')} aria-current={migas.length ? undefined : 'page'}>Inicio</Link></li>
        {migas.map((m, i) => (
          <li key={m.to}>
            <Icon name="chevron" size={14} />
            {i === migas.length - 1 ? <span aria-current="page">{m.titulo}</span> : <Link to={enlace(m.to)}>{m.titulo}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
