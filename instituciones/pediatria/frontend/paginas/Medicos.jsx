import { useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, DataTable, ErrorState, FilterBar, FormField, LoadingState, MetricStrip, PageHeader, StatusBadge, useCarga } from '@plataforma/ui/index.js';

export default function Medicos() {
  const { api } = useSesion();
  const [especialidad, setEspecialidad] = useState('');
  const esp = useCarga(() => api.catalogos.especialidades(), [api]);
  const med = useCarga(() => api.catalogos.medicos(especialidad || undefined), [api, especialidad]);

  return (
    <>
      <PageHeader titulo="Médicos" descripcion="Profesionales del centro y sus especialidades. Se referencian desde las consultas y las vacunas aplicadas." />
      <MetricStrip items={[
        { etiqueta: 'Profesionales en esta vista', valor: med.datos?.length, icono: 'medico' },
        { etiqueta: 'Especialidades disponibles', valor: esp.datos?.length, icono: 'consulta' },
        { etiqueta: 'Filtro de especialidad', valor: especialidad || 'Todas', icono: 'buscar' }
      ]} />
      <Card titulo="Directorio de profesionales" icono="medico">
        <FilterBar etiqueta="Filtrar médicos" resumen={med.datos && <span role="status">{med.datos.length} {med.datos.length === 1 ? 'médico' : 'médicos'}</span>}>
          <FormField label="Especialidad">{a => (
            <select {...a} value={especialidad} onChange={e => setEspecialidad(e.target.value)}>
              <option value="">Todas</option>
              {(esp.datos || []).map(e => <option key={e.nombre} value={e.nombre}>{e.nombre} ({e.medicos})</option>)}
            </select>)}
          </FormField>
        </FilterBar>
        <ErrorState error={esp.error} />
        {med.cargando ? <LoadingState /> : med.error ? <ErrorState error={med.error} onReintentar={med.recargar} /> : (
          <DataTable titulo="Médicos" vacio="Sin médicos para este filtro" filas={med.datos} claveFila={m => m.id_medico} columnas={[
            { clave: 'nombre', titulo: 'Nombre', principal: true, render: m => <><b>{m.nombres} {m.apellidos}</b><div className="cell-sub"><code>{m.id_medico}</code></div></> },
            { clave: 'colegiado', titulo: 'Colegiado' },
            { clave: 'esp', titulo: 'Especialidad', render: m => <StatusBadge tono="info" sinPunto>{m.especialidad?.nombre}</StatusBadge> }
          ]} />
        )}
      </Card>
    </>
  );
}
