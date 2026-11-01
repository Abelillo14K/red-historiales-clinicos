import { PageHeader, PendienteIntegracion, SectionIntro } from '@plataforma/ui/index.js';
import { ListadoPacientes } from './Pacientes.jsx';

export default function Archivados() {
  return (
    <>
      <PageHeader titulo="Historiales archivados" descripcion="Expedientes dados de baja. Se conservan completos y en modo de solo lectura." />
      <PendienteIntegracion compacto />
      <SectionIntro titulo="Expedientes conservados" icono="archivo" descripcion="Consulta de solicitudes y resultados históricos de expedientes archivados." />
      <ListadoPacientes archivados />
    </>
  );
}
