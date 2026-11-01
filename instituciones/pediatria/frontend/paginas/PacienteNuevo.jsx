import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, Campo, FormSteps, FormSummary, PageHeader, SectionHeading, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import TutorCampos, { tutorParaApi, tutorVacio, validarTutor } from '../componentes/TutorCampos.jsx';
import { hoy } from '@plataforma/formato.js';

export default function PacienteNuevo() {
  const { api } = useSesion();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [p, setP] = useState({ nombres: '', apellidos: '', fecha_nacimiento: '', sexo: '' });
  const [tutores, setTutores] = useState([tutorVacio(true)]);
  const [errores, setErrores] = useState({});

  function validar() {
    const e = {};
    if (!p.nombres.trim()) e.nombres = 'Obligatorio';
    if (!p.apellidos.trim()) e.apellidos = 'Obligatorio';
    if (!p.fecha_nacimiento) e.fecha_nacimiento = 'Obligatorio';
    else if (p.fecha_nacimiento > hoy()) e.fecha_nacimiento = 'No puede ser una fecha futura';
    if (!p.sexo) e.sexo = 'Seleccione una opción';
    e.tutores = tutores.map(validarTutor);
    const principales = tutores.filter(t => t.es_principal).length;
    if (principales !== 1) e.principal = 'Debe marcar exactamente un tutor como responsable principal';
    const limpio = Object.keys(e).filter(k => k !== 'tutores').length === 0 && e.tutores.every(t => !Object.keys(t).length);
    setErrores(e);
    return limpio;
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const r = await envio.enviar(() => api.pacientes.crear({
      nombres: p.nombres.trim(), apellidos: p.apellidos.trim(), fecha_nacimiento: p.fecha_nacimiento, sexo: p.sexo,
      tutores: tutores.map(tutorParaApi)
    }));
    if (r) { notificar(`Paciente ${r.id_paciente} registrado correctamente`); navegar(`/pacientes/${r.id_paciente}`); }
  }

  const marcarPrincipal = (i, t) => setTutores(ts => ts.map((x, j) => (j === i ? t : t.es_principal ? { ...x, es_principal: false } : x)));
  const pasos = [
    { id: 'datos-paciente', titulo: 'Datos generales', completo: Boolean(p.nombres.trim() && p.apellidos.trim() && p.fecha_nacimiento && p.fecha_nacimiento <= hoy() && p.sexo) },
    { id: 'datos-tutores', titulo: 'Tutores y contacto', completo: tutores.every(t => !Object.keys(validarTutor(t)).length) && tutores.filter(t => t.es_principal).length === 1 }
  ];
  const completos = pasos.filter(x => x.completo).length;

  return (
    <>
      <PageHeader titulo="Registrar paciente" descripcion="Crea un historial clínico pediátrico nuevo. El código se asigna automáticamente y debe indicarse exactamente un tutor responsable principal."
        acciones={<Link className="btn" to="/pacientes">Cancelar</Link>} />
      <FormSteps pasos={pasos} />
      <form onSubmit={enviar} noValidate>
        {envio.error && <Alerta titulo="No se pudo registrar">{envio.error.message}</Alerta>}
        <div className="form-layout">
        <div className="form-body">
        <section className="card" id="datos-paciente">
          <SectionHeading numero="1" titulo="Datos del paciente" descripcion="Identificación del paciente. Los campos con * son obligatorios." />
          <div className="form-grid">
            <Campo label="Nombres" error={errores.nombres} required>{a => <input {...a} value={p.nombres} onChange={e => setP({ ...p, nombres: e.target.value })} maxLength={255} />}</Campo>
            <Campo label="Apellidos" error={errores.apellidos} required>{a => <input {...a} value={p.apellidos} onChange={e => setP({ ...p, apellidos: e.target.value })} maxLength={255} />}</Campo>
            <Campo label="Fecha de nacimiento" error={errores.fecha_nacimiento} required>{a => <input {...a} type="date" max={hoy()} value={p.fecha_nacimiento} onChange={e => setP({ ...p, fecha_nacimiento: e.target.value })} />}</Campo>
            <Campo label="Sexo" error={errores.sexo} required>{a => (
              <select {...a} value={p.sexo} onChange={e => setP({ ...p, sexo: e.target.value })}>
                <option value="">Seleccione…</option><option value="F">Femenino</option><option value="M">Masculino</option>
              </select>)}</Campo>
          </div>
        </section>
        <section className="card" id="datos-tutores">
          <div className="card-head">
            <SectionHeading numero="2" titulo="Tutores / responsables" descripcion="Contacto y persona responsable del paciente." />
            <button type="button" className="btn btn-sm" disabled={tutores.length >= 10} onClick={() => setTutores([...tutores, tutorVacio(false)])}>Agregar tutor</button>
          </div>
          {errores.principal && <Alerta>{errores.principal}</Alerta>}
          <div className="sub-list">
            {tutores.map((t, i) => (
              <div className="sub-item" key={i}>
                <div className="sub-item-head">
                  <h3>Tutor {i + 1}</h3>
                  {tutores.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => setTutores(tutores.filter((_, j) => j !== i))}>Quitar</button>}
                </div>
                <TutorCampos valor={t} errores={errores.tutores?.[i]} onChange={v => marcarPrincipal(i, v)} />
              </div>
            ))}
          </div>
        </section>
        </div>
        <div className="form-side">
          <FormSummary titulo="Expediente nuevo">
            <span className="summary-code">Asignación automática</span>
            <p className="summary-note">El código se confirma al guardar. Los datos del paciente y sus tutores se registran juntos.</p>
            <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Registrar paciente</BotonEnviar>
            <Link className="btn btn-block" to="/pacientes">Cancelar</Link>
          </FormSummary>
          <section className="card">
            <h2>Progreso <span className="meta">{completos} de {pasos.length}</span></h2>
            <progress className="form-progress" max={pasos.length} value={completos} aria-label="Secciones completas" />
            <p className="meta">Completa los datos generales y al menos un tutor principal.</p>
          </section>
        </div>
        </div>
      </form>
    </>
  );
}
