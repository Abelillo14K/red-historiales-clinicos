import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { FormularioInstitucionalVistaPrevia } from '@plataforma/ui/index.js';

export default function NuevaSolicitud() {
  const { enlace } = useModulo();
  return <FormularioInstitucionalVistaPrevia titulo="Nueva solicitud de exámenes" descripcion="Identificación de la orden, exámenes solicitados e información de las muestras."
    volver={enlace('/solicitudes')} etiquetaEnvio="Guardar solicitud" resumen={[
      ['Orden', 'Asignación automática'], ['Paciente', 'Sin seleccionar'], ['Exámenes', '—'], ['Muestras', '—']
    ]} secciones={[
      { id: 'lab-solicitud-paciente', titulo: 'Paciente y origen', paso: 'Paciente', campos: [
        { label: 'Paciente o expediente', tipo: 'search', required: true }, { label: 'Institución remitente' },
        { label: 'Profesional solicitante' }, { label: 'Fecha de solicitud', tipo: 'datetime-local', required: true }
      ] },
      { id: 'lab-solicitud-examenes', titulo: 'Exámenes solicitados', paso: 'Exámenes', campos: [
        { label: 'Examen (catálogo)', tipo: 'search', required: true }, { label: 'Prioridad', opciones: ['Rutina', 'Urgente'] },
        { label: 'Motivo de la solicitud', tipo: 'textarea', full: true }
      ] },
      { id: 'lab-solicitud-muestra', titulo: 'Información de la muestra', paso: 'Muestra', campos: [
        { label: 'Tipo de muestra', opciones: [] }, { label: 'Fecha y hora de toma', tipo: 'datetime-local' },
        { label: 'Código de muestra' }, { label: 'Observaciones de recepción', tipo: 'textarea', full: true }
      ] },
      { id: 'lab-solicitud-notas', titulo: 'Indicaciones y observaciones', paso: 'Observaciones', campos: [
        { label: 'Indicaciones de preparación registradas', tipo: 'textarea', full: true },
        { label: 'Observaciones de la solicitud', tipo: 'textarea', full: true }
      ] }
    ]} />;
}
