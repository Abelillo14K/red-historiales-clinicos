import { Link } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, DataTable, ErrorState, LoadingState, MetricStrip, PageHeader, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fecha, hoy } from '@plataforma/formato.js';

export default function Vacunacion() {
  const { api, puede } = useSesion();
  const clinico = puede('historial.leer');
  const cat = useCarga(() => api.catalogos.vacunas(), [api]);
  const pend = useCarga(() => (clinico ? api.vacunacion.pendientes(100) : Promise.resolve([])), [api, clinico]);
  const hoyIso = hoy();
  const vencida = d => String(d.fecha_programada).slice(0, 10) < hoyIso;

  return (
    <>
      <PageHeader titulo="Vacunación" descripcion="Catálogo de vacunas del centro y dosis pendientes de los historiales activos. La programación y la aplicación se realizan desde el expediente de cada paciente." />
      <MetricStrip items={[
        { etiqueta: 'Vacunas en catálogo', valor: cat.datos?.length, icono: 'vacuna' },
        ...(clinico ? [
          { etiqueta: 'Dosis en la lista', valor: pend.datos?.length, icono: 'calendario' },
          { etiqueta: 'Vencidas en la lista', valor: pend.datos?.filter(vencida).length, icono: 'reloj', tono: 'warn' }
        ] : [])
      ]} />
      <div className={clinico ? 'grid grid-main' : undefined}>
        {clinico && (
          <Card titulo="Dosis pendientes" icono="calendario" descripcion="Ordenadas por fecha programada. «Vencida» indica que la fecha programada ya pasó.">
            {pend.cargando ? <LoadingState /> : pend.error ? <ErrorState error={pend.error} onReintentar={pend.recargar} /> : (
              <DataTable titulo="Dosis pendientes" vacio="No hay dosis pendientes" filas={pend.datos} claveFila={d => `${d.id_paciente}-${d.id_esquema}`} resaltar={vencida}
                columnas={[
                  { clave: 'p', titulo: 'Paciente', principal: true, render: d => <><Link className="row-link" to={`/pacientes/${d.id_paciente}/vacunacion`}>{d.nombres} {d.apellidos}</Link><div className="cell-sub"><code>{d.id_paciente}</code></div></> },
                  { clave: 'v', titulo: 'Vacuna', render: d => `${d.vacuna || d.id_vacuna} · dosis ${d.numero_dosis}` },
                  { clave: 'f', titulo: 'Programada', render: d => fecha(d.fecha_programada) },
                  { clave: 'e', titulo: 'Estado', render: d => <StatusBadge>{vencida(d) ? 'Vencida' : 'Pendiente'}</StatusBadge> }
                ]} />
            )}
          </Card>
        )}
        <Card titulo="Catálogo de vacunas" icono="vacuna" descripcion="El sistema no define calendarios oficiales; registra las dosis que programa el personal.">
          {cat.cargando ? <LoadingState /> : cat.error ? <ErrorState error={cat.error} onReintentar={cat.recargar} /> : (
            <DataTable titulo="Catálogo de vacunas" vacio="Catálogo vacío" filas={cat.datos} claveFila={v => v.id_vacuna} compacta columnas={[
              { clave: 'nombre', titulo: 'Vacuna', principal: true, render: v => <><b>{v.nombre}</b><div className="cell-sub"><code>{v.id_vacuna}</code></div></> },
              { clave: 'descripcion', titulo: 'Descripción', render: v => v.descripcion || '—' }
            ]} />
          )}
        </Card>
      </div>
    </>
  );
}
