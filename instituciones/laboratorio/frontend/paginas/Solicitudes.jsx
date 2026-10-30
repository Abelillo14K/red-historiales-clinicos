import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, ContextPanel, FilterBar, FormField, Icon, MetricStrip, PageHeader, PendienteIntegracion, TablaPendiente } from '@plataforma/ui/index.js';

// Solicitudes (órdenes) de exámenes: extensión institucional PROPUESTA. Columnas
// orientativas; el backend del laboratorio define el modelo real.
const COLUMNAS = [
  { clave: 'fecha', titulo: 'Fecha de solicitud' }, { clave: 'paciente', titulo: 'Paciente' },
  { clave: 'examen', titulo: 'Examen' }, { clave: 'solicitante', titulo: 'Solicitado por' }, { clave: 'estado', titulo: 'Estado' }
];

export default function Solicitudes() {
  const { enlace } = useModulo();
  return (
    <>
      <PageHeader titulo="Solicitudes de exámenes" descripcion="Órdenes de examen recibidas por el laboratorio y su estado de atención."
        acciones={<Link className="btn btn-primary" to={enlace('/solicitudes/nueva')}><Icon name="mas" size={16} />Ver diseño de solicitud</Link>} />
      <PendienteIntegracion compacto />
      <MetricStrip items={[
        { etiqueta: 'Solicitudes pendientes', icono: 'matraz' }, { etiqueta: 'Muestras recibidas', icono: 'consulta' },
        { etiqueta: 'En análisis', icono: 'reloj' }, { etiqueta: 'Completadas', icono: 'ok' }
      ]} />
      <div className="workspace-grid"><div className="workspace-main">
      <Card titulo="Órdenes de examen" icono="matraz">
        <FilterBar etiqueta="Filtrar solicitudes">
          <FormField label="Buscar" className="search-field">
            {p => <div className="input-icon"><Icon name="buscar" /><input {...p} type="search" disabled placeholder="Paciente o examen" /></div>}
          </FormField>
          <FormField label="Estado">{p => <select {...p} disabled><option>Todos</option></select>}</FormField>
        </FilterBar>
        <TablaPendiente titulo="Solicitudes de exámenes" columnas={COLUMNAS} />
      </Card>
      </div><aside className="workspace-aside" aria-label="Contexto de solicitudes">
        <ContextPanel titulo="Solicitud seleccionada" icono="matraz" items={[
          ['Paciente', '—'], ['Profesional solicitante', '—'], ['Muestra', '—'], ['Prioridad', '—']
        ]} />
        <ContextPanel titulo="Seguimiento de la orden" icono="auditoria" descripcion="La recepción, el análisis y el resultado se vincularán a la misma solicitud." />
      </aside></div>
    </>
  );
}
