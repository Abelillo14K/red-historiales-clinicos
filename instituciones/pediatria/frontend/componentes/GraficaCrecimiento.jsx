import { useId, useRef, useState } from 'react';
import { fechaLocal as fecha } from '@plataforma/formato.js';
import { EmptyState } from '@plataforma/ui/index.js';

// Una serie por gráfica (peso, talla y perímetro tienen escalas distintas:
// se muestran como pequeños múltiplos, nunca con doble eje). Línea de 2px,
// marcadores de 8px, cuadrícula tenue, cursor con tooltip y navegación con teclado.
// Representa SOLO las mediciones registradas: no dibuja curvas de referencia ni percentiles.
const W = 360, H = 206, M = { l: 42, r: 50, t: 24, b: 28 };

function dominio(valores) {
  let min = Math.min(...valores), max = Math.max(...valores);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  return [Math.max(0, min - pad), max + pad];
}
const fmt = v => (Math.round(v * 10) / 10).toLocaleString('es-GT');

export default function GraficaCrecimiento({ datos, campo, titulo, unidad }) {
  const puntos = datos.filter(d => typeof d[campo] === 'number').map(d => ({ t: new Date(d.fecha).getTime(), v: d[campo], d }));
  const [activo, setActivo] = useState(null);
  const ref = useRef(null);
  const tituloId = useId();
  if (puntos.length === 0) {
    return (
      <figure className="chart card">
        <h3 id={tituloId}>{titulo}</h3>
        <p className="sub">Unidad: {unidad}</p>
        <div className="chart-empty"><EmptyState icono="crecimiento" titulo={`Sin mediciones de ${titulo.toLowerCase()}`}>Este dato es opcional en los controles registrados.</EmptyState></div>
      </figure>
    );
  }

  const t0 = puntos[0].t, t1 = puntos[puntos.length - 1].t;
  const [y0, y1] = dominio(puntos.map(p => p.v));
  // Escala temporal; si hay mediciones con la misma fecha y hora, posición ordinal
  // para no superponerlas (las etiquetas de fecha siguen siendo las reales).
  const ordinal = t1 === t0 || new Set(puntos.map(p => p.t)).size !== puntos.length;
  const ancho = W - M.l - M.r;
  const xi = i => (puntos.length === 1 ? M.l + ancho / 2 : M.l + (i / (puntos.length - 1)) * ancho);
  const xt = t => M.l + ((t - t0) / (t1 - t0)) * ancho;
  const xp = (p, i) => (ordinal ? xi(i) : xt(p.t));
  const y = v => M.t + (1 - (v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const ticks = Array.from({ length: 4 }, (_, i) => y0 + ((y1 - y0) * i) / 3);
  const camino = puntos.map((p, i) => `${i ? 'L' : 'M'}${xp(p, i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const ultimo = puntos[puntos.length - 1];
  const area = `${camino} L${xp(ultimo, puntos.length - 1).toFixed(1)},${H - M.b} L${xp(puntos[0], 0).toFixed(1)},${H - M.b} Z`;

  function cercano(clientX) {
    const r = ref.current.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    let mejor = 0;
    puntos.forEach((p, i) => { if (Math.abs(xp(p, i) - sx) < Math.abs(xp(puntos[mejor], mejor) - sx)) mejor = i; });
    setActivo(mejor);
  }
  function teclado(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActivo(a => Math.min(puntos.length - 1, (a ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActivo(a => Math.max(0, (a ?? puntos.length) - 1)); }
    if (e.key === 'Escape') setActivo(null);
  }
  const pa = activo !== null ? puntos[activo] : null;

  return (
    <figure className="chart card">
      <div className="chart-head">
        <h3 id={tituloId}>{titulo}</h3>
        <span className="chart-last" aria-label={`Última medición: ${fmt(ultimo.v)} ${unidad}`}>{fmt(ultimo.v)}<small>{unidad}</small></span>
      </div>
      <p className="sub">{puntos.length} {puntos.length === 1 ? 'medición' : 'mediciones'} · {fecha(t0)}{t1 !== t0 ? ` – ${fecha(t1)}` : ''}</p>
      <div ref={ref} className="chart-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={tituloId}
        aria-describedby={`${tituloId}-d`}>
        <desc id={`${tituloId}-d`}>{puntos.map(p => `${fecha(p.t)}: ${fmt(p.v)} ${unidad}`).join('; ')}</desc>
        {ticks.map(v => (
          <g key={v}>
            <line className="gridline" x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
            <text className="axis-text" x={M.l - 6} y={y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        <text className="axis-text" x={t1 === t0 ? M.l + ancho / 2 : xp(puntos[0], 0)} y={H - 8} textAnchor={t1 === t0 ? 'middle' : 'start'}>{fecha(t0)}</text>
        {t1 !== t0 && <text className="axis-text" x={xp(ultimo, puntos.length - 1)} y={H - 8} textAnchor="end">{fecha(t1)}</text>}
        <text className="axis-unit" x={M.l - 6} y={9} textAnchor="end">{unidad}</text>
        {puntos.length > 1 && <path className="area" d={area} />}
        {pa && <line className="cross" x1={xp(pa, activo)} x2={xp(pa, activo)} y1={M.t} y2={H - M.b} />}
        <path className="line" d={camino} />
        {puntos.map((p, i) => <circle key={i} className="dot" cx={xp(p, i)} cy={y(p.v)} r={i === activo ? 5.5 : 4} />)}
        <text className="last-label" x={xp(ultimo, puntos.length - 1) + 8} y={y(ultimo.v) + 4}>{fmt(ultimo.v)}</text>
        <rect x={M.l - 10} y={0} width={W - M.l - M.r + 20} height={H} fill="transparent" tabIndex={0}
          aria-label={`Explorar ${titulo} con las flechas izquierda y derecha`}
          onPointerMove={e => cercano(e.clientX)} onPointerDown={e => cercano(e.clientX)} onPointerLeave={() => setActivo(null)}
          onFocus={() => setActivo(a => a ?? puntos.length - 1)} onBlur={() => setActivo(null)} onKeyDown={teclado} />
      </svg>
      {pa && (
        <div className="tooltip" role="status" style={{
          left: (xp(pa, activo) / W) * ref.current.clientWidth,
          top: (y(pa.v) / H) * ref.current.clientHeight
        }}>
          <strong>{fmt(pa.v)} {unidad}</strong>
          <span>{fecha(pa.t)}{typeof pa.d.edad_meses === 'number' ? ` · ${pa.d.edad_meses} meses` : ''}</span>
        </div>
      )}
      </div>
      {puntos.length === 1 && <p className="chart-note">Una sola medición: se necesitan al menos dos para observar la evolución.</p>}
    </figure>
  );
}
