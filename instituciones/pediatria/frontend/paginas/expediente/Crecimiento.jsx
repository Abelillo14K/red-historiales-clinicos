import { useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, Campo, Card, DataTable, EmptyState, ErrorState, Icon, LoadingState, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import GraficaCrecimiento from '../../componentes/GraficaCrecimiento.jsx';
import { LIMITES_MEDICION as LIMITES, medicionParaApi, validarMedicion } from '../../componentes/ClinicoCampos.jsx';
import { aIso, fechaHora, localAhora } from '@plataforma/formato.js';

export default function Crecimiento({ paciente, editable, recargar: recargarPaciente }) {
  const { api, puede, sesion } = useSesion();
  const perimetroOpcional = Boolean(sesion?.capacidades?.perimetro_cefalico_opcional);
  const { datos, cargando, error, recargar } = useCarga(() => api.crecimiento.listar(paciente.id_paciente), [api, paciente]);
  const notificar = useNotificar();
  const envio = useEnvio();
  const consultas = [...(paciente.consultas || [])].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  const vacio = () => ({ id_consulta: consultas[0]?.id_consulta || '', fecha: '', peso_kg: '', talla_cm: '', perimetro_cefalico_cm: '' });
  const [f, setF] = useState(vacio);
  const [errores, setErrores] = useState({});
  const puedeRegistrar = editable && puede('clinico.escribir');

  async function enviar(e) {
    e.preventDefault();
    const err = validarMedicion(f, perimetroOpcional);
    if (!f.id_consulta) err.id_consulta = 'Seleccione la consulta';
    if (f.fecha && new Date(f.fecha) > new Date(Date.now() + 5 * 60000)) err.fecha = 'No puede estar en el futuro';
    setErrores(err);
    if (Object.keys(err).length) return;
    const cuerpo = { id_consulta: f.id_consulta, ...medicionParaApi(f) };
    if (f.fecha) cuerpo.fecha = aIso(f.fecha);
    const r = await envio.enviar(() => api.crecimiento.registrar(paciente.id_paciente, cuerpo));
    if (r) { notificar('Control de crecimiento registrado'); setF(vacio()); recargarPaciente(); }
  }
  const num = (k, label) => (
    <Campo label={label} error={errores[k]} required={k !== 'perimetro_cefalico_cm' || !perimetroOpcional}
      hint={k === 'perimetro_cefalico_cm' && perimetroOpcional ? 'Opcional: registrar si corresponde' : undefined}>
      {a => <input {...a} type="number" inputMode="decimal" step="0.1" min="0.1" max={LIMITES[k]} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />}
    </Campo>
  );

  return (
    <>
      {puedeRegistrar && (
        <Card titulo="Registrar medición" descripcion="Cada control se asocia a una consulta existente y se agrega al historial sin reemplazar mediciones anteriores.">
          {consultas.length === 0 ? <Alerta tipo="info">Cada control debe asociarse a una consulta existente. Registre primero una consulta.</Alerta> : (
            <form onSubmit={enviar} noValidate>
              {envio.error && <Alerta>{envio.error.message}</Alerta>}
              <div className="form-grid">
                <Campo label="Consulta asociada" error={errores.id_consulta} required>{a => (
                  <select {...a} value={f.id_consulta} onChange={e => setF({ ...f, id_consulta: e.target.value })}>
                    {consultas.map(c => <option key={c.id_consulta} value={c.id_consulta}>{fechaHora(c.fecha_hora)} — {c.motivo}</option>)}
                  </select>)}
                </Campo>
                <Campo label="Fecha de medición" error={errores.fecha} hint="Vacío = fecha de la consulta">{a => <input {...a} type="datetime-local" max={localAhora(5)} value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} />}</Campo>
                {num('peso_kg', 'Peso (kg)')}{num('talla_cm', 'Talla (cm)')}{num('perimetro_cefalico_cm', 'Perímetro cefálico (cm)')}
              </div>
              <div className="form-actions"><BotonEnviar enviando={envio.enviando}>Guardar medición</BotonEnviar></div>
            </form>
          )}
        </Card>
      )}
      {cargando ? <LoadingState /> : error ? <ErrorState error={error} onReintentar={recargar} /> : datos.length === 0 ? (
        <Card><EmptyState icono="crecimiento" titulo="Sin controles de crecimiento">Las mediciones se conservan como historial; nunca se sobrescriben.</EmptyState></Card>
      ) : <>
        <section className="charts" aria-label="Evolución de las mediciones registradas">
          <GraficaCrecimiento datos={datos} campo="peso_kg" titulo="Peso" unidad="kg" />
          <GraficaCrecimiento datos={datos} campo="talla_cm" titulo="Talla" unidad="cm" />
          <GraficaCrecimiento datos={datos} campo="perimetro_cefalico_cm" titulo="Perímetro cefálico" unidad="cm" />
        </section>
        <p className="meta charts-note"><Icon name="info" size={14} /> Las gráficas muestran únicamente las mediciones registradas en este historial. No son curvas de crecimiento de referencia (p. ej., OMS) ni calculan percentiles.</p>
        <Card titulo="Historial de mediciones" descripcion="Orden cronológico. La edad se calcula a la fecha de cada medición." >
          <DataTable titulo="Historial de mediciones" filas={datos} claveFila={c => c.id_control} columnas={[
            { clave: 'fecha', titulo: 'Fecha', render: c => fechaHora(c.fecha) },
            { clave: 'edad', titulo: 'Edad a la medición', render: c => (typeof c.edad_meses === 'number' ? `${c.edad_meses} ${c.edad_meses === 1 ? 'mes' : 'meses'}` : '—') },
            { clave: 'peso', titulo: 'Peso (kg)', num: true, render: c => c.peso_kg },
            { clave: 'talla', titulo: 'Talla (cm)', num: true, render: c => c.talla_cm },
            { clave: 'pc', titulo: 'Perímetro cefálico (cm)', num: true, render: c => c.perimetro_cefalico_cm ?? <span className="meta" title="No registrado">—</span> },
            { clave: 'consulta', titulo: 'Consulta', render: c => (c.id_consulta ? <code>{c.id_consulta}</code> : '—') }
          ]} />
        </Card>
      </>}
    </>
  );
}
