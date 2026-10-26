import { useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, Campo, Card, DataTable, Dialogo, EmptyState, ErrorState, LoadingState, StatusBadge, useCarga, useConfirmar, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { MedicoSelect } from '../../componentes/ClinicoCampos.jsx';
import { aIso, fecha, fechaHora, hoy, localAhora } from '@plataforma/formato.js';

// El sistema no define un calendario oficial: el personal programa cada dosis.
export default function VacunacionPaciente({ paciente, editable, medicos, vacunas, recargar: recargarPaciente }) {
  const { api, puede } = useSesion();
  const [estado, setEstado] = useState('');
  const { datos, cargando, error, recargar } = useCarga(() => api.vacunacion.esquema(paciente.id_paciente), [api, paciente]);
  const confirmar = useConfirmar();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [f, setF] = useState({ id_vacuna: '', numero_dosis: '1', fecha_programada: '' });
  const [aplicando, setAplicando] = useState(null);
  const puedeEscribir = editable && puede('clinico.escribir');
  const hoyIso = hoy();
  // Informativo: la fecha programada por el personal ya pasó (no es una regla clínica).
  const vencida = d => d.estado === 'Pendiente' && String(d.fecha_programada).slice(0, 10) < hoyIso;

  async function programar(e) {
    e.preventDefault();
    if (!f.id_vacuna || !f.fecha_programada || !(Number(f.numero_dosis) >= 1)) return envio.setError(new Error('Seleccione vacuna, número de dosis y fecha'));
    const r = await envio.enviar(() => api.vacunacion.programar(paciente.id_paciente, {
      id_vacuna: f.id_vacuna, numero_dosis: Number(f.numero_dosis), fecha_programada: `${f.fecha_programada}T00:00:00.000Z`
    }));
    if (r) { notificar('Dosis programada'); setF({ id_vacuna: '', numero_dosis: '1', fecha_programada: '' }); recargarPaciente(); }
  }
  async function cancelar(d) {
    const ok = await confirmar({ titulo: 'Cancelar dosis', peligro: true, confirmar: 'Cancelar dosis', mensaje: `La dosis ${d.numero_dosis} de ${d.vacuna || d.id_vacuna} quedará como Cancelada (no se elimina del historial).` });
    if (!ok) return;
    try {
      await api.vacunacion.cancelar(paciente.id_paciente, d.id_esquema, 'Cancelada por el personal médico');
      notificar('Dosis cancelada'); envio.setError(null); recargarPaciente();
    } catch (err) { notificar(err.message, 'error'); }
  }

  const lista = (datos || []).filter(d => !estado || d.estado === estado);
  const cuenta = k => (datos || []).filter(d => d.estado === k).length;

  return (
    <>
      {puedeEscribir && (
        <Card titulo="Programar dosis" descripcion="Una misma vacuna y número de dosis solo puede estar programada o aplicada una vez.">
          <form onSubmit={programar}>
            {envio.error && <Alerta>{envio.error.message}</Alerta>}
            <div className="form-grid">
              <Campo label="Vacuna" required>{a => (
                <select {...a} value={f.id_vacuna} onChange={e => { envio.setError(null); setF({ ...f, id_vacuna: e.target.value }); }}>
                  <option value="">Seleccione…</option>
                  {vacunas.map(v => <option key={v.id_vacuna} value={v.id_vacuna}>{v.nombre} ({v.id_vacuna})</option>)}
                </select>)}
              </Campo>
              <Campo label="Número de dosis" required>{a => <input {...a} type="number" min="1" max="20" step="1" value={f.numero_dosis} onChange={e => { envio.setError(null); setF({ ...f, numero_dosis: e.target.value }); }} />}</Campo>
              <Campo label="Fecha programada" required>{a => <input {...a} type="date" min={String(paciente.fecha_nacimiento).slice(0, 10)} value={f.fecha_programada} onChange={e => { envio.setError(null); setF({ ...f, fecha_programada: e.target.value }); }} />}</Campo>
            </div>
            <div className="form-actions"><BotonEnviar enviando={envio.enviando}>Programar</BotonEnviar></div>
          </form>
        </Card>
      )}
      <Card titulo="Esquema de vacunación" descripcion="Dosis programadas por el personal. Las canceladas se conservan en el historial; una dosis aplicada no puede volver a aplicarse."
        acciones={(
          <div className="segmented" role="group" aria-label="Filtrar por estado">
            {[['', 'Todas', (datos || []).length], ['Pendiente', 'Pendientes', cuenta('Pendiente')], ['Aplicada', 'Aplicadas', cuenta('Aplicada')], ['Cancelada', 'Canceladas', cuenta('Cancelada')]].map(([k, t, n]) => (
              <button key={k} type="button" aria-pressed={estado === k} onClick={() => setEstado(k)}>{t} ({n})</button>
            ))}
          </div>
        )}>
        {cargando ? <LoadingState /> : error ? <ErrorState error={error} onReintentar={recargar} /> : lista.length === 0 ? <EmptyState icono="vacuna" titulo="Sin dosis en esta vista" /> : (
          <DataTable titulo="Esquema de vacunación" filas={lista} claveFila={d => d.id_esquema} resaltar={vencida} columnas={[
            { clave: 'vacuna', titulo: 'Vacuna', principal: true, render: d => <><b>{d.vacuna || d.id_vacuna}</b><div className="cell-sub">Dosis {d.numero_dosis} · <code>{d.id_esquema}</code></div></> },
            { clave: 'programada', titulo: 'Programada', render: d => fecha(d.fecha_programada) },
            { clave: 'estado', titulo: 'Estado', render: d => <>
              <StatusBadge>{d.estado}</StatusBadge>{vencida(d) && <> <StatusBadge>Vencida</StatusBadge></>}
              {d.motivo_cancelacion && <div className="cell-sub">{d.motivo_cancelacion}</div>}
              {vencida(d) && <div className="cell-sub">La fecha programada ya pasó</div>}
            </> },
            { clave: 'aplicacion', titulo: 'Fecha de aplicación', render: d => (d.fecha_aplicacion ? <>{fechaHora(d.fecha_aplicacion)}{d.aplicado_por && <div className="cell-sub">Registró {d.aplicado_por.id_usuario}</div>}</> : '—') },
            { clave: 'lote', titulo: 'Lote', render: d => (d.lote ? <code>{d.lote}</code> : '—') },
            { clave: 'medico', titulo: 'Médico que aplicó', render: d => d.medico || '—' },
            ...(puedeEscribir ? [{ clave: 'acciones', titulo: '', render: d => d.estado === 'Pendiente' && (
              <div className="actions">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setAplicando(d)}>Aplicar</button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => cancelar(d)}>Cancelar</button>
              </div>
            ) }] : [])
          ]} />
        )}
      </Card>
      <DialogoAplicar dosis={aplicando} paciente={paciente} medicos={medicos} onCerrar={() => setAplicando(null)} onHecho={() => { setAplicando(null); envio.setError(null); recargarPaciente(); }} />
    </>
  );
}

