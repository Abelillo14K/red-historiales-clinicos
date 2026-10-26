import { Suspense, lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { SinPermiso } from '../paginas/EstadosSesion.jsx';
import { EmptyState, LoadingState } from '../ui/index.js';
import { useModulo } from './ModuloContext.jsx';

// Un componente diferido por cada función cargar() del manifiesto (la misma
// función compartida por dos rutas produce el mismo componente).
const diferidos = new Map();
const diferido = cargar => {
  if (!diferidos.has(cargar)) diferidos.set(cargar, lazy(cargar));
  return diferidos.get(cargar);
};

// Rutas declaradas en el manifiesto del módulo activo. Una ruta sin permiso muestra
// «Sin permiso»: es solo presentación, el backend vuelve a autorizar cada petición.
export default function RutasModulo() {
  const { modulo, puede, enlace } = useModulo();
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        {modulo.rutas.map(r => {
          const Pagina = diferido(r.cargar);
          return <Route key={r.path} path={r.path || undefined} index={!r.path || undefined}
            element={puede(r.permiso) ? <Pagina /> : <SinPermiso />} />;
        })}
        <Route path="*" element={<EmptyState titulo="Página no encontrada" accion={<Link className="btn" to={enlace('/')}>Volver al inicio</Link>} />} />
      </Routes>
    </Suspense>
  );
}
