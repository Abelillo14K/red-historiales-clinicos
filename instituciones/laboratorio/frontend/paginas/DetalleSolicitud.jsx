import { Link, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, ErrorState, Icon, KeyValue, LoadingState, PageHeader, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import { TONO_ESTADO } from '../componentes/formato.js';

// Una solicitud con sus exámenes: desde aquí se registra el resultado de cada examen.
export default function DetalleSolicitud() {
  const { solicitud: id } = useParams();
  const { api, puede, enlace } = useModulo();
  const s = useCarga(() => api.solicitudes.obtener(id), [api, id]);

  if (s.cargando) return <LoadingState texto="Cargando solicitud…" />;
  if (s.error) return <><ErrorState error={s.error} onReintentar={s.recargar} /><Link className="btn" to={enlace('/solicitudes')}>Volver a solicitudes</Link></>;
  const d = s.datos;
  const abierta = d.estado !== 'Anulada';

  function accion(e) {
    const r = e.resultado;
    if (r?.id_resultado && puede('laboratorio.resultados.ver')) {
      return <Link className="btn btn-sm" to={enlace(`/resultados/${r.id_resultado}`)}>Ver resultado<Icon name="derecha" size={14} /></Link>;
    }
    if (abierta && r?.estado !== 'Validado' && puede('laboratorio.resultados.registrar')) {
      return <Link className="btn btn-sm btn-primary" to={enlace(`/resultados/nuevo?examen=${e.id_examen}&solicitud=${d.id_solicitud}`)}>Registrar resultado</Link>;
    }
    return '—';
  }

  return (
    <>
      <PageHeader titulo={`Solicitud ${d.id_solicitud}`} descripcion={`${d.paciente} · ${fechaHora(d.fecha_solicitud)}`}
        acciones={<>
          <Link className="btn" to={enlace(`/pacientes/${d.id_paciente}`)}>Ver expediente</Link>
          <Link className="btn" to={enlace('/solicitudes')}>Volver a solicitudes</Link>
        </>} />
      <div className="stack">
        <Card titulo="Exámenes solicitados" icono="matraz">
          <DataTable titulo="Exámenes" filas={d.examenes} claveFila={e => e.id_examen} columnas={[
            { clave: 'examen', titulo: 'Examen', principal: true, render: e => e.tipo_examen },
            { clave: 'muestra', titulo: 'Código de muestra', render: e => (e.codigo_muestra ? <code>{e.codigo_muestra}</code> : '—') },
            { clave: 'toma', titulo: 'Toma de muestra', render: e => fechaHora(e.fecha_toma_muestra) },
            { clave: 'estado', titulo: 'Estado', render: e => <StatusBadge tono={TONO_ESTADO[e.estado]}>{e.estado}</StatusBadge> },
            { clave: 'resultado', titulo: 'Resultado', render: e => (e.resultado ? <StatusBadge tono={TONO_ESTADO[e.resultado.estado]}>{e.resultado.estado}</StatusBadge> : 'Sin registrar') },
            { clave: 'accion', titulo: 'Acción', render: accion }
          ]} />
        </Card>
        <Card titulo="Datos de la solicitud" icono="consulta">
          <KeyValue items={[
            ['Estado', <StatusBadge key="e" tono={TONO_ESTADO[d.estado]}>{d.estado}</StatusBadge>],
            ['Prioridad', d.prioridad], ['Médico solicitante', d.medico], ['Institución remitente', d.institucion_remitente],
            ['Motivo', d.motivo], ['Indicaciones', d.indicaciones], ['Observaciones', d.observaciones], ['Registrada por', d.registrado_por]
          ]} />
        </Card>
      </div>
    </>
  );
}
