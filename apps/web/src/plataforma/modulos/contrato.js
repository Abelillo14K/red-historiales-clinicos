// Contrato de módulos institucionales del frontend (versión 1).
// Un módulo describe, sin JSX, qué rutas y navegación aporta y qué permisos exige.
// La plataforma solo carga el módulo de la institución que el BACKEND informa en
// la sesión; nunca hay un selector libre de instituciones ni de motores.
// Ocultar una opción no es seguridad: el backend vuelve a autorizar cada petición.
// Archivo sin React: se prueba desde Node (tests/frontend-modulos.test.js).

export const VERSION_CONTRATO = 1;
const ID = /^[a-z][a-z0-9_]{1,40}$/;
const PERMISO = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
// Primer segmento de ruta que usa la propia plataforma (portal e inicio de sesión).
export const RUTAS_RESERVADAS = ['instituciones', 'login'];

// Lanza un error con todas las incumplimientos del manifiesto.
export function validarModulo(m) {
  const e = [];
  if (!m || typeof m !== 'object') throw new Error('Módulo inválido');
  if (m.contrato !== VERSION_CONTRATO) e.push(`contrato debe ser ${VERSION_CONTRATO}`);
  if (!ID.test(m.institucion || '')) e.push('institucion: identificador en minúsculas (igual al claim del JWT)');
  if (!m.nombre) e.push('nombre requerido');
  if (typeof m.crearApi !== 'function') e.push('crearApi(http) requerido');
  if (!m.roles || typeof m.roles !== 'object') e.push('roles: { clave: etiqueta } requerido');
  if (!Array.isArray(m.rutas) || !m.rutas.length) e.push('rutas: al menos una');
  const caminos = new Set();
  for (const r of m.rutas || []) {
    const donde = `ruta "${r.path}"`;
    if (typeof r.path !== 'string' || r.path.startsWith('/')) e.push(`${donde}: path relativo sin "/" inicial`);
    if (caminos.has(r.path)) e.push(`${donde}: duplicada`);
    if (RUTAS_RESERVADAS.includes(r.path.split('/')[0])) e.push(`${donde}: "${r.path.split('/')[0]}" es una ruta de la plataforma`);
    caminos.add(r.path);
    if (typeof r.cargar !== 'function') e.push(`${donde}: cargar() => import('...') requerido`);
    if (r.permiso !== undefined && !PERMISO.test(r.permiso)) e.push(`${donde}: permiso con formato recurso.accion`);
    if (r.titulo !== undefined && typeof r.titulo !== 'string' && typeof r.titulo !== 'function') e.push(`${donde}: titulo texto o función`);
  }
  for (const n of m.navegacion || []) {
    if (!n.etiqueta || typeof n.to !== 'string') e.push(`navegación "${n.etiqueta}": etiqueta y to requeridos`);
    const destino = n.to.replace(/^\//, '');
    if (!caminos.has(destino) && destino !== '') e.push(`navegación "${n.etiqueta}": "${n.to}" no corresponde a ninguna ruta`);
    if (n.permiso !== undefined && !PERMISO.test(n.permiso)) e.push(`navegación "${n.etiqueta}": permiso inválido`);
  }
  if (!caminos.has('')) e.push('ruta "" (inicio del módulo) requerida');
  if (e.length) throw new Error(`Módulo ${m.institucion || '?'} incumple el contrato: ${e.join('; ')}`);
  return m;
}

// Registro: valida cada módulo y rechaza instituciones repetidas.
export function crearRegistro(modulos) {
  const mapa = new Map();
  for (const m of modulos) {
    validarModulo(m);
    if (mapa.has(m.institucion)) throw new Error(`Institución registrada dos veces: ${m.institucion}`);
    mapa.set(m.institucion, Object.freeze({ ...m }));
  }
  return {
    instituciones: () => [...mapa.keys()],
    modulo: institucion => mapa.get(institucion) || null
  };
}

export const puede = (sesion, permiso) => !permiso || Boolean(sesion?.permisos?.includes(permiso));
export const rutasPara = (modulo, sesion) => (modulo?.rutas || []).filter(r => puede(sesion, r.permiso));
export const navegacionPara = (modulo, sesion) => (modulo?.navegacion || []).filter(n => puede(sesion, n.permiso));

// Estado que la interfaz debe mostrar para una sesión verificada por el backend.
export function resolverSesion(registro, sesion) {
  if (!sesion) return { estado: 'sin_sesion' };
  const modulo = registro.modulo(sesion.institucion);
  if (!modulo) return { estado: 'institucion_sin_interfaz', institucion: sesion.institucion };
  if (!Array.isArray(sesion.permisos)) return { estado: 'sesion_incompleta' };
  return { estado: 'lista', modulo };
}

// Migas de pan: rutas del módulo cuyo patrón coincide con cada prefijo de la ruta actual.
function coincide(patron, partes) {
  const p = patron.split('/').filter(Boolean);
  if (p.length !== partes.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(partes[i]);
    else if (p[i] !== partes[i]) return null;
  }
  return params;
}
export function migasPara(modulo, pathname, contexto = {}) {
  const partes = pathname.split('/').filter(Boolean);
  const migas = [];
  for (let n = 1; n <= partes.length; n++) {
    const prefijo = partes.slice(0, n);
    for (const r of modulo?.rutas || []) {
      const params = coincide(r.path, prefijo);
      if (!params || r.titulo === undefined) continue;
      const titulo = typeof r.titulo === 'function' ? r.titulo(params, contexto) : r.titulo;
      if (titulo) migas.push({ to: `/${prefijo.join('/')}`, titulo });
      break;
    }
  }
  return migas;
}
