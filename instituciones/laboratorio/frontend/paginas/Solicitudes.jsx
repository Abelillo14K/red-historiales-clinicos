import { Card, FilterBar, FormField, Icon, PageHeader, PendienteIntegracion, TablaPendiente } from '@plataforma/ui/index.js';

// Solicitudes (órdenes) de exámenes: extensión institucional PROPUESTA. Columnas
// orientativas; el backend del laboratorio define el modelo real.
const COLUMNAS = [
  { clave: 'fecha', titulo: 'Fecha de solicitud' }, { clave: 'paciente', titulo: 'Paciente' },
  { clave: 'examen', titulo: 'Examen' }, { clave: 'solicitante', titulo: 'Solicitado por' }, { clave: 'estado', titulo: 'Estado' }
];

export default function Solicitudes() {
  return (
    <>
      <PageHeader titulo="Solicitudes de exámenes" descripcion="Órdenes de examen recibidas por el laboratorio y su estado de atención."
        acciones={<button type="button" className="btn btn-primary" disabled title="Disponible al conectar el backend"><Icon name="mas" size={16} />Nueva solicitud</button>} />
      <PendienteIntegracion compacto />
      <Card>
        <FilterBar etiqueta="Filtrar solicitudes">
          <FormField label="Buscar" className="search-field">
            {p => <div className="input-icon"><Icon name="buscar" /><input {...p} type="search" disabled placeholder="Paciente o examen" /></div>}
          </FormField>
          <FormField label="Estado">{p => <select {...p} disabled><option>Todos</option></select>}</FormField>
        </FilterBar>
        <TablaPendiente titulo="Solicitudes de exámenes" columnas={COLUMNAS} />
      </Card>
    </>
  );
}
