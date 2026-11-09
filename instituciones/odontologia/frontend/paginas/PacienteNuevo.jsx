import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, FormField, FormSteps, FormSummary, PageHeader, SectionHeading, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { hoy } from '@plataforma/formato.js';

// Cada grupo se guarda como un mapa dentro del documento del paciente en Firestore.
const VACIO = {
  nombres: '', apellidos: '', documento_identidad: '', fecha_nacimiento: '', sexo: '',
  contacto: { telefono: '', correo: '', direccion: '', contacto_emergencia: '', telefono_emergencia: '' },
  antecedentes: { medicos: '', alergias: '', medicamentos: '' },
  atencion_inicial: { motivo: '', ultima_atencion: '', observaciones: '' }
};
const limpio = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim() || null]));

export default function PacienteNuevo() {
  const { api, enlace } = useModulo();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [p, setP] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const campo = (clave, props = {}) => a => <input {...a} {...props} value={p[clave]} onChange={e => setP({ ...p, [clave]: e.target.value })} />;
  const de = (grupo, clave, props = {}) => a => {
    const Tag = props.textarea ? 'textarea' : 'input';
    const { textarea, ...resto } = props;
    return <Tag {...a} {...resto} rows={textarea ? 3 : undefined} value={p[grupo][clave]} onChange={e => setP({ ...p, [grupo]: { ...p[grupo], [clave]: e.target.value } })} />;
  };

  function validar() {
    const e = {};
    if (!p.nombres.trim()) e.nombres = 'Obligatorio';
    if (!p.apellidos.trim()) e.apellidos = 'Obligatorio';
    if (!p.fecha_nacimiento) e.fecha_nacimiento = 'Obligatorio';
    else if (p.fecha_nacimiento > hoy()) e.fecha_nacimiento = 'No puede ser una fecha futura';
    if (!p.sexo) e.sexo = 'Seleccione una opción';
    if (p.contacto.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.contacto.correo)) e.correo = 'Correo no válido';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const r = await envio.enviar(() => api.pacientes.crear({
      nombres: p.nombres.trim(), apellidos: p.apellidos.trim(), documento_identidad: p.documento_identidad.trim() || null,
      fecha_nacimiento: p.fecha_nacimiento, sexo: p.sexo,
      contacto: limpio(p.contacto), antecedentes: limpio(p.antecedentes), atencion_inicial: limpio(p.atencion_inicial)
    }));
    if (r) { notificar(`Paciente registrado con expediente ${r.id_paciente}`); navegar(enlace(`/pacientes/${r.id_paciente}`)); }
  }

  const pasos = [
    { id: 'odonto-generales', titulo: 'Datos generales', completo: Boolean(p.nombres.trim() && p.apellidos.trim() && p.fecha_nacimiento && p.sexo) },
    { id: 'odonto-contacto', titulo: 'Contacto', completo: Boolean(p.contacto.telefono.trim() || p.contacto.correo.trim()) },
    { id: 'odonto-antecedentes', titulo: 'Antecedentes', completo: Object.values(p.antecedentes).some(v => v.trim()) },
    { id: 'odonto-atencion', titulo: 'Atención dental', completo: Boolean(p.atencion_inicial.motivo.trim()) }
  ];

  return (
    <>
      <PageHeader titulo="Registrar paciente" descripcion="Crea el expediente odontológico. El número de expediente se asigna automáticamente."
        acciones={<Link className="btn" to={enlace('/pacientes')}>Cancelar</Link>} />
      <FormSteps pasos={pasos} />
      <form onSubmit={enviar} noValidate>
        {envio.error && <Alerta titulo="No se pudo registrar">{envio.error.message}</Alerta>}
        <div className="form-layout">
          <div className="form-body">
            <Card id="odonto-generales">
              <SectionHeading numero="1" titulo="Datos generales" descripcion="Los campos con * son obligatorios." />
              <div className="form-grid">
                <FormField label="Nombres" error={errores.nombres} required>{campo('nombres', { maxLength: 120 })}</FormField>
                <FormField label="Apellidos" error={errores.apellidos} required>{campo('apellidos', { maxLength: 120 })}</FormField>
                <FormField label="Fecha de nacimiento" error={errores.fecha_nacimiento} required>{campo('fecha_nacimiento', { type: 'date', max: hoy() })}</FormField>
                <FormField label="Sexo" error={errores.sexo} required>{a => (
                  <select {...a} value={p.sexo} onChange={e => setP({ ...p, sexo: e.target.value })}>
                    <option value="">Seleccione…</option><option value="F">Femenino</option><option value="M">Masculino</option>
                  </select>)}</FormField>
                <FormField label="Documento de identidad" hint="Opcional; no puede repetirse">{campo('documento_identidad', { maxLength: 20 })}</FormField>
              </div>
            </Card>
            <Card id="odonto-contacto">
              <SectionHeading numero="2" titulo="Datos de contacto" />
              <div className="form-grid">
                <FormField label="Teléfono">{de('contacto', 'telefono', { type: 'tel', maxLength: 20 })}</FormField>
                <FormField label="Correo electrónico" error={errores.correo}>{de('contacto', 'correo', { type: 'email', maxLength: 120 })}</FormField>
                <FormField label="Dirección" full>{de('contacto', 'direccion', { maxLength: 200 })}</FormField>
                <FormField label="Contacto de emergencia">{de('contacto', 'contacto_emergencia', { maxLength: 120 })}</FormField>
                <FormField label="Teléfono de emergencia">{de('contacto', 'telefono_emergencia', { type: 'tel', maxLength: 20 })}</FormField>
              </div>
            </Card>
            <Card id="odonto-antecedentes">
              <SectionHeading numero="3" titulo="Antecedentes y alergias" descripcion="Información que el odontólogo verá en cada atención." />
              <div className="form-grid">
                <FormField label="Antecedentes médicos">{de('antecedentes', 'medicos', { textarea: true, maxLength: 1000 })}</FormField>
                <FormField label="Alergias conocidas">{de('antecedentes', 'alergias', { textarea: true, maxLength: 500 })}</FormField>
                <FormField label="Medicamentos que utiliza" full>{de('antecedentes', 'medicamentos', { textarea: true, maxLength: 500 })}</FormField>
              </div>
            </Card>
            <Card id="odonto-atencion">
              <SectionHeading numero="4" titulo="Información odontológica" />
              <div className="form-grid">
                <FormField label="Motivo de la primera atención" full>{de('atencion_inicial', 'motivo', { maxLength: 300 })}</FormField>
                <FormField label="Última atención odontológica">{de('atencion_inicial', 'ultima_atencion', { type: 'date', max: hoy() })}</FormField>
                <FormField label="Observaciones iniciales" full>{de('atencion_inicial', 'observaciones', { textarea: true, maxLength: 1000 })}</FormField>
              </div>
            </Card>
          </div>
          <div className="form-side">
            <FormSummary titulo="Expediente nuevo" items={[['Institución', 'Clínica Odontológica'], ['Expediente', 'Asignación automática (OD…)']]}>
              <p className="summary-note">Después de guardar se abre el expediente para registrar consultas, citas y el odontograma.</p>
              <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Guardar y abrir expediente</BotonEnviar>
              <Link className="btn btn-block" to={enlace('/pacientes')}>Cancelar</Link>
            </FormSummary>
          </div>
        </div>
      </form>
    </>
  );
}
