import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, DataTable, ErrorState, FilterBar, FormField, LoadingState, MetricStrip, PageHeader, StatusBadge, useCarga, useConfirmar, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { fechaHora, localAhora } from '@plataforma/formato.js';
import BuscadorPaciente from '../componentes/BuscadorPaciente.jsx';

const nombreMedico = m => [m.primer_nombre, m.segundo_nombre, m.primer_apellido, m.segundo_apellido].filter(Boolean).join(' ');

export default function Citas() {
  const { api, puede } = useSesion();
  const { enlace } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const gestionar = puede('hospital.citas.gestionar');
  const catalogo = useCarga(() => api.catalogos.listar('profesionales', { limite: 500 }), [api]);
  const [filtros, setFiltros] = useState({ fecha: '', id_medico: '', estado: '' });
  const [aplicados, setAplicados] = useState(filtros);
  const [nueva, setNueva] = useState({ id_paciente: '', id_medico: '', fecha_hora: localAhora(30), motivo: '' });
  const [errores, setErrores] = useState({});
  const lista = useCarga(() => api.citas.listar({
    fecha: aplicados.fecha || undefined,
    id_medico: aplicados.id_medico || undefined,
    estado: aplicados.estado || undefined,
    limite: 200
  }), [api, aplicados]);
  const medicos = catalogo.datos?.items.filter(m => m.estado === 'Activo') || [];
  const citas = lista.datos?.items || [];

  function validar() {
    const e = {};
    if (!nueva.id_paciente) e.id_paciente = 'Seleccione el paciente';
    if (!nueva.id_medico) e.id_medico = 'Seleccione el médico';
    if (!nueva.fecha_hora) e.fecha_hora = 'Obligatorio';
    else if (new Date(nueva.fecha_hora) <= new Date()) e.fecha_hora = 'Debe ser una fecha futura';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function crear(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const r = await envio.enviar(() => api.citas.crear({
      id_paciente: Number(nueva.id_paciente),
      id_medico: Number(nueva.id_medico),
      fecha_hora: nueva.fecha_hora,
      motivo: nueva.motivo.trim()
    }));
    if (r) {
      notificar(`Cita ${r.id_cita} programada`);
      setNueva({ id_paciente: '', id_medico: '', fecha_hora: localAhora(30), motivo: '' });
      lista.recargar();
    }
  }

  const columnas = [
    { clave: 'fecha_hora_cita', titulo: 'Fecha y hora', render: c => fechaHora(c.fecha_hora_cita) },
    { clave: 'paciente', titulo: 'Paciente', principal: true, render: c => (
      <>
        <Link className="row-link" to={enlace(`/pacientes/${c.id_paciente}`)}>{c.paciente}</Link>
        <div className="cell-sub"><code>{c.numero_expediente}</code></div>
      </>
    ) },
    { clave: 'medico', titulo: 'Médico' },
    { clave: 'motivo', titulo: 'Motivo' },
    { clave: 'estado_cita', titulo: 'Estado', render: c => <StatusBadge>{c.estado_cita}</StatusBadge> }
  ];
  if (gestionar) columnas.push({ clave: 'acciones', titulo: 'Acciones', render: c => <AccionesCita cita={c} onHecho={lista.recargar} /> });

  return (
    <>
      <PageHeader titulo="Agenda de citas" descripcion="Programación, confirmación y cancelación de citas del hospital." />
      {catalogo.error && <ErrorState error={catalogo.error} onReintentar={catalogo.recargar} />}
      <MetricStrip items={[
        { etiqueta: 'Citas visibles', valor: lista.datos?.total, icono: 'calendario' },
        { etiqueta: 'Programadas', valor: citas.filter(c => c.estado_cita === 'Programada').length, icono: 'reloj' },
        { etiqueta: 'Confirmadas', valor: citas.filter(c => c.estado_cita === 'Confirmada').length, icono: 'ok' }
      ]} />
      <Card titulo="Filtrar agenda" icono="buscar">
        <FilterBar etiqueta="Filtrar citas" onSubmit={() => setAplicados({ ...filtros })}
          resumen={<button type="button" className="btn btn-sm" onClick={() => { const v = { fecha: '', id_medico: '', estado: '' }; setFiltros(v); setAplicados(v); }}>Limpiar filtros</button>}>
          <FormField label="Fecha">{a => <input {...a} type="date" value={filtros.fecha} onChange={e => setFiltros({ ...filtros, fecha: e.target.value })} />}</FormField>
          <FormField label="Médico">{a => (
            <select {...a} value={filtros.id_medico} onChange={e => setFiltros({ ...filtros, id_medico: e.target.value })}>
              <option value="">Todos</option>
              {medicos.map(m => <option key={m.id_medico} value={m.id_medico}>{nombreMedico(m)}</option>)}
            </select>)}</FormField>
          <FormField label="Estado">{a => (
            <select {...a} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
              <option value="">Todos</option>
              {['Programada', 'Confirmada', 'Atendida', 'Cancelada', 'No asistió'].map(x => <option key={x}>{x}</option>)}
            </select>)}</FormField>
          <button type="submit" className="btn btn-primary">Filtrar</button>
        </FilterBar>
      </Card>
      <Card titulo="Citas" icono="calendario" descripcion="Agenda según los filtros aplicados.">
        <ErrorState error={lista.error} onReintentar={lista.recargar} />
        {lista.cargando ? <LoadingState /> : <DataTable titulo="Citas" columnas={columnas} filas={citas} claveFila={c => c.id_cita} vacio="Sin citas para los filtros seleccionados" />}
      </Card>
      {gestionar && (
        <Card titulo="Programar nueva cita" icono="mas">
          <form onSubmit={crear} noValidate>
            {envio.error && <Alerta titulo="No se pudo programar la cita">{envio.error.message}</Alerta>}
            {Object.keys(errores).length > 0 && <Alerta>Revise los campos marcados.</Alerta>}
            <div className="form-grid">
              <BuscadorPaciente value={nueva.id_paciente} onChange={v => setNueva({ ...nueva, id_paciente: v })} />
              <FormField label="Médico" error={errores.id_medico} required>{a => (
                <select {...a} value={nueva.id_medico} onChange={e => setNueva({ ...nueva, id_medico: e.target.value })}>
                  <option value="">Seleccione…</option>
                  {medicos.map(m => <option key={m.id_medico} value={m.id_medico}>{nombreMedico(m)} · {m.colegiado}</option>)}
                </select>)}</FormField>
              <FormField label="Fecha y hora" error={errores.fecha_hora} required>{a => <input {...a} type="datetime-local" min={localAhora()} value={nueva.fecha_hora} onChange={e => setNueva({ ...nueva, fecha_hora: e.target.value })} />}</FormField>
              <FormField label="Motivo" full>{a => <input {...a} value={nueva.motivo} onChange={e => setNueva({ ...nueva, motivo: e.target.value })} maxLength={255} />}</FormField>
              {errores.id_paciente && <div className="field full"><span className="error">{errores.id_paciente}</span></div>}
            </div>
            <div className="form-actions">
              <BotonEnviar enviando={envio.enviando} className="btn btn-primary">Programar cita</BotonEnviar>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}

function AccionesCita({ cita, onHecho }) {
  const { api } = useSesion();
  const confirmar = useConfirmar();
  const notificar = useNotificar();
  const envio = useEnvio();
  const cerrada = ['Atendida', 'Cancelada'].includes(cita.estado_cita);

  async function cambiar(estado) {
    if (estado === 'Cancelada') {
      const ok = await confirmar({ titulo: 'Cancelar cita', peligro: true, confirmar: 'Cancelar cita', mensaje: `Se cancelará la cita de ${cita.paciente} del ${fechaHora(cita.fecha_hora_cita)}.` });
      if (!ok) return;
    }
    const r = await envio.enviar(() => api.citas.cambiar(cita.id_cita, { estado_cita: estado }));
    if (r) { notificar(`Cita ${estado.toLowerCase()}`); onHecho(); }
  }

  if (cerrada) return <span className="meta">Sin acciones</span>;
  return (
    <div className="actions">
      {cita.estado_cita === 'Programada' && <button type="button" className="btn btn-sm" disabled={envio.enviando} onClick={() => cambiar('Confirmada')}>Confirmar</button>}
      <button type="button" className="btn btn-sm btn-danger" disabled={envio.enviando} onClick={() => cambiar('Cancelada')}>Cancelar</button>
    </div>
  );
}
