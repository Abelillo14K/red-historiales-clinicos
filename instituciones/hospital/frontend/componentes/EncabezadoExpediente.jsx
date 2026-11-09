import { StatusBadge } from '@plataforma/ui/index.js';
import { edad, fecha, fechaHora } from '@plataforma/formato.js';

export default function EncabezadoExpediente({ datos, acciones }) {
  const p = datos.paciente;
  const alergias = datos.alergias || [];
  const proxima = datos.proxima_cita;

  return (
    <section className="card patient-header" aria-labelledby="titulo-expediente">
      <div className="patient-main">
        <div className="patient-id">
          <div className="avatar" aria-hidden="true">{p.primer_nombre?.[0]}{p.primer_apellido?.[0]}</div>
          <div>
            <h1 id="titulo-expediente">{p.primer_nombre} {p.segundo_nombre} {p.primer_apellido} {p.segundo_apellido}</h1>
            <div className="page-meta">
              <code>{p.numero_expediente}</code>
              <span>{p.genero}</span>
              <span aria-hidden="true">·</span>
              <span>{edad(p.fecha_nacimiento)}</span>
              <span aria-hidden="true">·</span>
              <span>Nacimiento {fecha(p.fecha_nacimiento)}</span>
              <StatusBadge>{p.estado}</StatusBadge>
            </div>
          </div>
        </div>
        {acciones && <div className="actions">{acciones}</div>}
      </div>
      <dl className="patient-facts">
        <div><dt>Edad y sexo</dt><dd>{edad(p.fecha_nacimiento)}<small>{p.genero}</small></dd></div>
        <div><dt>Tipo de sangre</dt><dd>{p.tipo_sangre || 'No indicado'}</dd></div>
        <div><dt>Alergias</dt><dd>{alergias.length
          ? <>{alergias.map(a => a.nombre_alergia).join(', ')}<small>{alergias.length === 1 ? '1 alergia registrada' : `${alergias.length} alergias registradas`}</small></>
          : 'Sin alergias registradas'}</dd></div>
        <div><dt>Próxima cita</dt><dd>{proxima ? <>{fechaHora(proxima.fecha_hora_cita)}<small>Cita {proxima.id_cita}</small></> : 'Sin cita programada'}</dd></div>
      </dl>
    </section>
  );
}
