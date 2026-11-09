import { Link, useSearchParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, ErrorState, FilterBar, FormField, Icon, LoadingState, MetricStrip, PageHeader, Pager, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import { TONO_ESTADO } from '../componentes/formato.js';

const LIMITE = 20;
const ESTADOS = ['Pendiente', 'En proceso', 'Completada', 'Anulada'];

export default function Solicitudes() {
  const { api, puede, enlace } = useModulo();
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') || '';
  const pagina = Number(params.get('pagina')) || 1;
  const lista = useCarga(() => api.solicitudes.listar({ estado: estado || undefined, limite: LIMITE, pagina }), [api, estado, pagina]);
  const resumen = useCarga(() => api.panel(), [api]);
  const ir = cambios => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };
  const r = resumen.datos?.solicitudes;

  return (
    <>
      <PageHeader titulo="Solicitudes de exámenes" descripcion="Órdenes de examen recibidas por el laboratorio y su estado de atención."
        acciones={puede('laboratorio.solicitudes.crear') && <Link className="btn btn-primary" to={enlace('/solicitudes/nueva')}><Icon name="mas" size={16} />Nueva solicitud</Link>} />
      <MetricStrip items={[
        { etiqueta: 'Pendientes', valor: r?.pendientes, icono: 'matraz' },
        { etiqueta: 'En proceso', valor: r?.en_proceso, icono: 'reloj', tono: 'warn' },
        { etiqueta: 'Completadas', valor: r?.completadas, icono: 'ok', tono: 'ok' }
      ]} />
      <Card titulo="Órdenes de examen" icono="matraz">
        <FilterBar etiqueta="Filtrar solicitudes" resumen={lista.datos && <span role="status">{lista.datos.total} {lista.datos.total === 1 ? 'solicitud' : 'solicitudes'}</span>}>
          <FormField label="Estado">{p => (
            <select {...p} value={estado} onChange={e => ir({ estado: e.target.value, pagina: '' })}>
              <option value="">Todos</option>{ESTADOS.map(x => <option key={x}>{x}</option>)}
            </select>)}
          </FormField>
        </FilterBar>
        <ErrorState error={lista.error} onReintentar={lista.recargar} />
        {lista.cargando ? <LoadingState /> : lista.datos && <>
          <DataTable titulo="Solicitudes de exámenes" vacio="No hay solicitudes en esta vista" filas={lista.datos.items} claveFila={s => s.id_solicitud} columnas={[
            { clave: 'fecha', titulo: 'Fecha de solicitud', principal: true, render: s => <Link className="row-link" to={enlace(`/solicitudes/${s.id_solicitud}`)}>{fechaHora(s.fecha_solicitud)}</Link> },
            { clave: 'paciente', titulo: 'Paciente', render: s => <Link to={enlace(`/pacientes/${s.id_paciente}`)}>{s.paciente}</Link> },
            { clave: 'origen', titulo: 'Solicitado por', render: s => s.medico || s.institucion_remitente || '—' },
            { clave: 'prioridad', titulo: 'Prioridad', render: s => <StatusBadge tono={TONO_ESTADO[s.prioridad]} sinPunto>{s.prioridad}</StatusBadge> },
            { clave: 'estado', titulo: 'Estado', render: s => <StatusBadge tono={TONO_ESTADO[s.estado]}>{s.estado}</StatusBadge> },
            { clave: 'accion', titulo: 'Acción', render: s => <Link className="btn btn-sm" to={enlace(`/solicitudes/${s.id_solicitud}`)}>Ver solicitud<Icon name="derecha" size={14} /></Link> }
          ]} />
          <Pager pagina={pagina} limite={LIMITE} total={lista.datos.total} etiqueta="Páginas de solicitudes" onCambiar={n => ir({ pagina: n > 1 ? String(n) : '' })} />
        </>}
      </Card>
    </>
  );
}
