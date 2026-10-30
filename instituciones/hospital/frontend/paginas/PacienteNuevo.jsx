import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, FormField, FormSteps, FormSummary, FormularioVistaPrevia, PageHeader, PendienteIntegracion, SectionHeading } from '@plataforma/ui/index.js';

const PASOS = [
  { id: 'hospital-generales', titulo: 'Datos generales' }, { id: 'hospital-contacto', titulo: 'Contacto' },
  { id: 'hospital-emergencia', titulo: 'Emergencia' }, { id: 'hospital-seguro', titulo: 'Seguro' }, { id: 'hospital-alergias', titulo: 'Alergias' }
];
const Campo = ({ label, tipo = 'text', required, placeholder }) => <FormField label={label} required={required}>
  {a => <input {...a} type={tipo} placeholder={placeholder} />}
</FormField>;

export default function PacienteNuevo() {
  const { enlace } = useModulo();
  return <>
    <PageHeader titulo="Registrar paciente" descripcion="Completa las cinco secciones. Los campos con * son obligatorios."
      acciones={<Link className="btn" to={enlace('/pacientes')}>Volver</Link>} />
    <PendienteIntegracion compacto />
    <FormSteps pasos={PASOS} />
    <FormularioVistaPrevia titulo="Registro de paciente" mostrarAcciones={false}>
      <div className="form-layout">
        <div className="form-body">
          <Card id="hospital-generales">
            <SectionHeading numero="1" titulo="Datos generales" descripcion="Identificación del paciente" />
            <div className="form-grid">
              <Campo label="Primer nombre" required /><Campo label="Segundo nombre" /><Campo label="Primer apellido" required />
              <Campo label="Segundo apellido" /><Campo label="Fecha de nacimiento" tipo="date" required />
              <FormField label="Género" required>{a => <select {...a}><option value="">Seleccione…</option><option>Femenino</option><option>Masculino</option></select>}</FormField>
              <Campo label="Estado civil" /><Campo label="DPI" placeholder="0000 00000 0000" />
              <FormField label="Tipo de sangre">{a => <select {...a}><option value="">Seleccione…</option>{['O+', 'O−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'].map(t => <option key={t}>{t}</option>)}</select>}</FormField>
              <Campo label="Nacionalidad" />
            </div>
          </Card>
          <Card id="hospital-contacto">
            <SectionHeading numero="2" titulo="Datos de contacto" descripcion="Dónde localizar al paciente" />
            <div className="form-grid"><Campo label="Dirección" /><Campo label="Teléfono" tipo="tel" /><Campo label="Correo electrónico" tipo="email" /></div>
          </Card>
          <Card id="hospital-emergencia">
            <SectionHeading numero="3" titulo="Contacto de emergencia" descripcion="Personas a quienes contactar en una emergencia" />
            <div className="form-grid"><Campo label="Nombre completo" required /><Campo label="Parentesco" required /><Campo label="Teléfono de emergencia" tipo="tel" required /></div>
            <button type="button" className="btn btn-sm mt-4">Agregar otro contacto</button>
          </Card>
          <Card id="hospital-seguro">
            <SectionHeading numero="4" titulo="Seguro médico" descripcion="Opcional" />
            <div className="form-grid"><Campo label="Aseguradora" placeholder="Seleccionar del catálogo" /><Campo label="Número de póliza" /><Campo label="Vigente desde" tipo="date" /><Campo label="Vigente hasta" tipo="date" /></div>
          </Card>
          <Card id="hospital-alergias">
            <SectionHeading numero="5" titulo="Alergias conocidas" descripcion="Información que se mostrará en la consulta y la receta" />
            <div className="form-grid"><Campo label="Alergia (catálogo)" placeholder="Buscar alergia…" />
              <FormField label="Severidad">{a => <select {...a}><option>Leve</option><option>Moderada</option><option>Severa</option></select>}</FormField>
            </div>
            <button type="button" className="btn btn-sm mt-4">Agregar alergia</button>
          </Card>
        </div>
        <div className="form-side">
          <FormSummary titulo="Expediente que se asignará">
            <span className="summary-code">HG · Automático</span><p className="summary-note">El backend asignará el número definitivo al guardar el registro.</p>
            <button type="submit" className="btn btn-primary btn-block">Guardar y abrir historial</button>
            <Link className="btn btn-block" to={enlace('/pacientes')}>Cancelar</Link>
          </FormSummary>
          <Card titulo="Clasificación de los datos"><dl className="classification-list">
            <div><dt>Datos generales y contacto</dt><dd><span className="badge primary plain">Confidencial</span></dd></div>
            <div><dt>Alergias</dt><dd><span className="badge bad plain">Restringida</span></dd></div>
          </dl></Card>
        </div>
      </div>
    </FormularioVistaPrevia>
  </>;
}
