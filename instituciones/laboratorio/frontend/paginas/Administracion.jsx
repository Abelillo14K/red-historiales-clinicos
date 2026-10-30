import { useLocation } from 'react-router-dom';
import { AdministracionInstitucionalVistaPrevia } from '@plataforma/ui/index.js';

export default function Administracion() {
  const { pathname } = useLocation();
  return <AdministracionInstitucionalVistaPrevia tipo={pathname.split('/').filter(Boolean).at(-1)}
    catalogos={['Exámenes', 'Tipos de muestra', 'Profesionales', 'Parámetros']} />;
}
