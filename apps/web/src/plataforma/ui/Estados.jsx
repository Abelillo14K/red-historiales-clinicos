import { Icon } from './Icon.jsx';

export const Spinner = ({ small }) => <span className={`spinner${small ? ' sm' : ''}`} aria-hidden="true" />;

export function LoadingState({ texto = 'Cargando…', compacto }) {
  return <div className={`state state-loading${compacto ? ' compact' : ''}`} role="status" aria-live="polite"><Spinner /> <span>{texto}</span></div>;
}

const ICONO_ALERTA = { error: 'alerta', warn: 'alerta', ok: 'ok', info: 'info' };
export function Alerta({ tipo = 'error', titulo, children, onCerrar }) {
  if (!children && !titulo) return null;
  return (
    <div className={`alert ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icon name={ICONO_ALERTA[tipo] || 'info'} />
      <div className="alert-body">{titulo && <b>{titulo}</b>}{children}</div>
      {onCerrar && <button type="button" className="icon-btn" onClick={onCerrar} aria-label="Cerrar aviso"><Icon name="cerrar" /></button>}
    </div>
  );
}

// Error al cargar datos: 403 se presenta como acceso restringido (la decisión es del backend).
export function ErrorState({ error, onReintentar }) {
  if (!error) return null;
  const restringido = error.status === 403;
  return (
    <Alerta tipo={restringido ? 'warn' : 'error'} titulo={restringido ? 'Acceso restringido' : error.status === 0 ? 'Sin conexión con el servidor' : 'No se pudo cargar la información'}>
      <p>{error.message}</p>
      {onReintentar && !restringido && error.status !== 404 &&
        <button type="button" className="btn btn-sm mt-2" onClick={onReintentar}>Reintentar</button>}
    </Alerta>
  );
}

export function EmptyState({ titulo, children, accion, icono = 'vacio' }) {
  return (
    <div className="state state-empty">
      <span className="state-icon" aria-hidden="true"><Icon name={icono} size={22} /></span>
      <b>{titulo}</b>
      {children && <p>{children}</p>}
      {accion && <div className="state-action">{accion}</div>}
    </div>
  );
}

// Módulo (o sección) preparado visualmente sin backend conectado. Nunca muestra datos
// ni afirma haber guardado nada; el texto principal es el mismo en toda la plataforma.
export const TEXTO_PENDIENTE = 'Este módulo está preparado visualmente. Pendiente de integración con su backend.';
export function PendienteIntegracion({ titulo = 'Pendiente de integración', children, compacto }) {
  return (
    <div className={`pending-note${compacto ? ' compact' : ''}`} role="note">
      <span className="pending-icon" aria-hidden="true"><Icon name="enchufe" size={18} /></span>
      <div>
        <b>{titulo}</b>
        <p>{children || TEXTO_PENDIENTE}</p>
      </div>
    </div>
  );
}
