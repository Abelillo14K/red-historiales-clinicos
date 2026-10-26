import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { crearApiPlataforma, crearHttp } from '../api/http.js';
import { puede as tienePermiso, resolverSesion } from '../modulos/contrato.js';

// Sesión basada en el JWT que valida el backend. Formas de obtener el token:
//  1) Desarrollo: POST /auth/dev-login (solo si el backend lo habilita).
//  2) Acceso institucional (inicio de sesión común, pendiente del equipo): redirige con
//     #access_token=<JWT> (fragmento: no viaja al servidor ni a los registros) o se pega el token.
// La institución y los permisos SIEMPRE provienen de GET /api/sesion, nunca del token
// decodificado en el navegador ni de una elección del usuario.
const CLAVE = 'plataforma.token';
const leer = () => { try { return sessionStorage.getItem(CLAVE) || sessionStorage.getItem('pediatria.token'); } catch { return null; } };
const guardar = t => {
  try {
    sessionStorage.removeItem('pediatria.token'); // clave anterior a la plataforma compartida
    if (t) sessionStorage.setItem(CLAVE, t); else sessionStorage.removeItem(CLAVE);
  } catch { /* almacenamiento no disponible */ }
};

function tokenDesdeFragmento() {
  const m = /[#&]access_token=([A-Za-z0-9._-]+)/.exec(window.location.hash);
  if (!m) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return m[1];
}

const MENSAJES_403 = {
  INSTITUCION_NO_REGISTRADA: 'Su institución todavía no está conectada a este servidor.',
  INSTITUCION_NO_AUTORIZADA: 'El token no pertenece a una institución o rol autorizados en este servidor.'
};

const SesionCtx = createContext(null);

export function SesionProvider({ registro, children }) {
  const [token, setToken] = useState(() => tokenDesdeFragmento() || leer());
  const [sesion, setSesion] = useState(null);
  const [verificando, setVerificando] = useState(Boolean(token));
  const [aviso, setAviso] = useState(null);
  // true tras un cierre de sesión voluntario (no se recuerda la página previa).
  const [salidaVoluntaria, setSalidaVoluntaria] = useState(false);

  const cerrarSesion = useCallback((motivo = null, voluntaria = false) => {
    guardar(null); setToken(null); setSesion(null); setAviso(motivo); setSalidaVoluntaria(voluntaria);
  }, []);

  const http = useMemo(() => crearHttp({
    obtenerToken: () => token,
    alNoAutorizado: err => cerrarSesion(err.codigo === 'TOKEN_EXPIRADO' ? 'Su sesión expiró. Inicie sesión de nuevo.' : 'La sesión no es válida. Inicie sesión de nuevo.')
  }), [token, cerrarSesion]);
  const plataforma = useMemo(() => crearApiPlataforma(http), [http]);

  useEffect(() => {
    if (!token) { setVerificando(false); return; }
    let vivo = true;
    setVerificando(true);
    plataforma.sesion()
      .then(s => { if (vivo) { guardar(token); setSesion(s); setAviso(null); } })
      .catch(e => { if (vivo) cerrarSesion(e.status === 403 ? (MENSAJES_403[e.codigo] || e.message) : e.message); })
      .finally(() => vivo && setVerificando(false));
    return () => { vivo = false; };
  }, [token, plataforma, cerrarSesion]);

  // Cierra la sesión local cuando el token vence aunque no haya peticiones.
  useEffect(() => {
    if (!sesion?.expira) return undefined;
    const ms = new Date(sesion.expira).getTime() - Date.now();
    const t = setTimeout(() => cerrarSesion('Su sesión expiró. Inicie sesión de nuevo.'), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(t);
  }, [sesion, cerrarSesion]);

  const resolucion = useMemo(() => resolverSesion(registro, sesion), [registro, sesion]);
  const modulo = resolucion.modulo || null;
  const api = useMemo(() => (modulo ? modulo.crearApi(http) : null), [modulo, http]);

  const valor = useMemo(() => ({
    api, sesion, modulo, resolucion, verificando, aviso, salidaVoluntaria,
    rol: sesion?.rol,
    rolEtiqueta: sesion ? (modulo?.roles?.[sesion.rol] || sesion.rol) : '',
    // Solo decide qué se MUESTRA; el backend vuelve a autorizar cada operación.
    puede: permiso => tienePermiso(sesion, permiso),
    es: (...roles) => roles.includes(sesion?.rol),
    iniciarConToken: t => { setAviso(null); setSalidaVoluntaria(false); setToken(t.trim()); },
    async iniciarDesarrollo(rol, usuario) {
      const r = await crearApiPlataforma(crearHttp()).devLogin(rol, usuario);
      setAviso(null); setSalidaVoluntaria(false); setToken(r.token);
    },
    configuracion: () => crearApiPlataforma(crearHttp()).config(),
    cerrarSesion
  }), [api, sesion, modulo, resolucion, verificando, aviso, salidaVoluntaria, cerrarSesion]);

  return <SesionCtx.Provider value={valor}>{children}</SesionCtx.Provider>;
}

export const useSesion = () => useContext(SesionCtx);
