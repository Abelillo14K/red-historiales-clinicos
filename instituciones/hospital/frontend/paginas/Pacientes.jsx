import { Link } from 'react-router-dom';
import { ID_VISTA_PREVIA, useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, FilterBar, FormField, Icon, PageHeader, PendienteIntegracion, TablaPendiente } from '@plataforma/ui/index.js';

// Columnas del listado común de pacientes (docs/GUIA_INTEGRACION_EQUIPO.md §5.1).
const COLUMNAS = [
  { clave: 'paciente', titulo: 'Paciente' },
  { clave: 'codigo', titulo: 'Código' },
  { clave: 'nacimiento', titulo: 'Fecha de nacimiento' },
  { clave: 'sexo', titulo: 'Sexo' },
  { clave: 'estado', titulo: 'Estado' }
];

// Listado reutilizado por Pacientes y Historiales archivados. Búsqueda y filtros
// deshabilitados: no hay API que consultar. Al conectar, cargar con useCarga()
// (ver docs/FRONTEND_EQUIPO.md §5) y usar DataTable + Pager.
export function ListadoPacientes({ archivados }) {
  const { vistaPrevia, enlace } = useModulo();
  return (
    <Card>
      <FilterBar etiqueta="Buscar pacientes">
        <FormField label="Buscar" className="search-field">
          {p => <div className="input-icon"><Icon name="buscar" /><input {...p} type="search" disabled placeholder="Nombre, apellido o código" /></div>}
        </FormField>
        {!archivados && (
          <FormField label="Estado del historial">
            {p => <select {...p} disabled><option>Activos</option></select>}
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
      <PageHeader titulo="Pacientes" descripcion="Búsqueda y consulta de expedientes del Hospital General."
        acciones={puede('pacientes.registrar') && <Link className="btn btn-primary" to={enlace('/pacientes/nuevo')}><Icon name="mas" size={16} />Registrar paciente</Link>} />
      <PendienteIntegracion compacto />
      <ListadoPacientes />
    </>
  );
}
