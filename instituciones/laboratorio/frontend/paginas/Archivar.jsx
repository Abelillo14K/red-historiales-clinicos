import { useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { ArchivoInstitucionalVistaPrevia } from '@plataforma/ui/index.js';

export default function Archivar() {
  const { id } = useParams();
  const { enlace } = useModulo();
  return <ArchivoInstitucionalVistaPrevia prefijo="lab-archivo" volver={enlace(`/pacientes/${encodeURIComponent(id)}`)} />;
}
