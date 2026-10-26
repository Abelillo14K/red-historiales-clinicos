// Registra la resolución de los alias del frontend (@plataforma, @instituciones) para las
// pruebas que importan módulos del frontend desde Node. Se carga con:
//   node --import ./tests/soporte/alias-frontend.mjs --test ...
// Los alias se leen de apps/web/alias.js: el mismo origen que usa Vite.
import { register } from 'node:module';

register('./alias-frontend-ganchos.mjs', import.meta.url);
