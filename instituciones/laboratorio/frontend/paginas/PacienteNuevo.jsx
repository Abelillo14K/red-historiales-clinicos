import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, FormField, FormSteps, FormSummary, PageHeader, SectionHeading, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { hoy } from '@plataforma/formato.js';

const VACIO = {
  nombres: '', apellidos: '', documento_identidad: '', fecha_nacimiento: '', sexo: '',
  telefono: '', correo: '', direccion: '', contacto_emergencia: '', telefono_emergencia: '', observaciones: ''
};

export default function PacienteNuevo() {
  const { api, enlace } = useModulo();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [p, setP] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const campo = (clave, props = {}) => a => <input {...a} {...props} value={p[clave]} onChange={e => setP({ ...p, [clave]: e.target.value })} />;

  function validar() {
    const e = {};
    if (!p.nombres.trim()) e.nombres = 'Obligatorio';
    if (!p.apellidos.trim()) e.apellidos = 'Obligatorio';
    if (!p.fecha_nacimiento) e.fecha_nacimiento = 'Obligatorio';
    else if (p.fecha_nacimiento > hoy()) e.fecha_nacimiento = 'No puede ser una fecha futura';
    if (!p.sexo) e.sexo = 'Seleccione una opción';
    if (p.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.correo)) e.correo = 'Correo no válido';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    // Los opcionales vacíos se envían como null (el backend los guarda así).
    const datos = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.trim() || null]));
    const r = await envio.enviar(() => api.pacientes.crear(datos));
    if (r) { notificar(`Paciente registrado con expediente ${r.id_paciente}`); navegar(enlace(`/pacientes/${r.id_paciente}`)); }
  }

  const pasos = [
    { id: 'lab-generales', titulo: 'Datos generales', completo: Boolean(p.nombres.trim() && p.apellidos.trim() && p.fecha_nacimiento && p.sexo) },
    { id: 'lab-contacto', titulo: 'Contacto', completo: Boolean(p.telefono.trim() || p.correo.trim()) },
    { id: 'lab-atencion', titulo: 'Observaciones', completo: Boolean(p.observaciones.trim()) }
  ];

  return (
    <>
      <PageHeader titulo="Registrar paciente" descripcion="Crea el expediente del paciente en el laboratorio. El número de expediente se asigna automáticamente."
        acciones={<Link className="btn" to={enlace('/pacientes')}>Cancelar</Link>} />
      <FormSteps pasos={pasos} />
      <form onSubmit={enviar} noValidate>
        {envio.error && <Alerta titulo="No se pudo registrar">{envio.error.message}</Alerta>}
        <div className="form-layout">
          <div className="form-body">
            <Card id="lab-generales">
              <SectionHeading numero="1" titulo="Datos generales" descripcion="Identificación del paciente. Los campos con * son obligatorios." />
              <div className="form-grid">
                <FormField label="Nombres" error={errores.nombres} required>{campo('nombres', { maxLength: 120 })}</FormField>
                <FormField label="Apellidos" error={errores.apellidos} required>{campo('apellidos', { maxLength: 120 })}</FormField>
                <FormField label="Documento de identidad" hint="Opcional; no puede repetirse">{campo('documento_identidad', { maxLength: 20 })}</FormField>
                <FormField label="Fecha de nacimiento" error={errores.fecha_nacimiento} required>{campo('fecha_nacimiento', { type: 'date', max: hoy() })}</FormField>
                <FormField label="Sexo" error={errores.sexo} required>{a => (
                  <select {...a} value={p.sexo} onChange={e => setP({ ...p, sexo: e.target.value })}>
                    <option value="">Seleccione…</option><option value="F">Femenino</option><option value="M">Masculino</option>
                  </select>)}</FormField>
              </div>
            </Card>
            <Card id="lab-contacto">
              <SectionHeading numero="2" titulo="Datos de contacto" />
              <div className="form-grid">
                <FormField label="Teléfono">{campo('telefono', { type: 'tel', maxLength: 20 })}</FormField>
                <FormField label="Correo electrónico" error={errores.correo}>{campo('correo', { type: 'email', maxLength: 120 })}</FormField>
                <FormField label="Dirección" full>{campo('direccion', { maxLength: 200 })}</FormField>
                <FormField label="Contacto de emergencia">{campo('contacto_emergencia', { maxLength: 120 })}</FormField>
                <FormField label="Teléfono de emergencia">{campo('telefono_emergencia', { type: 'tel', maxLength: 20 })}</FormField>
              </div>
            </Card>
            <Card id="lab-atencion">
              <SectionHeading numero="3" titulo="Observaciones para la atención" descripcion="Información útil para la toma de muestras (no es un dato clínico)." />
              <FormField label="Observaciones" full>{a => <textarea {...a} rows={3} maxLength={500} value={p.observaciones} onChange={e => setP({ ...p, observaciones: e.target.value })} />}</FormField>
            </Card>
          </div>
          <div className="form-side">
            <FormSummary titulo="Expediente nuevo" items={[['Institución', 'Laboratorio Clínico'], ['Expediente', 'Asignación automática']]}>
              <p className="summary-note">Después de guardar se abre el expediente para crear su primera solicitud de exámenes.</p>
              <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Guardar y abrir expediente</BotonEnviar>
              <Link className="btn btn-block" to={enlace('/pacientes')}>Cancelar</Link>
            </FormSummary>
          </div>
        </div>
      </form>
    </>
  );
}
