import { useEffect, useState } from 'react';

// Tema visual: 'claro' (predeterminado), 'oscuro' o 'sistema'.
// Es una preferencia local del navegador; no se envía al servidor.
//   data-tema    preferencia elegida (claro | oscuro | sistema)
//   data-esquema esquema efectivo que usa la hoja de estilos (claro | oscuro)
// index.html repite esta resolución en un script en línea antes del primer
// pintado para que la página no cambie de tema al cargar.
const CLAVE = 'plataforma.tema';
export const TEMA_PREDETERMINADO = 'claro';
export const TEMAS = [['claro', 'Claro', 'sol'], ['oscuro', 'Oscuro', 'luna'], ['sistema', 'Según el sistema', 'monitor']];

const consultaOscuro = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function leerTema() {
  try { const t = localStorage.getItem(CLAVE); return TEMAS.some(([k]) => k === t) ? t : TEMA_PREDETERMINADO; } catch { return TEMA_PREDETERMINADO; }
}
export const esquemaDe = tema => (tema === 'sistema' ? (consultaOscuro()?.matches ? 'oscuro' : 'claro') : tema);

export function aplicarTema(tema) {
  const raiz = document.documentElement;
  raiz.dataset.tema = tema;
  raiz.dataset.esquema = esquemaDe(tema);
  // Color de la barra del navegador en móviles: el fondo del esquema efectivo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', raiz.dataset.esquema === 'oscuro' ? '#10191C' : '#F8F6F1');
}

// Mantiene sincronizado el modo «Según el sistema» cuando cambia la preferencia del sistema operativo.
export function vigilarSistema() {
  const mq = consultaOscuro();
  if (!mq) return () => {};
  const alCambiar = () => { if (document.documentElement.dataset.tema === 'sistema') aplicarTema('sistema'); };
  mq.addEventListener?.('change', alCambiar);
  return () => mq.removeEventListener?.('change', alCambiar);
}

export function useTema() {
  const [tema, setTema] = useState(leerTema);
  useEffect(() => {
    aplicarTema(tema);
    try { localStorage.setItem(CLAVE, tema); } catch { /* almacenamiento no disponible */ }
  }, [tema]);
  return [tema, setTema];
}
