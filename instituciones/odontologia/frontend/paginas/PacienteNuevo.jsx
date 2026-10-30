import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { FormularioInstitucionalVistaPrevia } from '@plataforma/ui/index.js';

export default function PacienteNuevo() {
  const { enlace } = useModulo();
  return <FormularioInstitucionalVistaPrevia titulo="Registrar paciente" descripcion="Identificación, contacto y antecedentes del expediente odontológico."
    volver={enlace('/pacientes')} etiquetaEnvio="Guardar y abrir historial" resumen={[
      ['Institución', 'Clínica Odontológica'], ['Expediente', 'Asignación automática'], ['Secciones', '4']
    ]} secciones={[
      { id: 'odonto-generales', titulo: 'Datos generales', campos: [
        { label: 'Nombres', required: true }, { label: 'Apellidos', required: true },
        { label: 'Fecha de nacimiento', tipo: 'date', required: true }, { label: 'Sexo', opciones: ['Femenino', 'Masculino'], required: true }, { label: 'Documento de identidad' }
      ] },
      { id: 'odonto-contacto', titulo: 'Datos de contacto', paso: 'Contacto', campos: [
        { label: 'Teléfono', tipo: 'tel' }, { label: 'Correo electrónico', tipo: 'email' }, { label: 'Dirección', full: true },
        { label: 'Contacto de emergencia' }, { label: 'Teléfono de emergencia', tipo: 'tel' }
      ] },
      { id: 'odonto-antecedentes', titulo: 'Antecedentes y alergias', paso: 'Antecedentes', campos: [
        { label: 'Antecedentes médicos', tipo: 'textarea' }, { label: 'Alergias conocidas', tipo: 'textarea' },
        { label: 'Medicamentos que utiliza', tipo: 'textarea', full: true }
      ] },
      { id: 'odonto-atencion', titulo: 'Información odontológica', paso: 'Atención dental', campos: [
        { label: 'Motivo de la primera atención', full: true }, { label: 'Última atención odontológica', tipo: 'date' },
        { label: 'Observaciones iniciales', tipo: 'textarea', full: true }
      ] }
    ]} />;
}
