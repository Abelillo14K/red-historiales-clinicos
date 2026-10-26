import { Link } from 'react-router-dom';
import { RUTA_PORTAL } from '../portal/portal.js';
import { useSesion } from '../sesion/SesionContext.jsx';
import { EmptyState } from '../ui/index.js';
import { NOMBRE_PLATAFORMA } from '../modulos/registro.js';

// La ruta existe en el módulo, pero los permisos de la sesión no la incluyen.
// Es solo información: el backend rechaza igualmente la operación (403).
export function SinPermiso() {
  return <EmptyState icono="auditoria" titulo="Sin permiso" accion={<Link className="btn" to="/">Volver al inicio</Link>}>
    Su rol no tiene acceso a esta sección.
  </EmptyState>;
}

// El backend aceptó la sesión, pero esta interfaz no tiene un módulo para esa institución.
export function InstitucionSinInterfaz({ resolucion }) {
  const { cerrarSesion } = useSesion();
  const texto = resolucion.estado === 'sesion_incompleta'
    ? 'El servidor no informó los permisos de la sesión, por lo que no se puede mostrar ninguna sección.'
    : `La institución «${resolucion.institucion}» todavía no tiene un módulo en ${NOMBRE_PLATAFORMA}.`;
  return (
    <div className="login-page">
      <div className="card login-card">
        <EmptyState icono="institucion" titulo="Institución no disponible en esta interfaz"
          accion={<>
            <Link className="btn" to={RUTA_PORTAL}>Volver a instituciones</Link>
            <button type="button" className="btn" onClick={() => cerrarSesion(null, true)}>Cerrar sesión</button>
          </>}>
          {texto}
        </EmptyState>
      </div>
    </div>
  );
}
