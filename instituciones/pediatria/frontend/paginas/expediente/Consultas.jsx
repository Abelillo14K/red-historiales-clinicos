import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, Campo, Card, ContextPanel, Dialogo, EmptyState, ErrorState, FilterBar, FormField, Icon, LoadingState, MetricStrip, SectionIntro, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { MedicamentosEditor, medicamentoCompleto, medicamentoVacio, recortar } from '../../componentes/ClinicoCampos.jsx';
import { fechaHora, fechaLocal } from '@plataforma/formato.js';

const hora = v => new Date(v).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
const CAMPOS_MED = [['dosis', 'Dosis'], ['frecuencia', 'Frecuencia'], ['duracion', 'Duración'], ['via_administracion', 'Vía']];

// Receta con medicamentos etiquetados (lo registrado por el médico, sin interpretación).
export function Receta({ rx }) {
  return (
    <div className="rx">
      <div className="rx-head">
        <span className="meta"><Icon name="receta" size={14} /><b>Receta</b> <code>{rx.id_prescripcion}</code></span>
        <span className="meta">Emitida {fechaHora(rx.fecha_emision)} · {rx.medicamentos.length} {rx.medicamentos.length === 1 ? 'medicamento' : 'medicamentos'}</span>
      </div>
      {rx.indicaciones_generales && <p className="rx-ind"><b>Indicaciones:</b> {rx.indicaciones_generales}</p>}
      <div className="med-grid">
        {rx.medicamentos.map((m, i) => (
          <dl className="med" key={m.id_medicamento || i}>
            <div><dt>Medicamento</dt><dd><b>{m.nombre}</b></dd></div>
            {CAMPOS_MED.map(([k, t]) => <div key={k}><dt>{t}</dt><dd>{m[k]}</dd></div>)}
          </dl>
        ))}
      </div>
    </div>
  );
}

