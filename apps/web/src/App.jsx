import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSesion } from './plataforma/sesion/SesionContext.jsx';
import AppLayout from './plataforma/layout/AppLayout.jsx';
import Login from './plataforma/paginas/Login.jsx';
import { InstitucionSinInterfaz } from './plataforma/paginas/EstadosSesion.jsx';
import { ModuloProvider } from './plataforma/modulos/ModuloContext.jsx';
import RutasModulo from './plataforma/modulos/RutasModulo.jsx';
import Portal from './plataforma/portal/Portal.jsx';
import { RUTA_PORTAL } from './plataforma/portal/portal.js';
import { LoadingState } from './plataforma/ui/index.js';

// Vista previa de los módulos pendientes: SOLO en desarrollo (vite). En la compilación
// de producción import.meta.env.DEV es false y Vite elimina la rama y su código.
const VistaPrevia = import.meta.env.DEV ? lazy(() => import('./plataforma/vista-previa/VistaPrevia.jsx')) : null;

// Toda ruta privada exige una sesión verificada por el backend (GET /api/sesion).
function RequiereSesion({ children }) {
  const { sesion, verificando, salidaVoluntaria } = useSesion();
  const loc = useLocation();
  if (verificando) return <LoadingState texto="Verificando sesión…" />;
  if (!sesion) return <Navigate to="/login" replace state={salidaVoluntaria ? undefined : { desde: loc.pathname }} />;
  return children;
}

function ZonaInstitucion() {
  const { api, sesion, resolucion, puede } = useSesion();
  if (resolucion.estado !== 'lista') return <InstitucionSinInterfaz resolucion={resolucion} />;
  // El módulo es SIEMPRE el de la institución que informó el backend en /api/sesion.
  return (
    <ModuloProvider modulo={resolucion.modulo} api={api} puede={puede} sesion={sesion}>
      <AppLayout>
        <RutasModulo />
      </AppLayout>
    </ModuloProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {VistaPrevia && (
        <Route path="/vista-previa/*" element={<Suspense fallback={<LoadingState />}><VistaPrevia /></Suspense>} />
      )}
      {/* Portal de instituciones: navegación posterior al inicio de sesión (no cambia la sesión). */}
      <Route path={RUTA_PORTAL} element={<RequiereSesion><Portal /></RequiereSesion>} />
      <Route path="/*" element={<RequiereSesion><ZonaInstitucion /></RequiereSesion>} />
    </Routes>
  );
}
