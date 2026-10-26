import { Icon, StatusBadge } from '@plataforma/ui/index.js';

// Datos clave que el expediente odontológico mostrará bajo el nombre del paciente.
// Sin backend se presentan vacíos; al conectar, reemplazar «—» por los datos reales.
const DATOS_CLAVE = ['Fecha de nacimiento', 'Última consulta', 'Próxima cita', 'Estado del historial'];

// Encabezado del expediente (mismo patrón visual que Pediatría: .patient-header).
// Las acciones se muestran deshabilitadas: no existe una operación que ejecutar.
export default function EncabezadoExpediente({ id, vistaPrevia }) {
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
          <button type="button" className="btn btn-primary" disabled title="Disponible al conectar el backend"><Icon name="mas" size={16} />Nueva consulta</button>
          <button type="button" className="btn btn-danger" disabled title="Disponible al conectar el backend"><Icon name="archivo" size={16} />Archivar historial</button>
        </div>
      </div>
      <dl className="patient-facts">
        {DATOS_CLAVE.map(d => <div key={d}><dt>{d}</dt><dd>—<small>Sin datos</small></dd></div>)}
      </dl>
    </section>
  );
}
