import { useSesion } from '../sesion/SesionContext.jsx';
import { Icon } from '../ui/index.js';

// Institución autorizada por el BACKEND para la sesión actual. No es un selector:
// si en el futuro un usuario tiene varias instituciones autorizadas, el cambio
// deberá pedir al servidor un token de la otra institución (docs/GUIA_INTEGRACION_EQUIPO.md).
export default function InstitutionIndicator() {
  const { sesion, modulo } = useSesion();
  return (
    <div className="institution-chip" title="Institución asignada por el servidor a esta sesión">
      <Icon name="institucion" size={16} />
      <span className="sr-only">Institución:</span>
      <span>{sesion.institucion_nombre || modulo.nombre}</span>
    </div>
  );
}
