import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, EmptyState, ErrorState, FilterBar, FormField, Icon, LoadingState, MetricStrip, PageHeader, Pager, PatientCallout, SearchBar, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { edad, fecha, fechaLocal } from '@plataforma/formato.js';

const LIMITE = 20;

// Listado reutilizado por Pacientes y Historiales archivados.
export function ListadoPacientes({ estadoFijo }) {
  const { api, puede, enlace } = useModulo();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const estado = estadoFijo || params.get('estado') || 'Activo';
  const pagina = Number(params.get('pagina')) || 1;
  const [texto, setTexto] = useState(q);

  // Búsqueda con espera breve para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => { if (texto !== q) actualizar({ q: texto, pagina: '' }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function actualizar(cambios) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  }

  const { datos, cargando, error, recargar } = useCarga(
    () => api.pacientes.listar({ q: q || undefined, estado, limite: LIMITE, pagina }), [api, q, estado, pagina]);
  const columnas = [
    { clave: 'paciente', titulo: 'Paciente', principal: true, render: p => (
      <div className="cell-person">
        <span className="avatar md" aria-hidden="true">{p.nombres[0]}{p.apellidos[0]}</span>
        <div>
          <Link className="row-link" to={enlace(`/pacientes/${p.id_paciente}`)}>{p.apellidos}, {p.nombres}</Link>
          <div className="cell-sub">Expediente <code>{p.id_paciente}</code> · {p.sexo === 'F' ? 'Femenino' : 'Masculino'}</div>
        </div>
      </div>
    ) },
    { clave: 'documento', titulo: 'Documento', render: p => p.documento_identidad || '—' },
    { clave: 'edad', titulo: 'Edad', render: p => <><span className="patient-age">{edad(p.fecha_nacimiento)}</span><div className="cell-sub">{fecha(p.fecha_nacimiento)}</div></> },
    { clave: 'contacto', titulo: 'Contacto', render: p => p.telefono || p.correo || '—' },
    { clave: 'estado', titulo: 'Estado', render: p => <>
      <StatusBadge>{p.estado_historial}</StatusBadge>
      {p.fecha_archivado && <div className="cell-sub">{fechaLocal(p.fecha_archivado)}</div>}
    </> },
    { clave: 'accion', titulo: 'Acción', render: p => <Link className="btn btn-sm btn-open-record" to={enlace(`/pacientes/${p.id_paciente}`)}>Abrir expediente<Icon name="derecha" size={14} /></Link> }
  ];

  return (
    <Card titulo="Resultados de búsqueda" icono="buscar" className="patient-list">
      <FilterBar etiqueta="Buscar pacientes" onSubmit={() => actualizar({ q: texto, pagina: '' })}
        resumen={datos && <span role="status">{datos.total} {datos.total === 1 ? 'paciente' : 'pacientes'}</span>}>
        <SearchBar label="Buscar" value={texto} onChange={setTexto} placeholder="Nombre, apellido o documento exacto" />
        {!estadoFijo && puede('historial.leer_archivados') && (
          <FormField label="Estado del historial">
            {p => <select {...p} value={estado} onChange={e => actualizar({ estado: e.target.value === 'Activo' ? '' : e.target.value, pagina: '' })}>
              <option value="Activo">Activos</option><option value="Archivado">Archivados</option><option value="Todos">Todos</option>
            </select>}
          </FormField>
        )}
      </FilterBar>
      <ErrorState error={error} onReintentar={recargar} />
      {cargando ? <LoadingState /> : datos && (datos.items.length === 0
        ? <EmptyState icono={q ? 'buscar' : 'pacientes'} titulo={q ? 'Sin resultados' : 'No hay pacientes en esta vista'}>{q ? `No se encontraron pacientes para «${q}».` : null}</EmptyState>
        : <>
          <DataTable titulo="Pacientes" columnas={columnas} filas={datos.items} claveFila={p => p.id_paciente} />
          <Pager pagina={pagina} limite={LIMITE} total={datos.total} etiqueta="Páginas de pacientes" onCambiar={n => actualizar({ pagina: n > 1 ? String(n) : '' })} />
        </>)}
    </Card>
  );
}

export default function Pacientes() {
  const { api, puede, enlace } = useModulo();
  const resumen = useCarga(() => api.panel(), [api]);
  const r = resumen.datos;
  return (
    <>
      <PageHeader titulo="Pacientes" descripcion="Busca primero: si la persona ya tiene expediente, abre sus solicitudes y resultados."
        acciones={puede('pacientes.registrar') && <Link className="btn btn-primary" to={enlace('/pacientes/nuevo')}><Icon name="mas" size={16} />Registrar paciente</Link>} />
      <ErrorState error={resumen.error} onReintentar={resumen.recargar} />
      <MetricStrip items={[
        { etiqueta: 'Pacientes activos', valor: r?.pacientes_activos, icono: 'pacientes' },
        { etiqueta: 'Solicitudes pendientes', valor: r?.solicitudes.pendientes, icono: 'matraz' },
        { etiqueta: 'Solicitudes completadas', valor: r?.solicitudes.completadas, icono: 'resultado' },
        { etiqueta: 'Historiales archivados', valor: r?.pacientes_archivados, icono: 'archivo' }
      ]} />
      <ListadoPacientes />
      {puede('pacientes.registrar') && <PatientCallout to={enlace('/pacientes/nuevo')} />}
    </>
  );
}
