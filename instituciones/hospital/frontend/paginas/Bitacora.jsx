import { useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, DataTable, ErrorState, FilterBar, FormField, LoadingState, MetricStrip, PageHeader, Pager, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';

const ACCIONES = ['LEER', 'CREAR', 'MODIFICAR', 'ARCHIVAR', 'REACTIVAR'];

export default function Bitacora() {
  const { api } = useSesion();
  const [f, setF] = useState({ id_paciente: '', accion: '', desde: '', hasta: '' });
  const [aplicado, setAplicado] = useState(f);
  const [pagina, setPagina] = useState(1);
  const limite = 50;
  const { datos, cargando, error, recargar } = useCarga(() => api.auditoria.listar({
    id_paciente: aplicado.id_paciente.trim() || undefined,
    accion: aplicado.accion || undefined,
    desde: aplicado.desde || undefined,
    hasta: aplicado.hasta || undefined,
    limite,
    pagina
  }), [api, aplicado, pagina]);

  function filtrar() {
    setPagina(1);
    setAplicado({ ...f });
  }

  return (
    <>
      <PageHeader titulo="Bitácora de acceso" descripcion="Trazabilidad de accesos y operaciones sobre los historiales." />
      <MetricStrip items={[
        { etiqueta: 'Eventos visibles', valor: datos?.total, icono: 'auditoria' },
        { etiqueta: 'Lecturas en esta página', valor: datos?.items.filter(e => e.accion === 'LEER').length, icono: 'buscar' },
        { etiqueta: 'Acción seleccionada', valor: aplicado.accion || 'Todas', icono: 'llave', texto: Boolean(aplicado.accion) }
      ]} />
      <Card titulo="Filtros" icono="buscar">
        <FilterBar etiqueta="Filtrar bitácora" onSubmit={filtrar}
          resumen={<button type="button" className="btn btn-sm" onClick={() => { const v = { id_paciente: '', accion: '', desde: '', hasta: '' }; setF(v); setAplicado(v); setPagina(1); }}>Limpiar filtros</button>}>
          <FormField label="Código de paciente">{a => <input {...a} value={f.id_paciente} onChange={e => setF({ ...f, id_paciente: e.target.value })} maxLength={40} placeholder="HG-000001" />}</FormField>
          <FormField label="Acción">{a => (
            <select {...a} value={f.accion} onChange={e => setF({ ...f, accion: e.target.value })}>
              <option value="">Todas</option>
              {ACCIONES.map(x => <option key={x}>{x}</option>)}
            </select>)}</FormField>
          <FormField label="Desde">{a => <input {...a} type="date" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} />}</FormField>
          <FormField label="Hasta">{a => <input {...a} type="date" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} />}</FormField>
          <button type="submit" className="btn btn-primary">Filtrar</button>
        </FilterBar>
      </Card>
      <Card titulo="Registro de operaciones" icono="auditoria">
        <ErrorState error={error} onReintentar={recargar} />
        {cargando ? <LoadingState /> : <>
          <DataTable titulo="Bitácora" vacio="Sin eventos para los filtros seleccionados" claveFila={e => e.id_bitacora}
            filas={datos?.items || []} columnas={[
              { clave: 'fecha', titulo: 'Fecha y hora', render: e => fechaHora(e.fecha) },
              { clave: 'actor', titulo: 'Usuario' },
              { clave: 'accion', titulo: 'Acción', render: e => <StatusBadge tono={e.accion === 'LEER' ? 'info' : e.accion === 'CREAR' ? 'ok' : 'warn'} sinPunto>{e.accion}</StatusBadge> },
              { clave: 'tabla_afectada', titulo: 'Tabla' },
              { clave: 'numero_expediente', titulo: 'Paciente', render: e => e.numero_expediente || (e.id_paciente ? `#${e.id_paciente}` : '—') },
              { clave: 'direccion_ip', titulo: 'IP' }
            ]} />
          {datos?.total > limite && <Pager pagina={pagina} limite={limite} total={datos.total} etiqueta="Páginas de bitácora" onCambiar={setPagina} />}
        </>}
      </Card>
    </>
  );
}
