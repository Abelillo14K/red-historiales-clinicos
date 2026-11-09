import { PageHeader, SectionIntro } from '@plataforma/ui/index.js';
import { ListadoPacientes } from './Pacientes.jsx';

export default function Archivados() {
  return (
    <>
      <PageHeader titulo="Historiales archivados" descripcion="Expedientes dados de baja. Se conservan completos y en modo de solo lectura." />
      <SectionIntro titulo="Expedientes conservados" icono="archivo" descripcion="Consultas, tratamientos y odontograma de expedientes archivados, en solo lectura." />
      <ListadoPacientes estadoFijo="Archivado" />
    </>
  );
}
