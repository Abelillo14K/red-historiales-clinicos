import { useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { FormularioInstitucionalVistaPrevia } from '@plataforma/ui/index.js';

export default function NuevaConsulta() {
  const { id } = useParams();
  const { enlace } = useModulo();
  return <FormularioInstitucionalVistaPrevia titulo="Nueva consulta odontológica" descripcion="Datos de atención, evaluación dental, diagnósticos, tratamiento y receta."
    volver={enlace(`/pacientes/${encodeURIComponent(id)}`)} etiquetaEnvio="Guardar consulta" resumen={[
      ['Expediente', 'Sin paciente'], ['Diagnósticos', '—'], ['Tratamientos por pieza', '—'], ['Medicamentos', '—']
    ]} secciones={[
      { id: 'odonto-consulta', titulo: 'Datos de la consulta', paso: 'Atención', campos: [
        { label: 'Odontólogo responsable', opciones: [], required: true }, { label: 'Fecha y hora', tipo: 'datetime-local', required: true },
        { label: 'Motivo de consulta', required: true, full: true }
      ] },
      { id: 'odonto-evaluacion', titulo: 'Evaluación odontológica', paso: 'Evaluación', campos: [
        { label: 'Antecedentes de la atención', tipo: 'textarea' }, { label: 'Examen bucal', tipo: 'textarea' },
        { label: 'Hallazgos', tipo: 'textarea', full: true }
      ] },
      { id: 'odonto-diagnosticos', titulo: 'Diagnósticos', campos: [
        { label: 'Código del diagnóstico' }, { label: 'Descripción del diagnóstico' }, { label: 'Pieza o zona asociada' }
      ] },
      { id: 'odonto-tratamiento', titulo: 'Tratamiento por pieza', paso: 'Tratamiento', campos: [
        { label: 'Pieza (identificador)' }, { label: 'Procedimiento', opciones: [] },
        { label: 'Descripción del tratamiento', tipo: 'textarea', full: true }, { label: 'Recomendaciones', tipo: 'textarea', full: true }
      ] },
      { id: 'odonto-receta', titulo: 'Receta e indicaciones', paso: 'Receta', campos: [
        { label: 'Medicamento' }, { label: 'Dosis' }, { label: 'Frecuencia' }, { label: 'Duración' }, { label: 'Vía de administración' },
        { label: 'Indicaciones generales', tipo: 'textarea', full: true }
      ] }
    ]} />;
}
