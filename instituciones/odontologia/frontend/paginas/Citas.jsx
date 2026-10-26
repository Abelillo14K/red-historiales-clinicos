import { Card, FilterBar, FormField, Icon, PageHeader, PendienteIntegracion, TablaPendiente } from '@plataforma/ui/index.js';

// Citas de la Clínica Odontológica: extensión institucional PROPUESTA (no forma parte del
// contrato común). Columnas orientativas; el backend de la clínica define el modelo real.
const COLUMNAS = [
  { clave: 'fecha', titulo: 'Fecha y hora' }, { clave: 'paciente', titulo: 'Paciente' },
  { clave: 'profesional', titulo: 'Odontólogo' }, { clave: 'motivo', titulo: 'Motivo' }, { clave: 'estado', titulo: 'Estado' }
];

export default function Citas() {
  return (
    <>
      <PageHeader titulo="Citas odontológicas" descripcion="Agenda de la clínica. El modelo de citas lo definirá el backend de la Clínica Odontológica."
        acciones={<button type="button" className="btn btn-primary" disabled title="Disponible al conectar el backend"><Icon name="mas" size={16} />Programar cita</button>} />
      <PendienteIntegracion compacto />
      <Card>
        <FilterBar etiqueta="Filtrar citas">
          <FormField label="Fecha">{p => <input {...p} type="date" disabled />}</FormField>
          <FormField label="Estado">{p => <select {...p} disabled><option>Todos</option></select>}</FormField>
        </FilterBar>
        <TablaPendiente titulo="Citas" columnas={COLUMNAS} />
      </Card>
    </>
  );
}
