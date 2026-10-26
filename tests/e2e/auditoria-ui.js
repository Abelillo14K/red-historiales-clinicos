'use strict';
// Auditorías de interfaz compartidas por las pruebas en navegador (flujo-ui y vista-previa).

// Auditoría básica de accesibilidad de la pantalla actual: controles de formulario
// y botones con nombre accesible, un único h1, idioma del documento e imágenes con texto.
async function auditarAccesibilidad(page, pantalla, problemas) {
  const p = await page.evaluate(() => {
    const visible = el => el.offsetParent !== null || el.getClientRects().length > 0;
    const nombre = el => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length && el.labels[0].textContent) || el.getAttribute('title') || '').trim();
    const errores = [];
    for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      if (visible(el) && !nombre(el)) errores.push(`control sin etiqueta: ${el.outerHTML.slice(0, 90)}`);
    }
    for (const b of document.querySelectorAll('button, a[href]')) {
      if (visible(b) && !(b.textContent.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))) errores.push(`botón/enlace sin nombre: ${b.outerHTML.slice(0, 90)}`);
    }
    const h1 = [...document.querySelectorAll('h1')].filter(visible).length;
    if (h1 !== 1) errores.push(`h1 visibles: ${h1}`);
    if (!document.documentElement.lang) errores.push('documento sin lang');
    for (const img of document.querySelectorAll('img')) if (!img.alt) errores.push('imagen sin alt');
    return errores;
  });
  for (const e of p) problemas.push(`${pantalla}: ${e}`);
}
// Contraste WCAG AA medido sobre los colores que calcula el navegador: texto normal 4.5:1;
// texto grande (≥ 24px, o ≥ 18.66px en negrita) 3:1. La transparencia se compone sobre los fondos ancestros.
async function auditarContraste(page, pantalla, problemas) {
  const p = await page.evaluate(() => {
    const parse = c => {
      let m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
      if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
      m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(c);
      if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
      return null;
    };
    const mezcla = (a, b) => [0, 1, 2].map(i => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
    const fondo = el => {
      const capas = [];
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c[3] > 0) { capas.push(c); if (c[3] >= 1) break; }
      }
      return capas.reverse().reduce((acc, c) => mezcla(c, acc), [255, 255, 255, 1]);
    };
    const lum = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const errores = [];
    const vistos = new Set();
    for (const el of document.querySelectorAll('h1, h2, h3, h4, p, span, b, small, label, a, button, th, td, dt, dd, li, code, legend, summary')) {
      if (!el.offsetParent || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || el.closest('[disabled], .sr-only, svg')) continue;
      const fg = parse(cs.color); if (!fg) continue;
      const bg = fondo(el);
      const color = mezcla(fg, bg);
      const [a, b] = [lum(color), lum(bg)].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      const px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      const clave = `${el.className}|${cs.color}|${bg.join()}`;
      if (ratio < (grande ? 3 : 4.5) && !vistos.has(clave)) {
        vistos.add(clave);
        errores.push(`${el.tagName.toLowerCase()}.${el.className || '-'} «${el.textContent.trim().slice(0, 30)}» ${ratio.toFixed(2)}:1`);
      }
    }
    return errores;
  });
  for (const e of p) problemas.push(`${pantalla}: ${e}`);
}
module.exports = { auditarAccesibilidad, auditarContraste };
