import { PageHeader, PendienteIntegracion } from '@plataforma/ui/index.js';
import { ListadoPacientes } from './Pacientes.jsx';

export default function Archivados() {
  return (
    <>
      <PageHeader titulo="Historiales archivados" descripcion="Expedientes dados de baja. Se conservan completos y en modo de solo lectura." />
      <PendienteIntegracion compacto />
      <ListadoPacientes archivados />
    </>
  );
}
