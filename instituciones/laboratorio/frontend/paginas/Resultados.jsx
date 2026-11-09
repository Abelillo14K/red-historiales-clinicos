import { Link, useSearchParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, ErrorState, FilterBar, FormField, Icon, LoadingState, PageHeader, Pager, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import { TONO_ESTADO } from '../componentes/formato.js';

const LIMITE = 20;

export default function Resultados() {
  const { api, puede, enlace } = useModulo();
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') || '';
  const pagina = Number(params.get('pagina')) || 1;
  const lista = useCarga(() => api.resultados.listar({ estado: estado || undefined, limite: LIMITE, pagina }), [api, estado, pagina]);
  const ir = cambios => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader titulo="Resultados de laboratorio" descripcion="Resultados preliminares y validados. Cada tipo de examen tiene sus propios parámetros."
        acciones={puede('laboratorio.resultados.registrar') && <Link className="btn btn-primary" to={enlace('/solicitudes?estado=Pendiente')}><Icon name="mas" size={16} />Registrar desde una solicitud</Link>} />
      <Card titulo="Informes de laboratorio" icono="resultado">
        <FilterBar etiqueta="Filtrar resultados" resumen={lista.datos && <span role="status">{lista.datos.total} {lista.datos.total === 1 ? 'resultado' : 'resultados'}</span>}>
          <FormField label="Estado">{p => (
            <select {...p} value={estado} onChange={e => ir({ estado: e.target.value, pagina: '' })}>
              <option value="">Todos</option><option value="Preliminar">Pendientes de validación</option><option value="Validado">Validados</option>
            </select>)}
          </FormField>
        </FilterBar>
        <ErrorState error={lista.error} onReintentar={lista.recargar} />
        {lista.cargando ? <LoadingState /> : lista.datos && <>
          <DataTable titulo="Resultados" vacio="No hay resultados en esta vista" filas={lista.datos.items} claveFila={r => r.id_resultado} columnas={[
            { clave: 'fecha', titulo: 'Fecha de análisis', principal: true, render: r => <Link className="row-link" to={enlace(`/resultados/${r.id_resultado}`)}>{fechaHora(r.fecha_analisis)}</Link> },
            { clave: 'paciente', titulo: 'Paciente', render: r => r.paciente },
            { clave: 'examen', titulo: 'Examen', render: r => r.tipo_examen },
            { clave: 'emision', titulo: 'Emisión', render: r => (r.fecha_emision ? fechaHora(r.fecha_emision) : '—') },
            { clave: 'estado', titulo: 'Estado', render: r => <StatusBadge tono={TONO_ESTADO[r.estado]}>{r.estado}</StatusBadge> },
            { clave: 'accion', titulo: 'Acción', render: r => <Link className="btn btn-sm" to={enlace(`/resultados/${r.id_resultado}`)}>Ver informe<Icon name="derecha" size={14} /></Link> }
          ]} />
          <Pager pagina={pagina} limite={LIMITE} total={lista.datos.total} etiqueta="Páginas de resultados" onCambiar={n => ir({ pagina: n > 1 ? String(n) : '' })} />
        </>}
      </Card>
    </>
  );
}
