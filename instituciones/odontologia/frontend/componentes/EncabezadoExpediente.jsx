import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Icon, StatusBadge } from '@plataforma/ui/index.js';
import { edad, fecha, fechaHora, fechaLocal } from '@plataforma/formato.js';
import { sexo } from './formato.js';

// Encabezado del expediente con los datos que se consultan primero.
// Sin historial.leer (recepción) el paciente llega sin consultas ni antecedentes.
export default function EncabezadoExpediente({ paciente: p }) {
  const { puede, enlace } = useModulo();
  const activo = p.estado_historial === 'Activo';
  const proxima = (p.citas || []).find(c => c.estado === 'Programada' && new Date(c.fecha_hora) >= new Date());
  return (
    <section className="card patient-header" aria-labelledby="titulo-paciente">
      <div className="patient-main">
        <div className="patient-id">
          <div className="avatar" aria-hidden="true">{p.nombres[0]}{p.apellidos[0]}</div>
          <div>
            <h1 id="titulo-paciente">{p.nombres} {p.apellidos}</h1>
            <div className="page-meta">
              <span>Expediente <code>{p.id_paciente}</code></span>
              <span>{sexo(p.sexo)}</span>
              <span aria-hidden="true">·</span>
              <span>{edad(p.fecha_nacimiento)}</span>
              <StatusBadge>{p.estado_historial}</StatusBadge>
            </div>
          </div>
        </div>
        <div className="actions">
          {activo && puede('historial.archivar') && <Link className="btn btn-danger" to={enlace(`/pacientes/${p.id_paciente}/archivar`)}><Icon name="archivo" size={16} />Archivar historial</Link>}
          {activo && puede('clinico.escribir') && <Link className="btn btn-primary" to={enlace(`/pacientes/${p.id_paciente}/consultas/nueva`)}><Icon name="mas" size={16} />Nueva consulta</Link>}
        </div>
      </div>
      <dl className="patient-facts">
        <div><dt>Documento</dt><dd>{p.documento_identidad || '—'}<small>Nacimiento {fecha(p.fecha_nacimiento)}</small></dd></div>
        <div><dt>Consultas</dt><dd>{p.total_consultas ?? 0}<small>{p.ultima_consulta ? `Última: ${fechaLocal(p.ultima_consulta)}` : 'Sin consultas'}</small></dd></div>
        {p.antecedentes && <div><dt>Alergias</dt><dd>{p.antecedentes.alergias || 'Ninguna registrada'}</dd></div>}
        <div><dt>Próxima cita</dt><dd>{proxima ? <>{fechaHora(proxima.fecha_hora)}<small>{proxima.motivo}</small></> : p.citas ? 'Sin citas próximas' : '—'}</dd></div>
      </dl>
    </section>
  );
}
