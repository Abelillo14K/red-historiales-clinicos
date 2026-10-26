import { Link } from 'react-router-dom';
import { Icon } from '../ui/index.js';
import { buscarPorCarpeta, esEquipoLocal } from './catalogo.js';

// Acción «Ver diseño» de una tarjeta pendiente del portal. Solo existe en desarrollo
// (Portal.jsx la carga con import.meta.env.DEV) y abre la vista previa ya existente:
// sin sesión, sin api y sin guardar (VistaPrevia.jsx).
export default function AccionVistaPrevia({ carpeta, nombre }) {
  const item = buscarPorCarpeta(carpeta);
  if (!item || item.error || item.conectado) return null;
  if (!esEquipoLocal()) return <p className="portal-card-note">El diseño solo se revisa desde el equipo local.</p>;
  return (
    <>
      <Link className="btn portal-cta" to={`/vista-previa/${item.modulo.institucion}`}>
        <Icon name="ojo" size={16} />Ver diseño<span className="sr-only"> de {nombre}</span>
      </Link>
      <p className="portal-card-note">Interfaz sin backend · solo desarrollo</p>
    </>
  );
}
