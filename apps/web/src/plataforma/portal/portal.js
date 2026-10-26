// Portal de instituciones: estado de cada tarjeta para la sesión verificada.
// Es NAVEGACIÓN, no autorización: no cambia la sesión, no pide tokens ni decide permisos.
// La institución de la sesión la informa siempre el backend en GET /api/sesion; el
// backend vuelve a autorizar cada petición. Archivo sin React (tests/frontend-portal.test.js).
import { resolverSesion } from '../modulos/contrato.js';

export const RUTA_PORTAL = '/instituciones';

// Estados de una tarjeta:
//  disponible        módulo conectado y la sesión pertenece a esa institución → «Ingresar».
//  sin_autorizacion  módulo conectado, pero la sesión es de otra institución.
//  pendiente         módulo sin backend (no registrado en registro.js): sin acceso real.
export const ESTADOS = {
  disponible: { etiqueta: 'Disponible', tono: 'ok' },
  sin_autorizacion: { etiqueta: 'Sin autorización', tono: 'bad' },
  pendiente: { etiqueta: 'Pendiente de integración', tono: 'warn' }
};

// PUNTO DE INTEGRACIÓN multiinstitución. Hoy cada sesión pertenece a UNA institución
// (claim `institucion`, confirmado por /api/sesion). Cuando un usuario pueda trabajar en
// varias, el backend deberá informarlas en /api/sesion y ofrecer un mecanismo autorizado
// para cambiar de institución (emitir la sesión de la otra institución); esta función y la
// acción «Ingresar» serán los únicos lugares que cambien. No se deducen permisos aquí.
export const sesionAutorizaA = (sesion, institucion) => Boolean(institucion) && sesion?.institucion === institucion;

// presentaciones: [{ carpeta, nombre, sigla, descripcion, icono, orden }] (presentacion.js
// de cada institución). Un módulo registrado se reconoce porque su manifiesto reutiliza esa
// presentación (mismo nombre); los módulos sin registrar no aportan su identificador.
export function tarjetasPortal(presentaciones, registro, sesion) {
  const conectados = registro.instituciones().map(registro.modulo);
  const resolucion = resolverSesion(registro, sesion);
  return presentaciones.map(p => {
    const modulo = conectados.find(m => m.nombre === p.nombre) || null;
    let estado = 'pendiente';
    if (modulo) {
      estado = resolucion.estado === 'lista' && resolucion.modulo.institucion === modulo.institucion && sesionAutorizaA(sesion, modulo.institucion)
        ? 'disponible' : 'sin_autorizacion';
    }
    return { ...p, institucion: modulo?.institucion || null, estado };
  }).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));
}

// Destino después de iniciar sesión: la página que se pidió antes (enlaces profundos) o,
// si se entró por la raíz o directamente al inicio de sesión, el portal.
export const destinoTrasLogin = desde => (desde && desde !== '/' && desde !== '/login' ? desde : RUTA_PORTAL);
