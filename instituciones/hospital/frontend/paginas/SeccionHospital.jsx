import { useLocation } from 'react-router-dom';
import Bitacora from './Bitacora.jsx';
import Catalogos from './Catalogos.jsx';
import Hospitalizacion from './Hospitalizacion.jsx';

export default function SeccionHospital() {
  const { pathname } = useLocation();
  const tipo = pathname.split('/').filter(Boolean).at(-1);
  if (tipo === 'catalogos') return <Catalogos />;
  if (tipo === 'bitacora') return <Bitacora />;
  return <Hospitalizacion />;
}
