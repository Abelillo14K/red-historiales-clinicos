import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, EmptyState, ErrorState, FilterBar, FormField, Icon, LoadingState, PageHeader, Pager, PatientCallout, SearchBar, StatCard, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { edad, fecha, fechaHora } from '@plataforma/formato.js';

export function ListadoPacientes({ archivados = false }) {
  const { api, puede } = useSesion();
  const { enlace } = useModulo();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const por = params.get('por') || 'nombre';
  const estado = archivados ? 'Archivado' : params.get('estado') || 'Activo';
  const pagina = Number(params.get('pagina')) || 1;
  const [texto, setTexto] = useState(q);
  const limite = 20;

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
    () => api.pacientes.listar({ q: q || undefined, por, estado, limite, pagina }),
    [api, q, por, estado, pagina]
  );

  const columnas = [
    { clave: 'paciente', titulo: 'Paciente', principal: true, render: p => (
      <div className="cell-person">
        <span className="avatar md" aria-hidden="true">{p.nombres?.[0]}{p.apellidos?.[0]}</span>
        <div>
          <Link className="row-link" to={enlace(`/pacientes/${p.id_paciente}`)}>{p.paciente}</Link>
          <div className="cell-sub"><code>{p.codigo}</code> · {p.sexo === 'Femenino' ? 'Femenino' : 'Masculino'}</div>
        </div>
      </div>
    ) },
    { clave: 'dpi', titulo: 'DPI', render: p => p.dpi || '—' },
    { clave: 'edad', titulo: 'Edad', render: p => <><span className="patient-age">{edad(p.fecha_nacimiento)}</span><div className="cell-sub">{fecha(p.fecha_nacimiento)}</div></> },
    { clave: 'ultima_atencion', titulo: 'Última atención', render: p => p.ultima_atencion ? fechaHora(p.ultima_atencion) : 'Sin consultas' },
    { clave: 'estado', titulo: 'Estado', render: p => <StatusBadge>{p.estado}</StatusBadge> },
    { clave: 'accion', titulo: 'Acción', render: p => <Link className="btn btn-sm btn-open-record" to={enlace(`/pacientes/${p.id_paciente}`)}>Abrir historial<Icon name="derecha" size={14} /></Link> }
  ];

  return (
    <Card titulo="Resultados de búsqueda" icono="buscar" className="patient-list">
      <FilterBar etiqueta="Buscar pacientes" onSubmit={() => actualizar({ q: texto, pagina: '' })}
        resumen={datos && <span role="status">{datos.total} {datos.total === 1 ? 'paciente' : 'pacientes'}</span>}>
        <SearchBar label="Buscar" value={texto} onChange={setTexto} placeholder="Nombre, apellido, expediente o DPI" />
        <FormField label="Buscar por">
          {p => <select {...p} value={por} onChange={e => actualizar({ por: e.target.value, pagina: '' })}>
            <option value="nombre">Nombre</option>
            <option value="expediente">Expediente</option>
            <option value="dpi">DPI</option>
          </select>}
        </FormField>
        {!archivados && (
          <FormField label="Estado">
            {p => <select {...p} value={estado} onChange={e => actualizar({ estado: e.target.value, pagina: '' })}>
              <option value="Activo">Activos</option>
              <option value="Inactivo">Inactivos</option>
              {puede('historial.leer_archivados') && <option value="Archivado">Archivados</option>}
              <option value="todos">Todos</option>
            </select>}
          </FormField>
        )}
      </FilterBar>
      <ErrorState error={error} onReintentar={recargar} />
      {cargando ? <LoadingState /> : datos && (datos.items.length === 0
        ? <EmptyState icono={q ? 'buscar' : 'pacientes'} titulo={q ? 'Sin resultados' : 'No hay pacientes en esta vista'}>
            {q ? `No se encontraron pacientes para «${q}».` : null}
          </EmptyState>
        : <>
            <DataTable titulo="Pacientes" columnas={columnas} filas={datos.items} claveFila={p => p.id_paciente} />
            <Pager pagina={pagina} limite={limite} total={datos.total} etiqueta="Páginas de pacientes" onCambiar={n => actualizar({ pagina: n > 1 ? String(n) : '' })} />
          </>)}
    </Card>
  );
}

export default function Pacientes() {
  const { api, puede } = useSesion();
  const { enlace } = useModulo();
  const resumen = useCarga(() => api.panel.resumen(), [api]);
  const r = resumen.datos;

  return (
    <>
      <PageHeader titulo="Pacientes" descripcion="Busca primero: si la persona ya tiene expediente, abre su historial."
        acciones={<>
          {puede('historial.leer_archivados') && <Link className="btn" to={enlace('/archivados')}><Icon name="archivo" size={16} />Archivados</Link>}
          {puede('pacientes.registrar') && <Link className="btn btn-primary" to={enlace('/pacientes/nuevo')}><Icon name="mas" size={16} />Registrar paciente</Link>}
        </>} />
      <ErrorState error={resumen.error} onReintentar={resumen.recargar} />
      <div className="stats hospital-stats">
        <StatCard etiqueta="Pacientes activos" valor={r?.pacientes_activos ?? '—'} icono="pacientes" contexto="Historiales disponibles para atención" />
        <StatCard etiqueta="Citas para hoy" valor={r?.citas_hoy ?? '—'} icono="calendario" tono="info" contexto="Programadas y confirmadas" />
        <StatCard etiqueta="Hospitalizados" valor={r?.hospitalizados ?? '—'} icono="hospital" tono="ok" contexto="Ingresos activos" />
        <StatCard etiqueta="Historiales archivados" valor={r?.historiales_archivados ?? '—'} icono="archivo" tono="warn" contexto="Expedientes en solo lectura" />
      </div>
      <ListadoPacientes />
      {puede('pacientes.registrar') && <PatientCallout to={enlace('/pacientes/nuevo')} />}
    </>
  );
}
