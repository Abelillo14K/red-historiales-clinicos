import { useState } from 'react';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, FormField, Icon, KeyValue, StatusBadge, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import { ARCADAS, ESTADOS_PIEZA, TONO_PIEZA } from './formato.js';

// Odontograma con numeración FDI. Cada pieza muestra el estado que registró el odontólogo y su
// último tratamiento; el sistema no sugiere diagnósticos ni tratamientos.
export default function PiezasDentales({ paciente, editable, onCambio }) {
  const [denticion, setDenticion] = useState('permanentes');
  const [elegida, setElegida] = useState(null);
  const piezas = paciente.piezas || {};
  const registradas = Object.keys(piezas).length;

  return <>
    <div className="actions">
      <div className="chips" role="group" aria-label="Dentición">
        {[['permanentes', 'Permanente'], ['temporales', 'Temporal']].map(([k, t]) =>
          <button key={k} type="button" className={`btn btn-sm${denticion === k ? ' btn-primary' : ''}`} aria-pressed={denticion === k} onClick={() => setDenticion(k)}>{t}</button>)}
      </div>
      <span className="meta">{registradas} {registradas === 1 ? 'pieza con registros' : 'piezas con registros'}</span>
    </div>
    <div className="dental-map" aria-label="Odontograma">
      {ARCADAS[denticion].map((arcada, fila) => <div key={arcada.titulo}>
        {fila > 0 && <hr className="dental-divider" />}
        <p className="section-label">{arcada.titulo} · derecha del paciente → izquierda</p>
        <div className="dental-arch" style={{ gridTemplateColumns: `repeat(${arcada.piezas.length / 2}, minmax(0, 1fr))` }}>
          {arcada.piezas.map(n => {
            const p = piezas[n];
            return <button type="button" key={n} className="dental-piece" aria-pressed={elegida === n} onClick={() => setElegida(n)}
              aria-label={`Pieza ${n}${p?.estado ? `: ${p.estado}` : ''}`}>
              <Icon name="diente" size={24} /><b>{n}</b>
              {p?.estado ? <StatusBadge tono={TONO_PIEZA[p.estado]} sinPunto>{p.estado}</StatusBadge> : <small>{p?.ultimo_tratamiento ? 'Tratada' : 'Sin datos'}</small>}
            </button>;
          })}
        </div>
      </div>)}
    </div>
    <p className="dental-legend">Numeración FDI. El estado lo registra el odontólogo; «Tratada» indica un tratamiento sin estado registrado.</p>
    {elegida && <DetallePieza key={elegida} paciente={paciente} pieza={elegida} editable={editable} onCambio={onCambio} />}
  </>;
}

function DetallePieza({ paciente, pieza, editable, onCambio }) {
  const { api } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const p = paciente.piezas?.[pieza] || {};
  const [estado, setEstado] = useState(p.estado || '');
  const [observaciones, setObservaciones] = useState(p.observaciones || '');

  async function guardar(e) {
    e.preventDefault();
    if (!estado) return envio.setError(new Error('Elija el estado de la pieza'));
    if (await envio.enviar(() => api.pacientes.actualizarPieza(paciente.id_paciente, pieza, { estado, observaciones: observaciones.trim() || null }))) {
      notificar(`Pieza ${pieza}: ${estado}`);
      onCambio();
    }
  }

  return <section className="card mt-4" aria-label={`Pieza ${pieza}`}>
    <h3>Pieza {pieza}</h3>
    <KeyValue items={[
      ['Estado registrado', p.estado], ['Observaciones', p.observaciones],
      ['Último tratamiento', p.ultimo_tratamiento ? `${p.ultimo_tratamiento.procedimiento} · ${fechaHora(p.ultimo_tratamiento.fecha)}` : null],
      ['Actualizado', p.actualizado ? `${fechaHora(p.actualizado)} por ${p.actualizado_por}` : null]
    ]} />
    {editable && <form onSubmit={guardar} className="stack mt-4">
      {envio.error && <Alerta>{envio.error.message}</Alerta>}
      <div className="form-grid">
        <FormField label="Estado de la pieza" required>{a => (
          <select {...a} value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Seleccione…</option>{ESTADOS_PIEZA.map(x => <option key={x}>{x}</option>)}
          </select>)}</FormField>
        <FormField label="Observaciones">{a => <input {...a} maxLength={300} value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Superficie, detalle…" />}</FormField>
      </div>
      <BotonEnviar enviando={envio.enviando}>Guardar estado de la pieza</BotonEnviar>
    </form>}
  </section>;
}
