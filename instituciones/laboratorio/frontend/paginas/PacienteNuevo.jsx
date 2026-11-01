import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { FormularioInstitucionalVistaPrevia } from '@plataforma/ui/index.js';

export default function PacienteNuevo() {
  const { enlace } = useModulo();
  return <FormularioInstitucionalVistaPrevia titulo="Registrar paciente" descripcion="Datos del paciente, contacto e información para su atención en el laboratorio."
    volver={enlace('/pacientes')} etiquetaEnvio="Guardar y abrir historial" resumen={[
      ['Institución', 'Laboratorio Clínico'], ['Expediente', 'Asignación automática'], ['Secciones', '3']
    ]} secciones={[
      { id: 'lab-generales', titulo: 'Datos generales', campos: [
        { label: 'Nombres', required: true }, { label: 'Apellidos', required: true }, { label: 'Documento de identidad' },
        { label: 'Fecha de nacimiento', tipo: 'date', required: true }, { label: 'Sexo', opciones: ['Femenino', 'Masculino'], required: true }
      ] },
      { id: 'lab-contacto', titulo: 'Datos de contacto', paso: 'Contacto', campos: [
        { label: 'Teléfono', tipo: 'tel' }, { label: 'Correo electrónico', tipo: 'email' }, { label: 'Dirección', full: true },
        { label: 'Contacto de emergencia' }, { label: 'Teléfono de emergencia', tipo: 'tel' }
      ] },
      { id: 'lab-atencion', titulo: 'Información de atención', paso: 'Atención', campos: [
        { label: 'Institución remitente' }, { label: 'Profesional solicitante' },
        { label: 'Observaciones para la atención', tipo: 'textarea', full: true }
      ] }
    ]} />;
}