export default function Consultas({ paciente, editable }) {
  const { api, puede, modulo } = useSesion();
  const [rango, setRango] = useState({ desde: '', hasta: '' }); // fechas locales YYYY-MM-DD
  const filtrado = Boolean(rango.desde || rango.hasta);
  const rangoIso = {
    desde: rango.desde ? new Date(`${rango.desde}T00:00:00`).toISOString() : undefined,
    hasta: rango.hasta ? new Date(`${rango.hasta}T23:59:59.999`).toISOString() : undefined
  };
  const { datos, cargando, error, recargar } = useCarga(() => api.consultas.listar(paciente.id_paciente, rangoIso),
    [api, paciente, rango.desde, rango.hasta]);
  const [dialogo, setDialogo] = useState(null); // {tipo, consulta}
  const puedeEscribir = editable && puede('clinico.escribir');
  const cerrar = () => setDialogo(null);
  const hecho = () => { setDialogo(null); recargar(); };

  return (
    <>
      <SectionIntro titulo="Consultas y evolución" descripcion="Todas las atenciones, con sus diagnósticos, tratamientos y prescripciones." icono="consulta" />
      <MetricStrip items={[
        { etiqueta: 'Consultas en el historial', valor: paciente.consultas.length, icono: 'consulta' },
        { etiqueta: 'Consultas en esta vista', valor: datos?.length, icono: 'calendario' },
        { etiqueta: 'Modo del expediente', valor: puedeEscribir ? 'Editable' : 'Solo lectura', icono: 'auditoria' }
      ]} />
      <div className="workspace-grid"><div className="workspace-main">
      <Card titulo="Historial de consultas" icono="calendario" descripcion="Orden cronológico, de la más reciente a la más antigua.">
        <FilterBar etiqueta="Filtrar consultas por fecha" resumen={datos && <span role="status">{datos.length} {datos.length === 1 ? 'consulta' : 'consultas'}{filtrado ? ' en el rango' : ''}</span>}>
          <FormField label="Desde">{a => <input {...a} type="date" value={rango.desde} max={rango.hasta || undefined} onChange={e => setRango(r => ({ ...r, desde: e.target.value }))} />}</FormField>
          <FormField label="Hasta">{a => <input {...a} type="date" value={rango.hasta} min={rango.desde || undefined} onChange={e => setRango(r => ({ ...r, hasta: e.target.value }))} />}</FormField>
          {filtrado && <button type="button" className="btn btn-sm" onClick={() => setRango({ desde: '', hasta: '' })}>Quitar filtro</button>}
        </FilterBar>
        {cargando ? <LoadingState /> : error ? <ErrorState error={error} onReintentar={recargar} /> : datos.length === 0 && (
          <EmptyState icono="consulta" titulo={filtrado ? 'Sin consultas en el rango de fechas indicado' : 'Sin consultas registradas'}
            accion={!filtrado && puedeEscribir && <Link className="btn btn-primary" to={`/pacientes/${paciente.id_paciente}/consultas/nueva`}>Registrar la primera consulta</Link>} />
        )}
      </Card>

      {!cargando && !error && datos.length > 0 && (
        <ol className="timeline" aria-label="Consultas">
          {datos.map(c => {
            const dx = c.diagnosticos || [], rxs = c.prescripciones || [], previas = c.tratamientos_anteriores || [];
            return (
              <li className="consulta" key={c.id_consulta}>
                <div className="consulta-fecha"><b>{fechaLocal(c.fecha_hora)}</b><span>{hora(c.fecha_hora)}</span></div>
                <article className="consulta-card" aria-labelledby={`c-${c.id_consulta}`}>
                  <header className="consulta-head">
                    <div>
                      <h3 id={`c-${c.id_consulta}`}>{c.motivo}</h3>
                      <p className="consulta-medico">
                        <Icon name="medico" size={15} />
                        {c.medico ? <span>{c.medico.nombres} {c.medico.apellidos}{c.medico.especialidad && <> · {c.medico.especialidad}</>}</span> : <code>{c.id_medico}</code>}
                      </p>
                    </div>
                    {puedeEscribir && (
                      <div className="actions">
                        <button type="button" className="btn btn-sm" onClick={() => setDialogo({ tipo: 'dx', consulta: c })}>+ Diagnóstico</button>
                        <button type="button" className="btn btn-sm" onClick={() => setDialogo({ tipo: 'tx', consulta: c })}>{c.tratamiento ? 'Editar tratamiento' : '+ Tratamiento'}</button>
                        <button type="button" className="btn btn-sm" onClick={() => setDialogo({ tipo: 'rx', consulta: c })}>+ Prescripción</button>
                      </div>
                    )}
                  </header>
                  <div className="consulta-body">
                    {c.observaciones && <p className="consulta-obs">{c.observaciones}</p>}
                    <div className="consulta-grid">
                      <div className="consulta-seccion">
                        <h4 className="section-label"><Icon name="diagnostico" size={14} />Diagnósticos {dx.length > 0 && <span className="tab-count">{dx.length}</span>}</h4>
                        {dx.length ? (
                          <div className="chips">{dx.map(d => <span className="badge plain wrap" key={d.codigo} title={d.descripcion}><b>{d.codigo}</b>&nbsp;{d.descripcion}</span>)}</div>
                        ) : <p className="meta">Sin diagnósticos registrados</p>}
                      </div>
                      <div className="consulta-seccion">
                        <h4 className="section-label"><Icon name="consulta" size={14} />Tratamiento</h4>
                        {c.tratamiento ? (
                          <div className="tratamiento">
                            <p>{c.tratamiento.descripcion}</p>
                            {c.tratamiento.recomendaciones && <p className="meta">{c.tratamiento.recomendaciones}</p>}
                          </div>
                        ) : <p className="meta">Sin tratamiento registrado</p>}
                        {previas.length > 0 && (
                          <details className="mt-2">
                            <summary className="meta">Versiones anteriores del tratamiento ({previas.length})</summary>
                            <ul className="version-list">{previas.map((t, i) => (
                              <li key={i}>{t.descripcion}{t.recomendaciones && ` — ${t.recomendaciones}`}<div className="cell-sub">Reemplazado el {fechaHora(t.reemplazado_por?.fecha)} por {t.reemplazado_por?.id_usuario}</div></li>
                            ))}</ul>
                          </details>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="section-label"><Icon name="receta" size={14} />Prescripciones {rxs.length > 0 && <span className="tab-count">{rxs.length}</span>}</h4>
                      {rxs.length ? rxs.map(rx => <Receta key={rx.id_prescripcion} rx={rx} />) : <p className="meta">Sin prescripciones</p>}
                    </div>
                  </div>
                  <footer className="registro">
                    <span>Consulta <code>{c.id_consulta}</code></span>
                    {c.registrado_por && <span>Registrada por {c.registrado_por.id_usuario} ({modulo.roles[c.registrado_por.rol] || c.registrado_por.rol}) · {fechaHora(c.registrado_por.fecha)}</span>}
                  </footer>
                </article>
              </li>
            );
          })}
        </ol>
      )}
      </div><aside className="workspace-aside" aria-label="Contexto de consultas">
        <ContextPanel titulo="Esta vista" icono="consulta" items={[
          ['Paciente', paciente.id_paciente], ['Rango', filtrado ? 'Filtro aplicado' : 'Historial completo'],
          ['Orden', 'Más reciente primero']
        ]} />
        <ContextPanel titulo="Continuidad del historial" icono="auditoria" descripcion="Cada consulta conserva el profesional responsable, los medicamentos registrados y las versiones anteriores de sus tratamientos." />
      </aside></div>
      <DialogoDiagnostico estado={dialogo?.tipo === 'dx' ? dialogo : null} paciente={paciente} onCerrar={cerrar} onHecho={hecho} />
      <DialogoTratamiento estado={dialogo?.tipo === 'tx' ? dialogo : null} paciente={paciente} onCerrar={cerrar} onHecho={hecho} />
      <DialogoPrescripcion abierto={dialogo?.tipo === 'rx'} consultas={dialogo ? [dialogo.consulta] : []} paciente={paciente} onCerrar={cerrar} onHecho={hecho} />
    </>
  );
}

function DialogoDiagnostico({ estado, paciente, onCerrar, onHecho }) {
  const { api } = useSesion();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [d, setD] = useState({ codigo: '', descripcion: '' });
  const [previo, setPrevio] = useState(null);
  if (estado !== previo) { setPrevio(estado); setD({ codigo: '', descripcion: '' }); envio.setError(null); }
  async function enviar(e) {
    e.preventDefault();
    if (!d.codigo.trim() || !d.descripcion.trim()) return envio.setError(new Error('Código y descripción son obligatorios'));
    const r = await envio.enviar(() => api.consultas.agregarDiagnostico(paciente.id_paciente, estado.consulta.id_consulta, recortar(d)));
    if (r) { notificar('Diagnóstico agregado'); onHecho(); }
  }
  return (
    <Dialogo abierto={!!estado} titulo="Agregar diagnóstico" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <p className="meta mb-3">Consulta: {estado?.consulta.motivo} ({fechaHora(estado?.consulta.fecha_hora)})</p>
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        <div className="form-grid">
          <Campo label="Código" required>{a => <input {...a} value={d.codigo} onChange={e => setD({ ...d, codigo: e.target.value })} maxLength={20} />}</Campo>
          <Campo label="Descripción" required full>{a => <input {...a} value={d.descripcion} onChange={e => setD({ ...d, descripcion: e.target.value })} maxLength={255} />}</Campo>
        </div>
        <div className="form-actions"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><BotonEnviar enviando={envio.enviando}>Agregar</BotonEnviar></div>
      </form>
    </Dialogo>
  );
}

function DialogoTratamiento({ estado, paciente, onCerrar, onHecho }) {
  const { api } = useSesion();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [t, setT] = useState({ descripcion: '', recomendaciones: '' });
  const [previo, setPrevio] = useState(null);
  if (estado !== previo) {
    setPrevio(estado);
    setT({ descripcion: estado?.consulta.tratamiento?.descripcion || '', recomendaciones: estado?.consulta.tratamiento?.recomendaciones || '' });
    envio.setError(null);
  }
  async function enviar(e) {
    e.preventDefault();
    if (!t.descripcion.trim()) return envio.setError(new Error('La descripción es obligatoria'));
    const cuerpo = { descripcion: t.descripcion.trim() };
    if (t.recomendaciones.trim()) cuerpo.recomendaciones = t.recomendaciones.trim();
    const r = await envio.enviar(() => api.consultas.establecerTratamiento(paciente.id_paciente, estado.consulta.id_consulta, cuerpo));
    if (r) { notificar('Tratamiento guardado'); onHecho(); }
  }
  return (
    <Dialogo abierto={!!estado} titulo={estado?.consulta.tratamiento ? 'Actualizar tratamiento' : 'Agregar tratamiento'} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        {estado?.consulta.tratamiento && <Alerta tipo="info">El tratamiento vigente pasará al historial de versiones anteriores de la consulta (no se pierde) y el cambio queda en la bitácora.</Alerta>}
        <Campo label="Descripción" required>{a => <textarea {...a} value={t.descripcion} onChange={e => setT({ ...t, descripcion: e.target.value })} maxLength={255} />}</Campo>
        <div className="mt-4"><Campo label="Recomendaciones">{a => <textarea {...a} value={t.recomendaciones} onChange={e => setT({ ...t, recomendaciones: e.target.value })} maxLength={1000} />}</Campo></div>
        <div className="form-actions"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><BotonEnviar enviando={envio.enviando}>Guardar</BotonEnviar></div>
      </form>
    </Dialogo>
  );
}

// Reutilizado en la pestaña Prescripciones (permite elegir la consulta).
export function DialogoPrescripcion({ abierto, consultas, paciente, onCerrar, onHecho }) {
  const { api } = useSesion();
  const notificar = useNotificar();
  const envio = useEnvio();
  const vacia = () => ({ id_consulta: consultas.length === 1 ? consultas[0].id_consulta : '', indicaciones_generales: '', medicamentos: [medicamentoVacio()] });
  const [rx, setRx] = useState(vacia);
  const [previo, setPrevio] = useState(false);
  if (abierto !== previo) { setPrevio(abierto); if (abierto) { setRx(vacia()); envio.setError(null); } }

  async function enviar(e) {
    e.preventDefault();
    if (!rx.id_consulta) return envio.setError(new Error('Seleccione la consulta'));
    if (!rx.medicamentos.every(medicamentoCompleto)) return envio.setError(new Error('Complete todos los campos de cada medicamento'));
    const cuerpo = { medicamentos: rx.medicamentos.map(recortar) };
    if (rx.indicaciones_generales.trim()) cuerpo.indicaciones_generales = rx.indicaciones_generales.trim();
    const r = await envio.enviar(() => api.consultas.agregarPrescripcion(paciente.id_paciente, rx.id_consulta, cuerpo));
    if (r) { notificar(`Prescripción ${r.id_prescripcion} registrada`); onHecho(); }
  }
  return (
    <Dialogo abierto={abierto} ancho titulo="Registrar prescripción" onCerrar={onCerrar}>
      <form onSubmit={enviar} noValidate>
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        <p className="meta mb-3">Registre lo indicado por el médico. El sistema no sugiere medicamentos ni dosis. La fecha de emisión es la actual.</p>
        {consultas.length > 1 && (
          <div className="mb-3"><Campo label="Consulta asociada" required>{a => (
            <select {...a} value={rx.id_consulta} onChange={e => setRx({ ...rx, id_consulta: e.target.value })}>
              <option value="">Seleccione…</option>
              {consultas.map(c => <option key={c.id_consulta} value={c.id_consulta}>{fechaHora(c.fecha_hora)} — {c.motivo}</option>)}
            </select>)}</Campo></div>
        )}
        <Campo label="Indicaciones generales">{a => <textarea {...a} value={rx.indicaciones_generales} onChange={e => setRx({ ...rx, indicaciones_generales: e.target.value })} maxLength={1000} />}</Campo>
        <div className="mt-4"><MedicamentosEditor lista={rx.medicamentos} onChange={m => setRx({ ...rx, medicamentos: m })} /></div>
        <div className="form-actions"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><BotonEnviar enviando={envio.enviando}>Registrar prescripción</BotonEnviar></div>
      </form>
    </Dialogo>
  );
}
