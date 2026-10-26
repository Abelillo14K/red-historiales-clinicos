// Vista previa de DESARROLLO de los módulos institucionales pendientes de integración.
// App.jsx solo la carga cuando import.meta.env.DEV es true (servidor `vite`); la
// compilación de producción no la incluye (tests/frontend-equipo.test.js lo comprueba).
//
// Garantías:
//  - No lee ni modifica la sesión autenticada (no usa useSesion) y no emite tokens.
//  - No construye la api del módulo (api = null): sus páginas no pueden hacer peticiones.
//  - Solo muestra módulos NO registrados; uno conectado se usa con su sesión real.
//  - Todas las rutas del módulo se muestran (los permisos reales los decide su backend).
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { ModuloProvider } from '../modulos/ModuloContext.jsx';
import RutasModulo from '../modulos/RutasModulo.jsx';
import AppLayout from '../layout/AppLayout.jsx';
import { EmptyState, Icon } from '../ui/index.js';
import { buscar, esEquipoLocal } from './catalogo.js';
import EstadoIntegracion, { PaginaVistaPrevia } from './EstadoIntegracion.jsx';
import ControlesVistaPrevia from './ControlesVistaPrevia.jsx';

const todoVisible = () => true;

function ModuloEnVistaPrevia() {
  const { institucion } = useParams();
  const item = buscar(institucion);
  if (!item || item.conectado) {
    return (
      <PaginaVistaPrevia>
        <EmptyState icono="institucion" titulo={item ? 'Este módulo ya está conectado' : 'Módulo no encontrado'}
          accion={<Link className="btn" to={item ? '/login' : '/vista-previa'}>{item ? 'Ir al inicio de sesión' : 'Volver al estado de integración'}</Link>}>
          {item ? `${item.modulo.nombre} tiene backend: se usa con la sesión real que emite su servidor, no en la vista previa.` : `No hay un módulo con el identificador «${institucion}».`}
        </EmptyState>
      </PaginaVistaPrevia>
    );
  }
  const { modulo } = item;
  return (
    <ModuloProvider modulo={modulo} puede={todoVisible} base={`/vista-previa/${modulo.institucion}`} vistaPrevia>
      <AppLayout encabezadoFin={<ControlesVistaPrevia regreso={
        <Link className="btn btn-sm preview-back" to="/vista-previa" title="Volver al estado de integración"><Icon name="institucion" size={16} /><span>Estado de integración</span></Link>
      } />}>
        <div className="preview-banner" role="note">
          <Icon name="ojo" />
          <span><b>Vista previa de desarrollo.</b> Sin sesión ni backend: no se consultan datos ni se guarda nada. Se muestran todas las secciones; los permisos reales los definirá el backend de {modulo.nombre}.</span>
        </div>
        <RutasModulo />
      </AppLayout>
    </ModuloProvider>
  );
}

export default function VistaPrevia() {
  if (!esEquipoLocal()) {
    return (
      <PaginaVistaPrevia>
        <EmptyState icono="auditoria" titulo="Vista previa no disponible">La vista previa de desarrollo solo se atiende desde el propio equipo (localhost).</EmptyState>
      </PaginaVistaPrevia>
    );
  }
  return (
    <Routes>
      <Route index element={<EstadoIntegracion />} />
      <Route path=":institucion/*" element={<ModuloEnVistaPrevia />} />
    </Routes>
  );
}
