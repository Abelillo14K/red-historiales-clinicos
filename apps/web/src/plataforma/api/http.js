// Cliente HTTP común de la plataforma. No conoce ninguna institución: cada
// módulo construye sus endpoints sobre `http` (ver modulos/*/api.js).
// El navegador solo guarda el JWT de sesión; nunca credenciales de bases de datos.
// Módulo sin React para poder probarlo desde Node (tests/frontend-*.test.js).

export class ApiError extends Error {
  constructor(status, mensaje, { codigo, detalles } = {}) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles || [];
  }
}

export const qs = params => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${new URLSearchParams(p)}` : '';
};
export const seg = v => encodeURIComponent(v);

export function crearHttp({ base = '', obtenerToken = () => null, alNoAutorizado = () => {}, fetchImpl } = {}) {
  const hacerFetch = fetchImpl || ((...a) => globalThis.fetch(...a));

  async function solicitar(metodo, ruta, cuerpo) {
    const headers = { Accept: 'application/json' };
    const token = obtenerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await hacerFetch(base + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor. Verifique que la API esté en ejecución.', { codigo: 'SIN_CONEXION' });
    }
    const texto = await res.text();
    let datos = null;
    if (texto) {
      try { datos = JSON.parse(texto); } catch { datos = { error: texto.slice(0, 200) }; }
    }
    if (!res.ok) {
      const detalles = datos?.detalles || [];
      const mensaje = datos?.error || `Error HTTP ${res.status}`;
      const err = new ApiError(res.status, detalles.length
        ? `${mensaje}: ${detalles.map(d => `${d.campo} — ${d.mensaje}`).join('; ')}` : mensaje,
      { codigo: datos?.codigo, detalles });
      if (res.status === 401) alNoAutorizado(err);
      throw err;
    }
    return datos;
  }

  return {
    solicitar,
    get: (r, p) => solicitar('GET', r + qs(p)),
    post: (r, b) => solicitar('POST', r, b),
    put: (r, b) => solicitar('PUT', r, b),
    patch: (r, b) => solicitar('PATCH', r, b)
  };
}

// Endpoints comunes de la plataforma (contrato compartido, docs/GUIA_INTEGRACION_EQUIPO.md).
export function crearApiPlataforma(http) {
  return {
    config: () => http.get('/auth/config'),
    devLogin: (rol, usuario) => http.post('/auth/dev-login', { rol, usuario }),
    // Lo atiende el módulo de la institución del token: identidad, rol, institución y permisos.
    sesion: () => http.get('/api/sesion')
  };
}
