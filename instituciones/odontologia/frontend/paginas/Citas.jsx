import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, DataTable, EmptyState, ErrorState, FilterBar, FormField, LoadingState, PageHeader, SearchBar, StatusBadge, useCarga, useConfirmar, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { aIso, fechaHora, hoy } from '@plataforma/formato.js';
import { TONO_CITA } from '../componentes/formato.js';

const ESTADOS = ['Programada', 'Atendida', 'Cancelada', 'No asistió'];
const sumarDias = (dia, n) => new Date(new Date(`${dia}T00:00:00`).getTime() + n * 864e5).toISOString().slice(0, 10);

// Agenda odontológica: citas por rango de fechas, programación y cambio de estado.
export default function Citas() {
  const { api, puede, enlace } = useModulo();
  const confirmar = useConfirmar();
  const notificar = useNotificar();
  const [filtro, setFiltro] = useState({ desde: hoy(), hasta: sumarDias(hoy(), 30), estado: '' });
  const lista = useCarga(() => api.citas.listar({
    desde: aIso(`${filtro.desde}T00:00`), hasta: aIso(`${filtro.hasta}T23:59`), estado: filtro.estado || undefined
  }), [api, filtro]);
  const gestionar = puede('odontologia.citas.gestionar');

  async function cambiar(c, estado) {
    if (!(await confirmar({ titulo: `Marcar como ${estado.toLowerCase()}`, mensaje: `${c.paciente} · ${fechaHora(c.fecha_hora)}`, confirmar: estado, peligro: estado === 'Cancelada' }))) return;
    try {
      await api.citas.cambiarEstado(c.id_cita, estado);
      notificar(`Cita ${estado.toLowerCase()}`);
      lista.recargar();
    } catch (e) { notificar(e.message, 'error'); }
  }

  return (
    <>
      <PageHeader titulo="Citas odontológicas" descripcion="Agenda de la clínica. Un odontólogo no puede tener dos citas programadas que se crucen." />
      <div className="grid grid-main">
        <Card titulo="Agenda" icono="calendario">
          <FilterBar etiqueta="Filtrar citas" resumen={lista.datos && <span role="status">{lista.datos.length} {lista.datos.length === 1 ? 'cita' : 'citas'}</span>}>
            <FormField label="Desde">{a => <input {...a} type="date" value={filtro.desde} onChange={e => e.target.value && setFiltro({ ...filtro, desde: e.target.value })} />}</FormField>
            <FormField label="Hasta">{a => <input {...a} type="date" value={filtro.hasta} min={filtro.desde} onChange={e => e.target.value && setFiltro({ ...filtro, hasta: e.target.value })} />}</FormField>
            <FormField label="Estado">{a => (
              <select {...a} value={filtro.estado} onChange={e => setFiltro({ ...filtro, estado: e.target.value })}>
                <option value="">Todos</option>{ESTADOS.map(x => <option key={x}>{x}</option>)}
              </select>)}</FormField>
          </FilterBar>
          <ErrorState error={lista.error} onReintentar={lista.recargar} />
          {lista.cargando ? <LoadingState /> : lista.datos && <DataTable titulo="Citas" vacio="No hay citas en estas fechas" filas={lista.datos} claveFila={c => c.id_cita} columnas={[
            { clave: 'fecha', titulo: 'Fecha y hora', principal: true, render: c => <>{fechaHora(c.fecha_hora)}<div className="cell-sub">{c.duracion_min} min</div></> },
            { clave: 'paciente', titulo: 'Paciente', render: c => <Link to={enlace(`/pacientes/${c.id_paciente}`)}>{c.paciente}</Link> },
            { clave: 'odontologo', titulo: 'Odontólogo' }, { clave: 'motivo', titulo: 'Motivo' },
            { clave: 'estado', titulo: 'Estado', render: c => <StatusBadge tono={TONO_CITA[c.estado]}>{c.estado}</StatusBadge> },
            { clave: 'accion', titulo: 'Acción', render: c => (gestionar && c.estado === 'Programada' ? <div className="actions">
              <button type="button" className="btn btn-sm" onClick={() => cambiar(c, 'No asistió')}>No asistió</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => cambiar(c, 'Cancelada')}>Cancelar</button>
            </div> : '—') }
          ]} />}
        </Card>
        {gestionar && <NuevaCita onHecha={lista.recargar} />}
      </div>
    </>
  );
}

