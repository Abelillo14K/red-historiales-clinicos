import { Link, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, FormField, FormSummary, FormularioVistaPrevia, PageHeader, PendienteIntegracion, SectionHeading } from '@plataforma/ui/index.js';

const VITALES = [
  ['P. sistólica (mmHg)', 'number'], ['P. diastólica (mmHg)', 'number'], ['Frec. cardíaca (lpm)', 'number'],
  ['Frec. resp. (rpm)', 'number'], ['Temperatura (°C)', 'number'], ['Saturación O₂ (%)', 'number'], ['Peso (kg)', 'number'], ['Talla (m)', 'number']
];

export default function NuevaConsulta() {
  const { id } = useParams();
  const { enlace } = useModulo();
  const volver = enlace(`/pacientes/${encodeURIComponent(id)}`);
  return <>
    <PageHeader titulo="Nueva consulta" descripcion="Datos de la atención, notas clínicas, diagnósticos, receta y orden de exámenes."
      acciones={<Link className="btn" to={volver}>Volver al historial</Link>} />
    <PendienteIntegracion compacto />
    <FormularioVistaPrevia titulo="Nueva consulta hospitalaria" mostrarAcciones={false}>
      <div className="form-layout">
        <div className="form-body">
          <Card><SectionHeading numero="1" titulo="Datos de la consulta" />
            <div className="archive-reasons consultation-origin">
              <label className="archive-reason"><input type="radio" name="origen" defaultChecked /><span><b>Desde cita programada</b><small>Seleccionar una cita del paciente</small></span></label>
              <label className="archive-reason"><input type="radio" name="origen" /><span><b>Directa o emergencia</b><small>Atención sin cita previa</small></span></label>
            </div>
            <div className="form-grid"><FormField label="Médico responsable" required>{a => <select {...a}><option>Seleccionar médico…</option></select>}</FormField>
              <FormField label="Fecha y hora" required>{a => <input {...a} type="datetime-local" />}</FormField>
              <FormField label="Motivo de consulta" full required>{a => <input {...a} />}</FormField>
            </div>
          </Card>
          <Card><SectionHeading numero="2" titulo="Signos vitales" />
            <div className="form-grid">{VITALES.map(([label, tipo]) => <FormField key={label} label={label}>{a => <input {...a} type={tipo} step="any" />}</FormField>)}</div>
            <div className="calculated-value"><span>IMC (calculado)</span><strong>—</strong><small>Se calculará con peso y talla</small></div>
          </Card>
          <Card><SectionHeading numero="3" titulo="Notas clínicas" />
            <div className="form-grid">{['Anamnesis', 'Examen físico', 'Plan de tratamiento'].map(label => <FormField key={label} label={label}>{a => <textarea {...a} rows={4} />}</FormField>)}</div>
          </Card>
          <Card><SectionHeading numero="4" titulo="Diagnósticos" descripcion="Diagnóstico principal y secundarios del catálogo CIE-10" />
            <div className="form-grid"><FormField label="Buscar en catálogo CIE-10">{a => <input {...a} type="search" placeholder="Código o descripción…" />}</FormField>
              <FormField label="Tipo de diagnóstico">{a => <select {...a}><option>Principal</option><option>Secundario</option></select>}</FormField>
            </div><button type="button" className="btn btn-sm mt-4">Agregar diagnóstico</button>
          </Card>
          <Card><SectionHeading numero="5" titulo="Receta" descripcion="Medicamentos e indicaciones de la consulta" />
            <div className="form-grid">{['Medicamento', 'Dosis', 'Frecuencia', 'Vía de administración', 'Duración'].map(label => <FormField key={label} label={label}>{a => <input {...a} />}</FormField>)}</div>
            <button type="button" className="btn btn-sm mt-4">Agregar medicamento</button>
            <div className="mt-4"><FormField label="Indicaciones generales">{a => <textarea {...a} />}</FormField></div>
            <p className="criteria">Las alergias y alertas asociadas a medicamentos se mostrarán aquí cuando estén disponibles los catálogos y datos del paciente.</p>
          </Card>
          <Card><SectionHeading numero="6" titulo="Orden de exámenes" />
            <FormField label="Examen (catálogo)">{a => <input {...a} type="search" placeholder="Buscar examen…" />}</FormField>
            <button type="button" className="btn btn-sm mt-4">Agregar examen</button>
          </Card>
        </div>
        <div className="form-side"><FormSummary items={[
          ['Signos vitales', 'Sin datos'], ['Diagnósticos', '—'], ['Medicamentos', '—'], ['Exámenes', '—'], ['Alertas', 'Sin evaluar']
        ]}>
          <p className="summary-note">Consulta, receta y exámenes se enviarán juntos al backend del Hospital.</p>
          <button type="submit" className="btn btn-primary btn-block">Guardar consulta</button>
          <Link className="btn btn-block" to={volver}>Cancelar</Link>
        </FormSummary></div>
      </div>
    </FormularioVistaPrevia>
  </>;
}
