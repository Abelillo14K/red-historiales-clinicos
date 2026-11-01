import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, DataTable, EmptyState, ErrorState, FilterBar, FormField, Icon, LoadingState, PageHeader, Pager, PatientCallout, SearchBar, StatCard, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { edad, fecha, fechaHora, fechaLocal } from '@plataforma/formato.js';

// Listado reutilizado por Pacientes y Historiales archivados.
export function ListadoPacientes({ estadoFijo }) {
  const { api, puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const sexo = params.get('sexo') || '';
  const estado = estadoFijo || params.get('estado') || 'Activo';
  const pagina = Number(params.get('pagina')) || 1;
  const [texto, setTexto] = useState(q);
  const limite = 20;

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
    () => api.pacientes.listar({ q: q || undefined, sexo: sexo || undefined, estado, limite, pagina }),
    [api, q, sexo, estado, pagina]
  );
  const clinico = puede('historial.leer');
  const columnas = [
    { clave: 'paciente', titulo: 'Paciente', principal: true, render: p => (
      <div className="cell-person">
        <span className="avatar md" aria-hidden="true">{p.nombres?.[0]}{p.apellidos?.[0]}</span>
        <div>
          <Link className="row-link" to={`/pacientes/${p.id_paciente}`}>{p.apellidos}, {p.nombres}</Link>
          <div className="cell-sub"><code>{p.id_paciente}</code> · {p.sexo === 'F' ? 'Femenino' : 'Masculino'}</div>
        </div>
      </div>
    ) },
    { clave: 'edad', titulo: 'Edad', render: p => <><span className="patient-age">{edad(p.fecha_nacimiento)}</span><div className="cell-sub">{fecha(p.fecha_nacimiento)}</div></> },
    { clave: 'tutor', titulo: 'Tutor principal', render: p => (p.tutor_principal ? <>
      {p.tutor_principal.nombres} {p.tutor_principal.apellidos}
      <div className="cell-sub">{p.tutor_principal.parentesco}{p.tutor_principal.telefono ? ` · ${p.tutor_principal.telefono}` : ''}</div>
    </> : '—') },
    ...(clinico ? [
      { clave: 'consultas', titulo: 'Consultas', num: true, render: p => p.total_consultas },
      { clave: 'ultima', titulo: 'Última consulta', render: p => fechaHora(p.ultima_consulta) },
      { clave: 'dosis', titulo: 'Dosis pend.', num: true, render: p => (p.dosis_pendientes ? <StatusBadge tono="warn" sinPunto>{p.dosis_pendientes}</StatusBadge> : 0) }
    ] : []),
    { clave: 'estado', titulo: 'Estado', render: p => <>
      <StatusBadge>{p.estado_historial}</StatusBadge>
      {p.fecha_archivado && <div className="cell-sub">{fechaLocal(p.fecha_archivado)}</div>}
    </> },
    { clave: 'accion', titulo: 'Acción', render: p => <Link className="btn btn-sm btn-open-record" to={`/pacientes/${p.id_paciente}`}>Abrir historial<Icon name="derecha" size={14} /></Link> }
  ];

  return (
    <Card titulo="Resultados de búsqueda" icono="buscar" className="patient-list">
      <FilterBar etiqueta="Buscar pacientes" onSubmit={() => actualizar({ q: texto, pagina: '' })}
        resumen={datos && <span role="status">{datos.total} {datos.total === 1 ? 'paciente' : 'pacientes'}</span>}>
        <SearchBar label="Buscar" value={texto} onChange={setTexto}
          placeholder={puede('pacientes.editar') ? 'Nombre, apellido, código, tutor o DPI exacto' : 'Nombre, apellido, código o tutor'} />
        <FormField label="Sexo">
          {p => <select {...p} value={sexo} onChange={e => actualizar({ sexo: e.target.value, pagina: '' })}>
            <option value="">Todos</option><option value="F">Femenino</option><option value="M">Masculino</option>
          </select>}
        </FormField>
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
        ? <EmptyState icono={q ? 'buscar' : 'pacientes'} titulo={q ? 'Sin resultados' : 'No hay pacientes en esta vista'}>{q ? `No se encontraron pacientes para “${q}”.` : null}</EmptyState>
        : <>
          <DataTable titulo="Pacientes" columnas={columnas} filas={datos.items} claveFila={p => p.id_paciente} />
          <Pager pagina={pagina} limite={limite} total={datos.total} etiqueta="Páginas de pacientes" onCambiar={n => actualizar({ pagina: n > 1 ? String(n) : '' })} />
        </>)}
    </Card>
  );
}

export default function Pacientes() {
  const { api, puede } = useSesion();
  const resumen = useCarga(() => api.panel(), [api]);
  const clinico = puede('historial.leer');
  const r = resumen.datos;
  return (
    <>
      <PageHeader titulo="Pacientes" descripcion="Busca primero: si la persona ya tiene expediente, abre su historial."
        acciones={puede('pacientes.registrar') && <Link className="btn btn-primary" to="/pacientes/nuevo"><Icon name="mas" size={16} />Registrar paciente</Link>} />
      <ErrorState error={resumen.error} onReintentar={resumen.recargar} />
      <div className={`stats${clinico ? ' hospital-stats' : ''}`}>
        <StatCard etiqueta="Pacientes activos" valor={r?.pacientes_activos ?? '—'} icono="pacientes" contexto="Historiales disponibles para atención" />
        {clinico && <StatCard etiqueta="Consultas registradas" valor={r?.consultas ?? '—'} icono="consulta" tono="info" contexto="Históricos de pacientes activos y archivados" />}
        {clinico && <StatCard etiqueta="Dosis pendientes" valor={r?.dosis_pendientes ?? '—'} icono="vacuna" tono="ok" contexto="Solo historiales activos" />}
        <StatCard etiqueta="Historiales archivados" valor={r?.pacientes_archivados ?? '—'} icono="archivo" tono="warn" contexto="Expedientes conservados en solo lectura" />
      </div>
      <ListadoPacientes />
      {puede('pacientes.registrar') && <PatientCallout to="/pacientes/nuevo" />}
    </>
  );
}
