import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ALIAS, COMPARTIDAS, INSTITUCIONES, WEB } from './alias.js';

// En desarrollo Vite redirige /api, /auth y /salud a la API Express.
// xfwd agrega la IP real del cliente al final de X-Forwarded-For: con `vite --host`,
// la API (trust proxy = loopback) la ve y no confunde un equipo remoto con el local.
// changeOrigin es el valor que Vite usaba con la forma abreviada (solo la URL).
const API = process.env.VITE_API_PROXY || 'http://localhost:3001';
const destino = { target: API, changeOrigin: true, xfwd: true };
export default defineConfig({
  plugins: [react()],
  // Los módulos institucionales viven fuera de esta carpeta (instituciones/<x>/frontend):
  // se importan con alias y usan las dependencias de esta aplicación (dedupe).
  resolve: { alias: ALIAS, dedupe: COMPARTIDAS },
  // La exploración inicial de dependencias no recorre instituciones/: sin esta lista, Vite
  // descubriría React Router a mitad de la carga y lo re-optimizaría (dos copias de React).
  optimizeDeps: { include: [...COMPARTIDAS, 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  server: {
    port: 5173,
    proxy: { '/api': destino, '/auth': destino, '/salud': destino },
    // Solo se sirven archivos de la aplicación y de instituciones/ (nunca la raíz con .env).
    fs: { allow: [WEB, INSTITUCIONES] }
  },
  build: { outDir: 'dist', sourcemap: false }
});
