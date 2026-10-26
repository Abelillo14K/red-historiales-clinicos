// Catálogo de módulos para la vista previa de desarrollo (solo se carga con `vite`).
// Descubre automáticamente cada instituciones/<carpeta>/frontend/modulo.js: un integrante no tiene
// que editar ningún archivo compartido para ver su módulo aquí.
// «Conectado» = registrado en registro.js (su backend ya atiende /api/sesion).
import { validarModulo } from '../modulos/contrato.js';
import { registro } from '../modulos/registro.js';

const manifiestos = import.meta.glob('@instituciones/*/frontend/modulo.js', { eager: true });

// Cliente que nunca hace peticiones: solo sirve para contar las operaciones que
// declara crearApi(http) sin ejecutar ninguna.
const bloqueado = () => { throw new Error('La vista previa no realiza peticiones'); };
const httpBloqueado = { solicitar: bloqueado, get: bloqueado, post: bloqueado, put: bloqueado, patch: bloqueado };
const contarOperaciones = o => Object.values(o || {}).reduce((n, v) => n + (typeof v === 'function' ? 1 : v && typeof v === 'object' ? contarOperaciones(v) : 0), 0);

// Mismo orden que el portal (campo `orden` de presentacion.js); empates, por carpeta.
export const catalogo = Object.entries(manifiestos).map(([ruta, m]) => {
  const carpeta = ruta.split('/').at(-3); // instituciones/<carpeta>/frontend/modulo.js
  const modulo = m.default;
  try {
    validarModulo(modulo);
    return {
      carpeta, modulo, error: null,
      conectado: Boolean(registro.modulo(modulo.institucion)),
      operaciones: contarOperaciones(modulo.crearApi(httpBloqueado))
    };
  } catch (e) {
    return { carpeta, modulo: null, error: e.message, conectado: false, operaciones: 0 };
  }
}).sort((a, b) => (a.modulo?.orden ?? 99) - (b.modulo?.orden ?? 99) || a.carpeta.localeCompare(b.carpeta));

export const buscarPorCarpeta = carpeta => catalogo.find(x => x.carpeta === carpeta) || null;

export const buscar = institucion => catalogo.find(x => x.modulo?.institucion === institucion) || null;

// La vista previa solo se atiende desde el propio equipo (también con `vite --host`).
export const esEquipoLocal = () => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
