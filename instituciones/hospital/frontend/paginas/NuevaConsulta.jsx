import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, ErrorState, FormField, FormSteps, FormSummary, Icon, LoadingState, PageHeader, SectionHeading, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { localAhora } from '@plataforma/formato.js';

const SIGNOS = [
  ['presion_sistolica', 'P. sistólica (mmHg)'],
  ['presion_diastolica', 'P. diastólica (mmHg)'],
  ['frecuencia_cardiaca', 'Frec. cardíaca (lpm)'],
  ['frecuencia_respiratoria', 'Frec. respiratoria (rpm)'],
  ['temperatura', 'Temperatura (°C)'],
  ['saturacion_oxigeno', 'Saturación O₂ (%)'],
  ['peso', 'Peso (kg)'],
  ['talla', 'Talla (m)']
];
const signosVacios = () => Object.fromEntries(SIGNOS.map(([k]) => [k, '']));
const diagnosticoVacio = () => ({ id_diagnostico: '', tipo: 'Principal', observaciones: '' });
const medicamentoVacio = () => ({ id_medicamento: '', dosis: '', frecuencia: '', duracion: '', via_administracion: '', observaciones: '' });
const nombreMedico = m => [m.primer_nombre, m.segundo_nombre, m.primer_apellido, m.segundo_apellido].filter(Boolean).join(' ');

