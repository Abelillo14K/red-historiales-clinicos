import { useEffect, useState } from 'react';

// Carga asíncrona con estado de carga/error y recarga manual.
export function useCarga(fn, deps) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado(e => ({ ...e, cargando: true, error: null }));
    fn().then(datos => vivo && setEstado({ datos, cargando: false, error: null }))
      .catch(error => vivo && setEstado({ datos: null, cargando: false, error }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...estado, recargar: () => setN(x => x + 1) };
}

// Envío de formularios: evita doble envío y centraliza el error.
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enviar = async fn => {
    if (enviando) return undefined;
    setEnviando(true); setError(null);
    try { return await fn(); } catch (e) { setError(e); return undefined; } finally { setEnviando(false); }
  };
  return { enviando, error, setError, enviar };
}
