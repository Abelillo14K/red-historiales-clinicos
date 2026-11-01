import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { EncabezadoExpedienteVistaPrevia, Icon } from '@plataforma/ui/index.js';

export default function EncabezadoExpediente({ id, vistaPrevia }) {
  const { enlace } = useModulo();
  const base = `/pacientes/${encodeURIComponent(id)}`;
  return <EncabezadoExpedienteVistaPrevia id={id} vistaPrevia={vistaPrevia} icono="diente"
    datosClave={['Edad y sexo', 'Última consulta', 'Tratamiento en curso', 'Próxima cita']}
    acciones={<>
      <Link className="btn" to={enlace(`${base}/archivar`)}>Ver diseño de archivado</Link>
      <Link className="btn btn-primary" to={enlace(`${base}/consultas/nueva`)}><Icon name="mas" size={16} />Ver diseño de consulta</Link>
    </>} />;
}
