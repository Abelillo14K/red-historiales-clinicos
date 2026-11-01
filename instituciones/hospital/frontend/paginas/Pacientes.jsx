import { Link } from 'react-router-dom';
import { ID_VISTA_PREVIA, useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, FilterBar, FormField, Icon, PageHeader, PatientCallout, PendienteIntegracion, StatCard, TablaPendiente } from '@plataforma/ui/index.js';

// Columnas del listado común de pacientes (docs/GUIA_INTEGRACION_EQUIPO.md §5.1).
const COLUMNAS = [
  { clave: 'paciente', titulo: 'Paciente' },
  { clave: 'codigo', titulo: 'Expediente' },
  { clave: 'dpi', titulo: 'DPI' },
  { clave: 'ultima', titulo: 'Última atención' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'accion', titulo: 'Acción' }
];

// Listado reutilizado por Pacientes y Historiales archivados. Búsqueda y filtros
// deshabilitados: no hay API que consultar. Al conectar, cargar con useCarga()
// (ver docs/FRONTEND_EQUIPO.md §5) y usar DataTable + Pager.
export function ListadoPacientes({ archivados }) {
  const { vistaPrevia, enlace } = useModulo();
  return (
    <Card titulo="Resultados de búsqueda" icono="buscar">
      <FilterBar etiqueta="Buscar pacientes">
        <FormField label="Buscar" className="search-field">
          {p => <div className="input-icon"><Icon name="buscar" /><input {...p} type="search" disabled placeholder="Buscar paciente por nombre, DPI o expediente" /></div>}
        </FormField>
        {!archivados && (
          <FormField label="Buscar por">
            {p => <select {...p} disabled><option>Nombre</option><option>DPI</option><option>Expediente</option></select>}
          </FormField>
        )}
      </FilterBar>
      <TablaPendiente titulo={archivados ? 'Historiales archivados' : 'Pacientes'} columnas={COLUMNAS} />
      {vistaPrevia && (
        <p className="meta mt-4">
          Vista previa: <Link to={enlace(`/pacientes/${ID_VISTA_PREVIA}`)}>ver la estructura del expediente</Link> sin paciente.
        </p>
      )}
    </Card>
  );
}

export default function Pacientes() {
  const { puede, enlace } = useModulo();
  return (
    <>
      <PageHeader titulo="Pacientes" descripcion="Busca primero: si la persona ya tiene expediente, abre su historial."
        acciones={puede('pacientes.registrar') && <Link className="btn btn-primary" to={enlace('/pacientes/nuevo')}><Icon name="mas" size={16} />Registrar paciente</Link>} />
      <PendienteIntegracion compacto />
      <div className="stats hospital-stats">
        <StatCard etiqueta="Pacientes activos" valor="—" icono="pacientes" contexto="Pendiente de datos del hospital" />
        <StatCard etiqueta="Citas para hoy" valor="—" icono="calendario" tono="info" contexto="Agenda del día" />
        <StatCard etiqueta="Hospitalizados" valor="—" icono="hospital" tono="ok" contexto="Ingresos activos" />
        <StatCard etiqueta="Historiales archivados" valor="—" icono="archivo" tono="warn" contexto="Expedientes en solo lectura" />
      </div>
      <ListadoPacientes />
      {puede('pacientes.registrar') && <PatientCallout to={enlace('/pacientes/nuevo')} />}
    </>
  );
}
