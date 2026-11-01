import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { EncabezadoExpedienteVistaPrevia, Icon } from '@plataforma/ui/index.js';

export default function EncabezadoExpediente({ id, vistaPrevia }) {
  const { enlace } = useModulo();
  return <EncabezadoExpedienteVistaPrevia id={id} vistaPrevia={vistaPrevia} icono="matraz"
    datosClave={['Edad y sexo', 'Solicitudes pendientes', 'Último resultado', 'Estado del historial']}
    acciones={<>
      <Link className="btn" to={enlace(`/pacientes/${encodeURIComponent(id)}/archivar`)}>Ver diseño de archivado</Link>
      <Link className="btn btn-primary" to={enlace(`/solicitudes/nueva?paciente=${encodeURIComponent(id)}`)}><Icon name="mas" size={16} />Ver diseño de solicitud</Link>
    </>} />;
}