export default function NuevaConsulta() {
  const { id } = useParams();
  const { api } = useSesion();
  const { enlace } = useModulo();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const datos = useCarga(() => Promise.all([
    api.pacientes.obtener(id),
    api.catalogos.listar('profesionales', { limite: 500 }),
    api.catalogos.listar('diagnosticos', { limite: 500 }),
    api.catalogos.listar('medicamentos', { limite: 500 }),
    api.catalogos.listar('examenes', { limite: 500 })
  ]), [api, id]);
  const [f, setF] = useState({ id_medico: '', fecha_hora: localAhora(), tipo_consulta: 'Directa', motivo: '', anamnesis: '', examen_fisico: '', plan_tratamiento: '', observaciones: '' });
  const [signos, setSignos] = useState(signosVacios);
  const [diagnosticos, setDiagnosticos] = useState([diagnosticoVacio()]);
  const [conReceta, setConReceta] = useState(false);
  const [receta, setReceta] = useState({ indicaciones_generales: '', medicamentos: [medicamentoVacio()] });
  const [examenes, setExamenes] = useState([]);
  const [errores, setErrores] = useState({});

  if (datos.cargando) return <LoadingState texto="Cargando el expediente…" />;
  if (datos.error) return <ErrorState error={datos.error} onReintentar={datos.recargar} />;

  const [expediente, profesionales, diagnosticosCat, medicamentosCat, examenesCat] = datos.datos;
  const paciente = expediente.paciente;
  const medicos = profesionales.items.filter(m => m.estado === 'Activo');
  const cambiar = (k, v) => setF(x => ({ ...x, [k]: v }));
  const cambiarSigno = (k, v) => setSignos(x => ({ ...x, [k]: v }));
  const cambiarDiagnostico = (i, k, v) => setDiagnosticos(xs => xs.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const cambiarMedicamento = (i, k, v) => setReceta(x => ({ ...x, medicamentos: x.medicamentos.map((m, j) => j === i ? { ...m, [k]: v } : m) }));

  function validar() {
    const e = {};
    if (!f.id_medico) e.id_medico = 'Seleccione el médico responsable';
    if (!f.fecha_hora) e.fecha_hora = 'Obligatorio';
    const dx = diagnosticos.filter(d => d.id_diagnostico);
    if (new Set(dx.map(d => d.id_diagnostico)).size !== dx.length) e.diagnosticos = 'Hay diagnósticos repetidos';
    if (conReceta) {
      const meds = receta.medicamentos.filter(m => m.id_medicamento || m.dosis.trim() || m.frecuencia.trim());
      if (!meds.length) e.receta = 'Agregue al menos un medicamento';
      else if (meds.some(m => !m.id_medicamento || !m.dosis.trim() || !m.frecuencia.trim())) e.receta = 'Complete medicamento, dosis y frecuencia en cada fila';
      else if (new Set(meds.map(m => m.id_medicamento)).size !== meds.length) e.receta = 'Hay medicamentos repetidos';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const cuerpo = {
      id_medico: Number(f.id_medico),
      fecha_hora: f.fecha_hora,
      tipo_consulta: f.tipo_consulta,
      motivo: f.motivo.trim(),
      anamnesis: f.anamnesis.trim(),
      examen_fisico: f.examen_fisico.trim(),
      plan_tratamiento: f.plan_tratamiento.trim(),
      observaciones: f.observaciones.trim(),
      diagnosticos: diagnosticos.filter(d => d.id_diagnostico).map(d => ({
        id_diagnostico: Number(d.id_diagnostico),
        tipo: d.tipo,
        observaciones: d.observaciones.trim()
      })),
      examenes: examenes.map(Number)
    };
    const vitales = Object.fromEntries(SIGNOS.map(([k]) => [k, signos[k]]).filter(([, v]) => String(v).trim() !== '').map(([k, v]) => [k, Number(v)]));
    if (Object.keys(vitales).length) cuerpo.signos_vitales = vitales;
    if (conReceta) cuerpo.prescripcion = {
      indicaciones_generales: receta.indicaciones_generales.trim(),
      medicamentos: receta.medicamentos.filter(m => m.id_medicamento).map(m => ({
        id_medicamento: Number(m.id_medicamento),
        dosis: m.dosis.trim(),
        frecuencia: m.frecuencia.trim(),
        duracion: m.duracion.trim(),
        via_administracion: m.via_administracion.trim(),
        observaciones: m.observaciones.trim()
      }))
    };
    const r = await envio.enviar(() => api.consultas.crear(id, cuerpo));
    if (r) {
      notificar(`Consulta ${r.id_consulta} registrada${r.alertas?.length ? ` · ${r.alertas.length} alerta(s) de alergia` : ''}`);
      navegar(enlace(`/pacientes/${id}/consultas`));
    }
  }

  const pasos = [
    { id: 'consulta-atencion', titulo: 'Atención', completo: Boolean(f.id_medico && f.fecha_hora) },
    { id: 'consulta-signos', titulo: 'Signos vitales', completo: SIGNOS.some(([k]) => String(signos[k]).trim()) },
    { id: 'consulta-notas', titulo: 'Notas clínicas', completo: Boolean(f.anamnesis.trim() || f.examen_fisico.trim() || f.plan_tratamiento.trim()) },
    { id: 'consulta-diagnosticos', titulo: 'Diagnósticos', completo: diagnosticos.some(d => d.id_diagnostico) },
    { id: 'consulta-receta', titulo: 'Receta', completo: conReceta ? receta.medicamentos.some(m => m.id_medicamento && m.dosis.trim() && m.frecuencia.trim()) : true },
    { id: 'consulta-examenes', titulo: 'Exámenes', completo: examenes.length > 0 }
  ];

  return (
    <>
      <PageHeader titulo="Nueva consulta" descripcion="Registre la atención completa: signos vitales, notas, diagnósticos, receta y órdenes de examen."
        acciones={<Link className="btn" to={enlace(`/pacientes/${id}/consultas`)}>Cancelar</Link>}>
        <div className="page-meta"><b>{paciente.primer_nombre} {paciente.primer_apellido}</b><code>{paciente.numero_expediente}</code></div>
      </PageHeader>
      <FormSteps pasos={pasos} />
      <form onSubmit={enviar} noValidate>
        {envio.error && <Alerta titulo="No se pudo registrar la consulta">{envio.error.message}</Alerta>}
        {Object.keys(errores).length > 0 && <Alerta>Revise los campos marcados.</Alerta>}
        <div className="form-layout">
          <div className="form-body">
            <Card id="consulta-atencion">
              <SectionHeading numero="1" titulo="Datos de la consulta" descripcion="Médico responsable, fecha y motivo de la atención." />
              <div className="form-grid">
                <FormField label="Médico responsable" error={errores.id_medico} required>{a => (
                  <select {...a} value={f.id_medico} onChange={e => cambiar('id_medico', e.target.value)}>
                    <option value="">Seleccione…</option>
                    {medicos.map(m => <option key={m.id_medico} value={m.id_medico}>{nombreMedico(m)} · {m.colegiado}</option>)}
                  </select>)}</FormField>
                <FormField label="Fecha y hora" error={errores.fecha_hora} required>{a => <input {...a} type="datetime-local" max={localAhora(5)} value={f.fecha_hora} onChange={e => cambiar('fecha_hora', e.target.value)} />}</FormField>
                <FormField label="Tipo de consulta">{a => (
                  <select {...a} value={f.tipo_consulta} onChange={e => cambiar('tipo_consulta', e.target.value)}>
                    <option value="Directa">Directa</option>
                    <option value="Emergencia">Emergencia</option>
                  </select>)}</FormField>
                <FormField label="Motivo de consulta" full>{a => <input {...a} value={f.motivo} onChange={e => cambiar('motivo', e.target.value)} maxLength={255} />}</FormField>
              </div>
            </Card>

            <Card id="consulta-signos">
              <SectionHeading numero="2" titulo="Signos vitales" descripcion="Registre solo los valores disponibles." />
              <div className="form-grid">
                {SIGNOS.map(([k, label]) => <FormField key={k} label={label}>{a => <input {...a} type="number" inputMode="decimal" step="any" min="0" value={signos[k]} onChange={e => cambiarSigno(k, e.target.value)} />}</FormField>)}
              </div>
            </Card>

            <Card id="consulta-notas">
              <SectionHeading numero="3" titulo="Notas clínicas" />
              <div className="form-grid">
                <FormField label="Anamnesis" full>{a => <textarea {...a} rows={3} value={f.anamnesis} onChange={e => cambiar('anamnesis', e.target.value)} maxLength={20000} />}</FormField>
                <FormField label="Examen físico" full>{a => <textarea {...a} rows={3} value={f.examen_fisico} onChange={e => cambiar('examen_fisico', e.target.value)} maxLength={20000} />}</FormField>
                <FormField label="Plan de tratamiento" full>{a => <textarea {...a} rows={3} value={f.plan_tratamiento} onChange={e => cambiar('plan_tratamiento', e.target.value)} maxLength={20000} />}</FormField>
                <FormField label="Observaciones" full>{a => <textarea {...a} rows={2} value={f.observaciones} onChange={e => cambiar('observaciones', e.target.value)} maxLength={20000} />}</FormField>
              </div>
            </Card>

            <Card id="consulta-diagnosticos" acciones={<button type="button" className="btn btn-sm" onClick={() => setDiagnosticos(xs => [...xs, diagnosticoVacio()])}>Agregar diagnóstico</button>}>
              <SectionHeading numero="4" titulo="Diagnósticos" descripcion="Catálogo CIE-10 del hospital." />
              {errores.diagnosticos && <Alerta>{errores.diagnosticos}</Alerta>}
              <div className="sub-list">
                {diagnosticos.map((d, i) => (
                  <div className="sub-item" key={i}>
                    <div className="sub-item-head">
                      <h3>Diagnóstico {i + 1}</h3>
                      {diagnosticos.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => setDiagnosticos(xs => xs.filter((_, j) => j !== i))}>Quitar</button>}
                    </div>
                    <div className="form-grid">
                      <FormField label="Diagnóstico">{a => (
                        <select {...a} value={d.id_diagnostico} onChange={e => cambiarDiagnostico(i, 'id_diagnostico', e.target.value)}>
                          <option value="">Seleccione…</option>
                          {diagnosticosCat.items.map(x => <option key={x.id_diagnostico} value={x.id_diagnostico}>{x.codigo_cie10} · {x.nombre_diagnostico}</option>)}
                        </select>)}</FormField>
                      <FormField label="Tipo">{a => (
                        <select {...a} value={d.tipo} onChange={e => cambiarDiagnostico(i, 'tipo', e.target.value)}>
                          <option>Principal</option><option>Secundario</option>
                        </select>)}</FormField>
                      <FormField label="Observaciones">{a => <input {...a} value={d.observaciones} onChange={e => cambiarDiagnostico(i, 'observaciones', e.target.value)} maxLength={255} />}</FormField>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card id="consulta-receta">
              <SectionHeading numero="5" titulo="Receta" descripcion="Medicamentos e indicaciones de la consulta." />
              <label className="check"><input type="checkbox" checked={conReceta} onChange={e => setConReceta(e.target.checked)} /> <b>Emitir prescripción en esta consulta</b></label>
              {conReceta && <div className="mt-4">
                {errores.receta && <Alerta>{errores.receta}</Alerta>}
                <FormField label="Indicaciones generales">{a => <textarea {...a} rows={2} value={receta.indicaciones_generales} onChange={e => setReceta({ ...receta, indicaciones_generales: e.target.value })} maxLength={20000} />}</FormField>
                <div className="sub-list mt-4">
                  {receta.medicamentos.map((m, i) => (
                    <div className="sub-item" key={i}>
                      <div className="sub-item-head">
                        <h3>Medicamento {i + 1}</h3>
                        <div className="actions">
                          <button type="button" className="btn btn-sm" onClick={() => setReceta(x => ({ ...x, medicamentos: [...x.medicamentos, medicamentoVacio()] }))}>Agregar</button>
                          {receta.medicamentos.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => setReceta(x => ({ ...x, medicamentos: x.medicamentos.filter((_, j) => j !== i) }))}>Quitar</button>}
                        </div>
                      </div>
                      <div className="form-grid">
                        <FormField label="Medicamento" required>{a => (
                          <select {...a} value={m.id_medicamento} onChange={e => {
                            const med = medicamentosCat.items.find(x => String(x.id_medicamento) === e.target.value);
                            setReceta(x => ({ ...x, medicamentos: x.medicamentos.map((y, j) => j === i ? { ...y, id_medicamento: e.target.value, via_administracion: med?.via_administracion || y.via_administracion } : y) }));
                          }}>
                            <option value="">Seleccione…</option>
                            {medicamentosCat.items.map(x => <option key={x.id_medicamento} value={x.id_medicamento}>{x.nombre_generico}{x.concentracion ? ` · ${x.concentracion}` : ''}</option>)}
                          </select>)}</FormField>
                        <FormField label="Dosis" required>{a => <input {...a} value={m.dosis} onChange={e => cambiarMedicamento(i, 'dosis', e.target.value)} maxLength={60} placeholder="Ej. 500 mg" />}</FormField>
                        <FormField label="Frecuencia" required>{a => <input {...a} value={m.frecuencia} onChange={e => cambiarMedicamento(i, 'frecuencia', e.target.value)} maxLength={60} placeholder="Ej. cada 8 horas" />}</FormField>
                        <FormField label="Duración">{a => <input {...a} value={m.duracion} onChange={e => cambiarMedicamento(i, 'duracion', e.target.value)} maxLength={60} placeholder="Ej. 7 días" />}</FormField>
                        <FormField label="Vía de administración">{a => <input {...a} value={m.via_administracion} onChange={e => cambiarMedicamento(i, 'via_administracion', e.target.value)} maxLength={50} />}</FormField>
                        <FormField label="Observaciones">{a => <input {...a} value={m.observaciones} onChange={e => cambiarMedicamento(i, 'observaciones', e.target.value)} maxLength={255} />}</FormField>
                      </div>
                    </div>
                  ))}
                </div>
              </div>}
            </Card>

            <Card id="consulta-examenes">
              <SectionHeading numero="6" titulo="Órdenes de examen" descripcion="Seleccione los exámenes que se ordenan en esta consulta." />
              <div className="sub-list">
                {examenesCat.items.map(e => (
                  <label className="check" key={e.id_examen}>
                    <input type="checkbox" checked={examenes.includes(String(e.id_examen))} onChange={ev => setExamenes(xs => ev.target.checked ? [...xs, String(e.id_examen)] : xs.filter(x => x !== String(e.id_examen)))} />
                    <span><b>{e.nombre_examen}</b>{e.tipo_examen && <small> · {e.tipo_examen}</small>}</span>
                  </label>
                ))}
                {!examenesCat.items.length && <p className="meta">El catálogo de exámenes está vacío.</p>}
              </div>
            </Card>
          </div>

          <div className="form-side">
            <FormSummary items={[
              ['Paciente', paciente.numero_expediente],
              ['Diagnósticos', diagnosticos.filter(d => d.id_diagnostico).length],
              ['Medicamentos', conReceta ? receta.medicamentos.filter(m => m.id_medicamento).length : 0],
              ['Exámenes', examenes.length]
            ]}>
              <p className="summary-note">Todo se guarda en una sola operación: consulta, signos, diagnósticos, receta y exámenes.</p>
              <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Registrar consulta</BotonEnviar>
              <Link className="btn btn-block" to={enlace(`/pacientes/${id}/consultas`)}>Cancelar</Link>
            </FormSummary>
            <Card titulo="Alertas de alergia">
              <p className="meta"><Icon name="alerta" size={15} /> Si un medicamento coincide con una alergia registrada, el servidor devolverá la alerta al guardar.</p>
            </Card>
          </div>
        </div>
      </form>
    </>
  );
}
