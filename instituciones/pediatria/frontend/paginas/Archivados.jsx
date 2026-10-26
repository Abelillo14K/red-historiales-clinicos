import { PageHeader } from '@plataforma/ui/index.js';
import { ListadoPacientes } from './Pacientes.jsx';

export default function Archivados() {
  return (
    <>
      <PageHeader titulo="Historiales archivados" descripcion="Pacientes dados de baja (traslado, fallecimiento u otra causa administrativa). Se conservan completos y en modo de solo lectura." />
      <ListadoPacientes estadoFijo="Archivado" />
    </>
  );
}
