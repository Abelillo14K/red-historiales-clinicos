import { Icon } from './Icon.jsx';
import { EmptyState } from './Estados.jsx';

// Estados conocidos de toda la plataforma → tono visual. Los módulos pueden pasar `tono`.
const TONO = {
  Activo: 'ok', Archivado: 'warn', Pendiente: 'info', Aplicada: 'ok', Cancelada: 'bad',
  EXITOSO: 'ok', DENEGADO: 'bad', Vencida: 'warn'
};
export function StatusBadge({ children, tono, sinPunto }) {
  return <span className={`badge ${tono || TONO[children] || ''}${sinPunto ? ' plain' : ''}`}>{children}</span>;
}

// Tabla de datos accesible. En pantallas pequeñas cada fila se presenta como
// ficha (CSS) usando el título de la columna como etiqueta (data-label).
//   columnas: [{ clave, titulo, render?(fila), num?, ancho?, principal? }]
export function DataTable({ columnas, filas, claveFila, titulo, vacio = 'Sin registros', resaltar, compacta }) {
  if (!filas?.length) return <EmptyState titulo={vacio} />;
  return (
    <div className={`table-wrap${compacta ? ' compact' : ''}`}>
      <table className="data-table">
        {titulo && <caption className="sr-only">{titulo}</caption>}
        <thead>
          <tr>{columnas.map(c => <th key={c.clave} scope="col" className={c.num ? 'num' : undefined} style={c.ancho ? { width: c.ancho } : undefined}>{c.titulo}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={claveFila ? claveFila(f) : i} className={resaltar?.(f) ? 'highlight' : undefined}>
              {columnas.map(c => (
                <td key={c.clave} data-label={c.titulo || undefined} className={[c.num && 'num', c.principal && 'primary-cell'].filter(Boolean).join(' ') || undefined}>
                  {c.render ? c.render(f) : (f[c.clave] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tarjeta estadística con icono, contexto (qué incluye el número) y enlace opcional.
// `texto`: el valor no es un conteo (p. ej., «11,2 kg · 84 cm») y se muestra más pequeño.
export function StatCard({ etiqueta, valor, icono, contexto, tono, to, LinkComponent, texto }) {
  const contenido = (
    <>
      <div className="stat-top">
        <span className="label">{etiqueta}</span>
        <span className={`stat-icon ${tono || ''}`} aria-hidden="true"><Icon name={icono || 'info'} /></span>
      </div>
      <div className={`value${texto ? ' text' : ''}`}>{valor ?? 0}</div>
      {contexto && <div className="stat-context">{contexto}</div>}
    </>
  );
  return to && LinkComponent
    ? <LinkComponent to={to} className="stat stat-link" aria-label={`${etiqueta}: ${valor ?? 0}`}>{contenido}</LinkComponent>
    : <div className="stat">{contenido}</div>;
}

// Pares clave–valor (definition list).
export function KeyValue({ items }) {
  return (
    <dl className="kv">
      {items.filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>)}
    </dl>
  );
}

// Paginación con rango visible («Mostrando 21–40 de 57») y botones Anterior/Siguiente.
export function Pager({ pagina, limite, total, onCambiar, etiqueta = 'Paginación' }) {
  const paginas = Math.max(1, Math.ceil(total / limite));
  const desde = total ? (pagina - 1) * limite + 1 : 0;
  const hasta = Math.min(total, pagina * limite);
  return (
    <nav className="pager" aria-label={etiqueta}>
      <span>Mostrando <b>{desde}–{hasta}</b> de <b>{total}</b> · página {pagina} de {paginas}</span>
      <div className="actions">
        <button type="button" className="btn btn-sm" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>Anterior</button>
        <button type="button" className="btn btn-sm" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</button>
      </div>
    </nav>
  );
}

// Tabla sin datos que conserva sus encabezados: muestra la estructura prevista de una
// vista cuyo backend todavía no existe. En móvil (sin encabezados visibles) se listan
// las columnas previstas dentro del mensaje.
//   columnas: [{ clave, titulo, num? }]
export function TablaPendiente({ columnas, titulo, mensaje = 'Sin datos: la vista se llenará cuando se conecte el backend de la institución.' }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        {titulo && <caption className="sr-only">{titulo} (sin datos)</caption>}
        <thead>
          <tr>{columnas.map(c => <th key={c.clave} scope="col" className={c.num ? 'num' : undefined}>{c.titulo}</th>)}</tr>
        </thead>
        <tbody>
          <tr className="empty-row">
            <td colSpan={columnas.length}>
              <EmptyState icono="enchufe" titulo="Sin datos que mostrar">{mensaje}</EmptyState>
              <ul className="columnas-previstas" aria-label="Columnas previstas">
                {columnas.map(c => <li key={c.clave}>{c.titulo}</li>)}
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
