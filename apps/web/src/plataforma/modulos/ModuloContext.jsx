import { createContext, useContext } from 'react';

// Contexto del módulo institucional que se está mostrando. Lo usan el layout común
// y las páginas de los módulos para no depender de cómo se montó el módulo:
//  - Aplicación real (App.jsx): módulo, api y permisos salen de la sesión que validó
//    el backend; base = '' y vistaPrevia = false.
//  - Vista previa de desarrollo (plataforma/vista-previa): sin sesión ni api;
//    base = '/vista-previa/<institucion>' y vistaPrevia = true.
// No reemplaza a useSesion(): la identidad y el cierre de sesión siguen allí.
//
//   const { api, puede, enlace, vistaPrevia } = useModulo();
//   <Link to={enlace('/pacientes')}>…</Link>
const ModuloCtx = createContext(null);

// Segmento de ruta que la vista previa usa en lugar de un identificador real para
// mostrar la estructura de un expediente sin paciente (nunca se envía a una API).
export const ID_VISTA_PREVIA = 'vista-previa';

export function ModuloProvider({ modulo, api = null, puede, sesion = null, base = '', vistaPrevia = false, children }) {
  const enlace = to => (base ? (to === '/' ? base : `${base}${to}`) : to);
  const valor = { modulo, api, puede, sesion, base, vistaPrevia, enlace };
  return <ModuloCtx.Provider value={valor}>{children}</ModuloCtx.Provider>;
}

export function useModulo() {
  const v = useContext(ModuloCtx);
  if (!v) throw new Error('useModulo() debe usarse dentro de <ModuloProvider>');
  return v;
}
