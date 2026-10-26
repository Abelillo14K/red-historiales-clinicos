// Alias de importación del frontend: ÚNICO lugar donde se definen.
// Los usan vite.config.js (aplicación) y tests/soporte/alias-frontend.mjs (pruebas en Node).
//   @plataforma/...    → apps/web/src/plataforma/...   (base común: ui, sesión, layout, api)
//   @instituciones/... → instituciones/...             (módulos React de cada institución)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(WEB, '..', '..');
export const INSTITUCIONES = path.join(RAIZ, 'instituciones');

export const ALIAS = {
  '@plataforma': path.join(WEB, 'src', 'plataforma'),
  '@instituciones': INSTITUCIONES
};

// Dependencias que los módulos de instituciones/ resuelven desde apps/web/node_modules
// (no tienen node_modules propios): una sola copia de React para toda la interfaz.
export const COMPARTIDAS = ['react', 'react-dom', 'react-router-dom'];
