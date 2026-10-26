import { Card, FilterBar, FormField, Icon, PageHeader, PendienteIntegracion, TablaPendiente } from '@plataforma/ui/index.js';
import VisorResultado from '../componentes/VisorResultado.jsx';

// Resultados de laboratorio. El listado solo usa datos generales; el detalle de cada
// resultado depende del tipo de examen y lo presenta VisorResultado.
const COLUMNAS = [
  { clave: 'fecha', titulo: 'Fecha' }, { clave: 'paciente', titulo: 'Paciente' },
  { clave: 'examen', titulo: 'Examen' }, { clave: 'estado', titulo: 'Estado' }
];

export default function Resultados() {
  return (
    <>
      <PageHeader titulo="Resultados de laboratorio" descripcion="Resultados emitidos. Cada tipo de examen puede tener una estructura propia." />
      <PendienteIntegracion compacto />
      <Card>
        <FilterBar etiqueta="Filtrar resultados">
          <FormField label="Buscar" className="search-field">
            {p => <div className="input-icon"><Icon name="buscar" /><input {...p} type="search" disabled placeholder="Paciente o examen" /></div>}
          </FormField>
          <FormField label="Tipo de examen">{p => <select {...p} disabled><option>Todos</option></select>}</FormField>
        </FilterBar>
        <TablaPendiente titulo="Resultados" columnas={COLUMNAS} />
      </Card>
      <Card titulo="Detalle del resultado" descripcion="Se muestra al seleccionar un resultado del listado.">
        <VisorResultado />
      </Card>
    </>
  );
}