function DialogoAplicar({ dosis, paciente, medicos, onCerrar, onHecho }) {
  const { api } = useSesion();
  const notificar = useNotificar();
  const confirmar = useConfirmar();
  const envio = useEnvio();
  const [f, setF] = useState({ fecha_aplicacion: localAhora(), lote: '', id_medico: '' });
  const [previo, setPrevio] = useState(null);
  if (dosis !== previo) { setPrevio(dosis); if (dosis) { setF({ fecha_aplicacion: localAhora(), lote: '', id_medico: '' }); envio.setError(null); } }

  async function enviar(e) {
    e.preventDefault();
    if (!f.fecha_aplicacion || !f.lote.trim() || !f.id_medico) return envio.setError(new Error('Fecha, lote y médico son obligatorios'));
    if (new Date(f.fecha_aplicacion) > new Date(Date.now() + 5 * 60000)) return envio.setError(new Error('La fecha de aplicación no puede estar en el futuro'));
    if (f.fecha_aplicacion.slice(0, 10) < String(paciente.fecha_nacimiento).slice(0, 10)) return envio.setError(new Error('La fecha es anterior al nacimiento'));
    const ok = await confirmar({ titulo: 'Confirmar aplicación', confirmar: 'Registrar aplicación', mensaje: `Se registrará como aplicada la dosis ${dosis.numero_dosis} de ${dosis.vacuna || dosis.id_vacuna} (lote ${f.lote.trim()}). Una dosis aplicada no puede volver a aplicarse.` });
    if (!ok) return;
    const r = await envio.enviar(() => api.vacunacion.aplicar(paciente.id_paciente, dosis.id_esquema, { fecha_aplicacion: aIso(f.fecha_aplicacion), lote: f.lote.trim(), id_medico: f.id_medico }));
    if (r) { notificar('Aplicación registrada'); onHecho(); }
  }
  return (
    <Dialogo abierto={!!dosis} titulo="Registrar aplicación" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <p className="meta mb-3">{dosis?.vacuna || dosis?.id_vacuna} · dosis {dosis?.numero_dosis} · programada {fecha(dosis?.fecha_programada)}</p>
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        <div className="form-grid">
          <Campo label="Fecha y hora de aplicación" required>{a => <input {...a} type="datetime-local" max={localAhora(5)} min={`${String(paciente.fecha_nacimiento).slice(0, 10)}T00:00`} value={f.fecha_aplicacion} onChange={e => setF({ ...f, fecha_aplicacion: e.target.value })} />}</Campo>
          <Campo label="Lote" required>{a => <input {...a} value={f.lote} onChange={e => setF({ ...f, lote: e.target.value })} maxLength={60} />}</Campo>
          <MedicoSelect medicos={medicos} value={f.id_medico} onChange={v => setF({ ...f, id_medico: v })} />
        </div>
        <div className="form-actions"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><BotonEnviar enviando={envio.enviando}>Registrar</BotonEnviar></div>
      </form>
    </Dialogo>
  );
}
