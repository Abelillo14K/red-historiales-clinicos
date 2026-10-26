import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, Campo, Cargando, ErrorCarga, PageHeader, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import {
  DiagnosticosEditor, MedicamentosEditor, MedicoSelect, diagnosticoCompleto, filaVacia,
  medicamentoCompleto, medicamentoVacio, medicionParaApi, recortar, validarMedicion
} from '../componentes/ClinicoCampos.jsx';
import { aIso, localAhora } from '@plataforma/formato.js';

export default function NuevaConsulta() {
  const { id } = useParams();
  const { api, sesion } = useSesion();
  const perimetroOpcional = Boolean(sesion?.capacidades?.perimetro_cefalico_opcional);
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const datos = useCarga(() => Promise.all([api.pacientes.obtener(id), api.catalogos.medicos()]), [api, id]);
  const [f, setF] = useState({ id_medico: '', fecha_hora: localAhora(), motivo: '', observaciones: '' });
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [tratamiento, setTratamiento] = useState({ descripcion: '', recomendaciones: '' });
  const [conReceta, setConReceta] = useState(false);
  const [receta, setReceta] = useState({ indicaciones_generales: '', medicamentos: [medicamentoVacio()] });
  const [conControl, setConControl] = useState(false);
  const [control, setControl] = useState({ peso_kg: '', talla_cm: '', perimetro_cefalico_cm: '' });
  const [errores, setErrores] = useState({});

  if (datos.cargando) return <Cargando />;
  if (datos.error) return <ErrorCarga error={datos.error} onReintentar={datos.recargar} />;
  const [paciente, medicos] = datos.datos;
  if (paciente.estado_historial !== 'Activo') return <Alerta tipo="warn">El historial está archivado y no admite nuevas consultas.</Alerta>;

  function validar() {
    const e = {};
    if (!f.id_medico) e.id_medico = 'Seleccione el médico';
    if (!f.fecha_hora) e.fecha_hora = 'Obligatorio';
    else if (new Date(f.fecha_hora) > new Date(Date.now() + 5 * 60000)) e.fecha_hora = 'No puede estar en el futuro';
    else if (f.fecha_hora.slice(0, 10) < String(paciente.fecha_nacimiento).slice(0, 10)) e.fecha_hora = 'Anterior a la fecha de nacimiento';
    if (!f.motivo.trim()) e.motivo = 'Obligatorio';
    const dx = diagnosticos.filter(d => !filaVacia(d));
    if (dx.some(d => !diagnosticoCompleto(d))) e.diagnosticos = 'Complete código y descripción de cada diagnóstico';
    else if (new Set(dx.map(d => d.codigo.trim())).size !== dx.length) e.diagnosticos = 'Hay códigos de diagnóstico repetidos';
    if (!tratamiento.descripcion.trim() && tratamiento.recomendaciones.trim()) e.tratamiento = 'Indique la descripción del tratamiento';
    if (conReceta && !receta.medicamentos.every(medicamentoCompleto)) e.receta = 'Complete todos los campos de cada medicamento';
    if (conControl) Object.assign(e, validarMedicion(control, perimetroOpcional));
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const cuerpo = {
      id_medico: f.id_medico, fecha_hora: aIso(f.fecha_hora), motivo: f.motivo.trim(),
      diagnosticos: diagnosticos.filter(d => !filaVacia(d)).map(recortar),
      prescripciones: []
    };
    if (f.observaciones.trim()) cuerpo.observaciones = f.observaciones.trim();
    if (tratamiento.descripcion.trim()) {
      cuerpo.tratamiento = { descripcion: tratamiento.descripcion.trim() };
      if (tratamiento.recomendaciones.trim()) cuerpo.tratamiento.recomendaciones = tratamiento.recomendaciones.trim();
    }
    if (conReceta) {
      const rx = { medicamentos: receta.medicamentos.map(recortar) };
      if (receta.indicaciones_generales.trim()) rx.indicaciones_generales = receta.indicaciones_generales.trim();
      cuerpo.prescripciones.push(rx);
    }
    if (conControl) {
      cuerpo.control_crecimiento = medicionParaApi(control);
    }
    const r = await envio.enviar(() => api.consultas.crear(id, cuerpo));
    if (r) { notificar(`Consulta ${r.id_consulta} registrada`); navegar(`/pacientes/${id}/consultas`); }
  }

  const num = (k, label, max) => (
    <Campo label={label} error={errores[k]} required={k !== 'perimetro_cefalico_cm' || !perimetroOpcional}
      hint={k === 'perimetro_cefalico_cm' && perimetroOpcional ? 'Opcional: registrar si corresponde' : undefined}>
      {a => <input {...a} type="number" inputMode="decimal" step="0.1" min="0.1" max={max} value={control[k]} onChange={e => setControl({ ...control, [k]: e.target.value })} />}
    </Campo>
  );

  return (
    <>
      <PageHeader titulo="Nueva consulta" descripcion="Registre lo indicado por el médico. Diagnósticos, tratamiento, prescripción y control de crecimiento se guardan en una sola operación."
        acciones={<Link className="btn" to={`/pacientes/${id}/consultas`}>Cancelar</Link>}>
        <div className="page-meta"><b>{paciente.nombres} {paciente.apellidos}</b><code>{paciente.id_paciente}</code></div>
      </PageHeader>
      <form onSubmit={enviar} noValidate>
        {envio.error && <Alerta titulo="No se pudo registrar la consulta">{envio.error.message}</Alerta>}
        {Object.keys(errores).length > 0 && <Alerta>Revise los campos marcados.</Alerta>}
        <section className="card">
          <h2 className="card-title">Atención</h2>
          <div className="form-grid">
            <MedicoSelect medicos={medicos} value={f.id_medico} onChange={v => setF({ ...f, id_medico: v })} error={errores.id_medico} />
            <Campo label="Fecha y hora" error={errores.fecha_hora} required>{a => <input {...a} type="datetime-local" max={localAhora(5)} value={f.fecha_hora} onChange={e => setF({ ...f, fecha_hora: e.target.value })} />}</Campo>
            <Campo label="Motivo de consulta" error={errores.motivo} required full>{a => <input {...a} value={f.motivo} onChange={e => setF({ ...f, motivo: e.target.value })} maxLength={255} />}</Campo>
            <Campo label="Observaciones" full>{a => <textarea {...a} value={f.observaciones} onChange={e => setF({ ...f, observaciones: e.target.value })} maxLength={2000} />}</Campo>
          </div>
        </section>
        <section className="card">
          <h2 className="card-title">Diagnósticos</h2>
          <DiagnosticosEditor lista={diagnosticos} onChange={setDiagnosticos} error={errores.diagnosticos} />
        </section>
        <section className="card">
          <h2 className="card-title">Tratamiento</h2>
          {errores.tratamiento && <Alerta>{errores.tratamiento}</Alerta>}
          <div className="form-grid">
            <Campo label="Descripción del tratamiento" full>{a => <textarea {...a} value={tratamiento.descripcion} onChange={e => setTratamiento({ ...tratamiento, descripcion: e.target.value })} maxLength={255} />}</Campo>
            <Campo label="Recomendaciones" full>{a => <textarea {...a} value={tratamiento.recomendaciones} onChange={e => setTratamiento({ ...tratamiento, recomendaciones: e.target.value })} maxLength={1000} />}</Campo>
          </div>
        </section>
        <section className="card">
          <label className="check"><input type="checkbox" checked={conReceta} onChange={e => setConReceta(e.target.checked)} /> <b>Emitir prescripción en esta consulta</b></label>
          {conReceta && <div className="mt-4">
            <p className="meta mb-3">Registre exactamente lo indicado por el médico. El sistema no calcula ni sugiere dosis.</p>
            <Campo label="Indicaciones generales">{a => <textarea {...a} value={receta.indicaciones_generales} onChange={e => setReceta({ ...receta, indicaciones_generales: e.target.value })} maxLength={1000} />}</Campo>
            <div className="mt-4"><MedicamentosEditor lista={receta.medicamentos} onChange={m => setReceta({ ...receta, medicamentos: m })} error={errores.receta} /></div>
          </div>}
        </section>
        <section className="card">
          <label className="check"><input type="checkbox" checked={conControl} onChange={e => setConControl(e.target.checked)} /> <b>Registrar control de crecimiento en esta consulta</b></label>
          {conControl && <div className="form-grid mt-4">
            {num('peso_kg', 'Peso (kg)', 250)}{num('talla_cm', 'Talla (cm)', 250)}{num('perimetro_cefalico_cm', 'Perímetro cefálico (cm)', 100)}
          </div>}
        </section>
        <div className="form-actions">
          <Link className="btn" to={`/pacientes/${id}/consultas`}>Cancelar</Link>
          <BotonEnviar enviando={envio.enviando}>Registrar consulta</BotonEnviar>
        </div>
      </form>
    </>
  );
}
