import { Icon, StatusBadge } from '@plataforma/ui/index.js';
import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';

// Datos clave que el expediente del Hospital mostrará bajo el nombre del paciente.
// Sin backend se presentan vacíos; al conectar, reemplazar «—» por los datos reales.
const DATOS_CLAVE = ['Edad y sexo', 'Tipo de sangre', 'Alergias', 'Próxima cita'];

// Encabezado del expediente (mismo patrón visual que Pediatría: .patient-header).
// Las acciones se muestran deshabilitadas: no existe una operación que ejecutar.
export default function EncabezadoExpediente({ id, vistaPrevia }) {
  const { enlace } = useModulo();
  return (
    <section className="card patient-header" aria-labelledby="titulo-expediente">
      <div className="patient-main">
        <div className="patient-id">
          <div className="avatar" aria-hidden="true"><Icon name="usuario" size={24} /></div>
          <div>
            <h1 id="titulo-expediente">{vistaPrevia ? 'Expediente clínico' : `Expediente ${id}`}</h1>
            <div className="page-meta">
              {vistaPrevia ? <span>Estructura sin paciente</span> : <code>{id}</code>}
              <StatusBadge tono="info">Pendiente de integración</StatusBadge>
            </div>
          </div>
        </div>
        <div className="actions">
          <Link className="btn" to={enlace(`/pacientes/${encodeURIComponent(id)}/archivar`)}>Ver diseño de archivado</Link>
          <Link className="btn btn-primary" to={enlace(`/pacientes/${encodeURIComponent(id)}/consultas/nueva`)}><Icon name="mas" size={16} />Ver diseño de consulta</Link>
        </div>
      </div>
      <dl className="patient-facts">
        {DATOS_CLAVE.map(d => <div key={d}><dt>{d}</dt><dd>—<small>Sin datos</small></dd></div>)}
      </dl>
    </section>
  );
}
