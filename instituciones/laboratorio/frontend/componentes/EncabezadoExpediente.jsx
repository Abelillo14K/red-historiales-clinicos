import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Icon, StatusBadge } from '@plataforma/ui/index.js';
import { edad, fecha, fechaLocal } from '@plataforma/formato.js';

// Encabezado del expediente con los datos que se consultan primero.
// Sin historial.leer (recepción) el paciente llega sin solicitudes y solo se muestran datos generales.
export default function EncabezadoExpediente({ paciente: p }) {
  const { puede, enlace } = useModulo();
  const activo = p.estado_historial === 'Activo';
  const solicitudes = p.solicitudes;
  const pendientes = solicitudes?.filter(s => s.estado === 'Pendiente' || s.estado === 'En proceso').length;
  const ultima = solicitudes?.[0];
  return (
    <section className="card patient-header" aria-labelledby="titulo-paciente">
      <div className="patient-main">
        <div className="patient-id">
          <div className="avatar" aria-hidden="true">{p.nombres[0]}{p.apellidos[0]}</div>
          <div>
            <h1 id="titulo-paciente">{p.nombres} {p.apellidos}</h1>
            <div className="page-meta">
              <span>Expediente <code>{p.id_paciente}</code></span>
              <span>{p.sexo === 'F' ? 'Femenino' : 'Masculino'}</span>
              <span aria-hidden="true">·</span>
              <span>{edad(p.fecha_nacimiento)}</span>
              <StatusBadge>{p.estado_historial}</StatusBadge>
            </div>
          </div>
        </div>
        <div className="actions">
          {activo && puede('historial.archivar') && <Link className="btn btn-danger" to={enlace(`/pacientes/${p.id_paciente}/archivar`)}><Icon name="archivo" size={16} />Archivar historial</Link>}
          {activo && puede('laboratorio.solicitudes.crear') && <Link className="btn btn-primary" to={enlace(`/solicitudes/nueva?paciente=${p.id_paciente}`)}><Icon name="mas" size={16} />Nueva solicitud</Link>}
        </div>
      </div>
      <dl className="patient-facts">
        <div><dt>Documento</dt><dd>{p.documento_identidad || '—'}<small>Nacimiento {fecha(p.fecha_nacimiento)}</small></dd></div>
        {solicitudes && <>
          <div><dt>Solicitudes en curso</dt><dd>{pendientes}<small>{solicitudes.length} en total</small></dd></div>
          <div><dt>Última solicitud</dt><dd>{ultima ? <>{fechaLocal(ultima.fecha_solicitud)}<small>{ultima.examenes.map(e => e.tipo_examen).join(', ')}</small></> : 'Sin solicitudes'}</dd></div>
        </>}
        <div><dt>Registro</dt><dd>{fechaLocal(p.fecha_registro)}<small>{p.telefono || p.correo || 'Sin contacto'}</small></dd></div>
      </dl>
    </section>
  );
}