function NuevaCita({ onHecha }) {
  const { api } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const odontologos = useCarga(() => api.catalogos.odontologos(), [api]);
  const [q, setQ] = useState('');
  const busqueda = useCarga(() => (q.trim().length >= 2 ? api.pacientes.listar({ q: q.trim(), limite: 8 }) : Promise.resolve(null)), [api, q]);
  const [paciente, setPaciente] = useState(null);
  const [d, setD] = useState({ id_odontologo: '', fecha: '', hora: '09:00', duracion_min: '30', motivo: '' });

  async function enviar(e) {
    e.preventDefault();
    if (!paciente || !d.id_odontologo || !d.fecha || !d.motivo.trim()) return envio.setError(new Error('Complete paciente, odontólogo, fecha y motivo'));
    const r = await envio.enviar(() => api.citas.programar({
      id_paciente: paciente.id_paciente, id_odontologo: d.id_odontologo, fecha_hora: aIso(`${d.fecha}T${d.hora}`),
      duracion_min: Number(d.duracion_min), motivo: d.motivo.trim()
    }));
    if (r) { notificar('Cita programada'); setD({ ...d, fecha: '', motivo: '' }); setPaciente(null); setQ(''); onHecha(); }
  }

  return <Card titulo="Programar cita" icono="mas">
    <form onSubmit={enviar} className="stack">
      {envio.error && <Alerta>{envio.error.message}</Alerta>}
      {paciente
        ? <p>Paciente: <b>{paciente.nombres} {paciente.apellidos}</b> ({paciente.id_paciente}) <button type="button" className="btn btn-sm" onClick={() => setPaciente(null)}>Cambiar</button></p>
        : <>
          <SearchBar label="Paciente" value={q} onChange={setQ} placeholder="Nombre, apellido o documento" />
          {busqueda.datos && (busqueda.datos.items.length === 0 ? <EmptyState titulo="Sin resultados" /> : <ul className="sub-list">
            {busqueda.datos.items.map(p => <li key={p.id_paciente}><button type="button" className="btn btn-block" onClick={() => setPaciente(p)}>{p.apellidos}, {p.nombres} · {p.id_paciente}</button></li>)}
          </ul>)}
        </>}
      <FormField label="Odontólogo" required>{a => (
        <select {...a} value={d.id_odontologo} onChange={e => setD({ ...d, id_odontologo: e.target.value })}>
          <option value="">Seleccione…</option>
          {(odontologos.datos || []).filter(o => o.activo).map(o => <option key={o.id_odontologo} value={o.id_odontologo}>{o.nombres} {o.apellidos}</option>)}
        </select>)}</FormField>
      <div className="form-grid">
        <FormField label="Fecha" required>{a => <input {...a} type="date" min={hoy()} value={d.fecha} onChange={e => setD({ ...d, fecha: e.target.value })} />}</FormField>
        <FormField label="Hora" required>{a => <input {...a} type="time" step="900" value={d.hora} onChange={e => setD({ ...d, hora: e.target.value })} />}</FormField>
        <FormField label="Duración">{a => (
          <select {...a} value={d.duracion_min} onChange={e => setD({ ...d, duracion_min: e.target.value })}>
            {['15', '30', '45', '60', '90', '120'].map(x => <option key={x} value={x}>{x} min</option>)}
          </select>)}</FormField>
      </div>
      <FormField label="Motivo" required>{a => <input {...a} maxLength={300} value={d.motivo} onChange={e => setD({ ...d, motivo: e.target.value })} />}</FormField>
      <BotonEnviar enviando={envio.enviando}>Programar cita</BotonEnviar>
    </form>
  </Card>;
}
