import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { FormularioInstitucionalVistaPrevia } from '@plataforma/ui/index.js';

export default function RegistrarResultado() {
  const { enlace } = useModulo();
  return <FormularioInstitucionalVistaPrevia titulo="Registrar resultado" descripcion="Datos del examen, parámetros analizados y validación profesional."
    volver={enlace('/resultados')} etiquetaEnvio="Guardar resultado" resumen={[
      ['Solicitud', 'Sin seleccionar'], ['Examen', '—'], ['Parámetros', '—'], ['Validación', 'Pendiente de integración']
    ]} secciones={[
      { id: 'lab-resultado-origen', titulo: 'Solicitud y examen', paso: 'Origen', campos: [
        { label: 'Solicitud de origen', tipo: 'search', required: true }, { label: 'Examen', opciones: [], required: true },
        { label: 'Código de muestra' }, { label: 'Fecha del análisis', tipo: 'datetime-local', required: true }
      ] },
      { id: 'lab-resultado-parametros', titulo: 'Parámetros del resultado', paso: 'Parámetros', descripcion: 'La estructura se adapta al tipo de examen que defina el laboratorio.', campos: [
        { label: 'Parámetro' }, { label: 'Resultado registrado' }, { label: 'Unidad' }, { label: 'Referencia del laboratorio' },
        { label: 'Observaciones del análisis', tipo: 'textarea', full: true }
      ] },
      { id: 'lab-resultado-validacion', titulo: 'Validación y emisión', paso: 'Validación', campos: [
        { label: 'Profesional responsable', opciones: [], required: true }, { label: 'Fecha de emisión', tipo: 'datetime-local' },
        { label: 'Observaciones del informe', tipo: 'textarea', full: true }
      ] }
    ]} />;
}
