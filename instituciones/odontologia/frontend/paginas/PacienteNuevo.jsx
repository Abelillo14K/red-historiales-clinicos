import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, FormField, FormularioVistaPrevia, Icon, PageHeader, PendienteIntegracion } from '@plataforma/ui/index.js';

// Registro de paciente: solo los datos comunes del contrato (§5.1). Formulario deshabilitado
// y sin envío: nunca se muestra «registro guardado» ni se genera un código.
export default function PacienteNuevo() {
  const { enlace } = useModulo();
  return (
    <>
      <PageHeader titulo="Registrar paciente" descripcion="Alta de un expediente odontológico nuevo. El código lo asignará el backend."
        acciones={<Link className="btn" to={enlace('/pacientes')}>Volver</Link>} />
      <PendienteIntegracion compacto>El formulario está deshabilitado: no se guardará ningún dato hasta conectar el backend de la clínica.</PendienteIntegracion>
      <FormularioVistaPrevia titulo="Registro de paciente" etiquetaEnvio="Registrar paciente">
        <Card titulo="Datos generales" descripcion="Datos mínimos comunes a todas las instituciones.">
          <div className="form-grid">
            <FormField label="Nombres" required>{a => <input {...a} maxLength={255} />}</FormField>
            <FormField label="Apellidos" required>{a => <input {...a} maxLength={255} />}</FormField>
            <FormField label="Fecha de nacimiento" required>{a => <input {...a} type="date" />}</FormField>
            <FormField label="Sexo" required>{a => <select {...a}><option value="">Seleccione…</option><option value="F">Femenino</option><option value="M">Masculino</option></select>}</FormField>
          </div>
        </Card>
        <Card titulo="Datos propios de la clínica">
          <div className="reserved-slot">
            <span className="state-icon" aria-hidden="true"><Icon name="diente" size={22} /></span>
            <div>
              <b>Espacio reservado</b>
              <p>Los campos específicos de la Clínica Odontológica se agregarán aquí cuando su backend defina el modelo de datos.</p>
            </div>
          </div>
        </Card>
      </FormularioVistaPrevia>
    </>
  );
}
