import { createContext, useCallback, useContext, useState } from 'react';
import { Dialogo } from './Dialogo.jsx';
import { Icon } from './Icon.jsx';

// Notificaciones (toasts) y diálogo de confirmación para operaciones sensibles:
//   const confirmar = useConfirmar(); if (await confirmar({ titulo, mensaje, peligro, confirmar })) ...
//   const notificar = useNotificar(); notificar('Guardado'); notificar('Falló', 'error');
const ConfirmCtx = createContext(null);
const ToastCtx = createContext(null);
const MAXIMO = 4;

export function ConfirmDialog({ estado, onResponder }) {
  return (
    <Dialogo abierto={!!estado} titulo={estado?.titulo} onCerrar={() => onResponder(false)} acciones={<>
      <button type="button" className="btn" onClick={() => onResponder(false)}>Cancelar</button>
      <button type="button" className={`btn ${estado?.peligro ? 'btn-danger solid' : 'btn-primary'}`} onClick={() => onResponder(true)} autoFocus>
        {estado?.confirmar || 'Confirmar'}
      </button>
    </>}>
      <p>{estado?.mensaje}</p>
    </Dialogo>
  );
}

export function NotificationsProvider({ children }) {
  const [conf, setConf] = useState(null);
  const [toasts, setToasts] = useState([]);
  const confirmar = useCallback(opciones => new Promise(resolve => setConf({ ...opciones, resolve })), []);
  const responder = valor => { conf?.resolve(valor); setConf(null); };
  const quitar = id => setToasts(t => t.filter(x => x.id !== id));
  const notificar = useCallback((mensaje, tipo = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, mensaje, tipo }].slice(-MAXIMO));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tipo === 'error' ? 8000 : 4500);
  }, []);
  return (
    <ConfirmCtx.Provider value={confirmar}>
      <ToastCtx.Provider value={notificar}>
        {children}
        <ConfirmDialog estado={conf} onResponder={responder} />
        <div className="toasts" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.tipo}`} role={t.tipo === 'error' ? 'alert' : 'status'}>
              <Icon name={t.tipo === 'error' ? 'alerta' : 'ok'} />
              <p>{t.mensaje}</p>
              <button type="button" className="icon-btn" aria-label="Cerrar notificación" onClick={() => quitar(t.id)}><Icon name="cerrar" /></button>
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}

export const useConfirmar = () => useContext(ConfirmCtx);
export const useNotificar = () => useContext(ToastCtx);
