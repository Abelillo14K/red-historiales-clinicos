import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, FormField, Icon, LoadingState, useEnvio } from '../ui/index.js';
import { Logo } from '../layout/Sidebar.jsx';
import { NOMBRE_PLATAFORMA, registro } from '../modulos/registro.js';
import { destinoTrasLogin } from '../portal/portal.js';

export default function Login() {
  const { sesion, verificando, aviso, iniciarDesarrollo, iniciarConToken, configuracion } = useSesion();
  const loc = useLocation();
  const [config, setConfig] = useState(null);
  const [rol, setRol] = useState('medico');
  const [usuario, setUsuario] = useState('USUARIO-DEMO');
  const [token, setToken] = useState('');
  const envio = useEnvio();

  useEffect(() => {
    configuracion().then(setConfig).catch(e => setConfig({ dev_login: false, error: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tras validar la sesión: el portal de instituciones, salvo un enlace profundo pendiente.
  if (sesion) return <Navigate to={destinoTrasLogin(loc.state?.desde)} replace />;
  // El acceso de desarrollo emite tokens para la institución que atiende este backend (/auth/config).
  const MODULO_DESARROLLO = config?.institucion ? registro.modulo(config.institucion) : null;

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-intro" aria-label="Presentación">
          <div className="brand"><Logo /><span><b>{NOMBRE_PLATAFORMA}</b><small>Plataforma compartida de historiales clínicos</small></span></div>
          <h1>Acceso del personal autorizado</h1>
          <p>Cada usuario trabaja con los historiales de su propia institución. La institución y los permisos los determina el servidor al validar la sesión.</p>
          <ul className="login-points">
            <li><Icon name="auditoria" /> Accesos y cambios registrados en bitácora</li>
            <li><Icon name="llave" /> Permisos por rol verificados en el servidor</li>
            <li><Icon name="institucion" /> Datos de cada institución en su propio motor</li>
          </ul>
        </section>

        <div className="card login-card">
          <h2>Iniciar sesión</h2>
          {aviso && aviso !== config?.error && <Alerta tipo="warn">{aviso}</Alerta>}
          {config?.error && <Alerta titulo="No se puede contactar la API">{config.error}</Alerta>}
          {envio.error && <Alerta>{envio.error.message}</Alerta>}
          {(verificando || (!config && !verificando)) && <LoadingState texto={verificando ? 'Verificando sesión…' : 'Cargando…'} compacto />}

          <section className="login-section" aria-labelledby="acceso-institucional">
            <h3 id="acceso-institucional"><Icon name="institucion" /> Acceso institucional</h3>
            <p className="meta">El inicio de sesión común de la plataforma todavía no está implementado. Cuando exista, redirigirá aquí automáticamente con el token de su institución. Mientras tanto puede pegar un token emitido por ese servicio.</p>
            <details>
              <summary>Usar un token institucional</summary>
              <form className="stack" onSubmit={e => { e.preventDefault(); if (token.trim()) iniciarConToken(token); }}>
                <FormField label="JWT institucional" hint="Debe estar firmado por el servidor y declarar su institución">
                  {p => <textarea {...p} value={token} onChange={e => setToken(e.target.value)} rows={3} spellCheck={false} />}
                </FormField>
                <button type="submit" className="btn btn-block" disabled={!token.trim()}>Validar token</button>
              </form>
            </details>
          </section>

          {config?.dev_login && MODULO_DESARROLLO && (
            <section className="login-section dev" aria-labelledby="acceso-desarrollo">
              <h3 id="acceso-desarrollo"><Icon name="codigo" /> Modo de desarrollo <span className="badge warn plain">Solo pruebas</span></h3>
              <p className="meta">Emite un token de prueba para {MODULO_DESARROLLO?.nombre}, sin contraseña. No es un mecanismo de autenticación real y se desactiva con NODE_ENV=production.</p>
              <form className="stack" onSubmit={e => { e.preventDefault(); envio.enviar(() => iniciarDesarrollo(rol, usuario.trim() || 'USUARIO-DEMO')); }}>
                <fieldset className="role-fieldset">
                  <legend>Rol</legend>
                  <div className="role-picker">
                    {Object.entries(MODULO_DESARROLLO?.roles || {}).map(([v, t]) => (
                      <label key={v}><input type="radio" name="rol" value={v} checked={rol === v} onChange={() => setRol(v)} />{t}</label>
                    ))}
                  </div>
                </fieldset>
                <FormField label="Identificador de usuario" hint="Letras, números, guion o guion bajo">
                  {p => <input {...p} value={usuario} onChange={e => setUsuario(e.target.value)} maxLength={40} pattern="[A-Za-z0-9_\-]{1,40}" autoComplete="username" />}
                </FormField>
                <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Entrar (modo desarrollo)</BotonEnviar>
              </form>
            </section>
          )}

          {/* Solo en `vite` (desarrollo): la compilación de producción elimina este enlace y la vista previa. */}
          {import.meta.env.DEV && (
            <p className="meta login-preview">
              <Icon name="ojo" size={15} /><Link to="/vista-previa">Vista previa de los módulos pendientes</Link><span>· solo desarrollo, sin sesión</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
