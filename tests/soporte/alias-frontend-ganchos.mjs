// Ganchos de resolución de Node para los alias del frontend (ver alias-frontend.mjs).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALIAS, INSTITUCIONES } from '../../apps/web/alias.js';

const prefijos = Object.entries(ALIAS).map(([alias, dir]) => [`${alias}/`, dir]);
const FRONTENDS = pathToFileURL(INSTITUCIONES).href;

export async function resolve(especificador, contexto, siguiente) {
  for (const [prefijo, dir] of prefijos) {
    if (especificador.startsWith(prefijo)) {
      return siguiente(pathToFileURL(path.join(dir, especificador.slice(prefijo.length))).href, contexto);
    }
  }
  return siguiente(especificador, contexto);
}

// Los módulos de instituciones/<x>/frontend/ son ESM (como toda la aplicación web) aunque
// el package.json más cercano sea el de la raíz (CommonJS, del backend).
export async function load(url, contexto, siguiente) {
  if (url.startsWith(FRONTENDS) && /\/frontend\/.*\.js$/.test(url)) return siguiente(url, { ...contexto, format: 'module' });
  return siguiente(url, contexto);
}
