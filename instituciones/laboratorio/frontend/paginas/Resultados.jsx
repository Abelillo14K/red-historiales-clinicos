import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, ContextPanel, FilterBar, FormField, Icon, MetricStrip, PageHeader, PendienteIntegracion, TablaPendiente } from '@plataforma/ui/index.js';

// Resultados de laboratorio. El listado solo usa datos generales; el detalle de cada
// resultado depende del tipo de examen y lo presenta VisorResultado.
const COLUMNAS = [
  { clave: 'fecha', titulo: 'Fecha' }, { clave: 'paciente', titulo: 'Paciente' },
  { clave: 'examen', titulo: 'Examen' }, { clave: 'estado', titulo: 'Estado' }
];

export default function Resultados() {
  const { enlace } = useModulo();
  return (
    <>
      <PageHeader titulo="Resultados de laboratorio" descripcion="Resultados emitidos. Cada tipo de examen puede tener una estructura propia."
        acciones={<Link className="btn btn-primary" to={enlace('/resultados/nuevo')}><Icon name="mas" size={16} />Ver diseño de registro</Link>} />
      <PendienteIntegracion compacto />
      <MetricStrip items={[
        { etiqueta: 'Resultados emitidos', icono: 'resultado' }, { etiqueta: 'Pendientes de validación', icono: 'reloj' },
        { etiqueta: 'Tipos de examen', icono: 'matraz' }
      ]} />
      <div className="workspace-grid"><div className="workspace-main">
      <Card titulo="Informes de laboratorio" icono="resultado">
        <FilterBar etiqueta="Filtrar resultados">
          <FormField label="Buscar" className="search-field">
            {p => <div className="input-icon"><Icon name="buscar" /><input {...p} type="search" disabled placeholder="Paciente o examen" /></div>}
          </FormField>
          <FormField label="Tipo de examen">{p => <select {...p} disabled><option>Todos</option></select>}</FormField>
        </FilterBar>
        <TablaPendiente titulo="Resultados" columnas={COLUMNAS} />
      </Card>
      </div><aside className="workspace-aside" aria-label="Contexto de resultados">
        <ContextPanel titulo="Informe seleccionado" icono="resultado" items={[
          ['Paciente', '—'], ['Examen', '—'], ['Fecha de emisión', '—'], ['Validado por', '—']
        ]}>
          <Link className="btn btn-block mt-4" to={enlace('/resultados/vista-previa')}>Ver diseño del informe</Link>
        </ContextPanel>
        <ContextPanel titulo="Estructura del resultado" icono="matraz" descripcion="Cada examen tendrá sus parámetros, unidades y referencias propias, definidos por el laboratorio." />
      </aside></div>
    </>
  );
}
