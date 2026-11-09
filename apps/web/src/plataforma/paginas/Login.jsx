import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, FormField, Icon, LoadingState, useEnvio } from '../ui/index.js';
import { Logo } from '../layout/Sidebar.jsx';
import { NOMBRE_PLATAFORMA } from '../modulos/registro.js';
import { destinoTrasLogin } from '../portal/portal.js';

const INSTITUCIONES = [
  ['Hospital General', 'hospital', 'Consultas y hospitalización'],
  ['Laboratorio Clínico', 'matraz', 'Exámenes y resultados'],
  ['Clínica Odontológica', 'diente', 'Atención odontológica'],
  ['Centro Pediátrico', 'pediatria', 'Crecimiento y vacunación']
];

export default function Login() {
  const { sesion, verificando, aviso, iniciarSesion } = useSesion();
  const loc = useLocation();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const envio = useEnvio();

  // Tras validar la sesión: el portal de instituciones, salvo un enlace profundo pendiente.
  if (sesion) return <Navigate to={destinoTrasLogin(loc.state?.desde)} replace />;

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-intro" aria-label="Presentación">
          <div className="brand"><Logo /><span><b>{NOMBRE_PLATAFORMA}</b><small>Plataforma compartida de historiales clínicos</small></span></div>
          <span className="login-eyebrow">Arquitectura hexagonal · enrutamiento por usuario</span>
          <h1>Un historial clínico.<span>Cuatro bases de datos.</span></h1>
          <p>Una plataforma para las cuatro instituciones. Tu sesión dirige las operaciones a los datos de tu institución, con los permisos asignados a tu rol.</p>
          <a className="btn login-access-link" href="#formulario-acceso">Ir al formulario de acceso<Icon name="derecha" size={16} /></a>
          <div className="login-institutions" aria-label="Instituciones de la red">
            {INSTITUCIONES.map(([nombre, icono, descripcion]) => <div className="login-institution" key={nombre}>
              <span className="stat-icon"><Icon name={icono} size={21} /></span>
              <div><b>{nombre}</b><small>{descripcion}</small></div>
            </div>)}
          </div>
          <footer className="login-credit">Universidad Rafael Landívar · Bases de Datos II · Proyecto final</footer>
        </section>

        <div className="login-card-wrap">
        <div className="card login-card" id="formulario-acceso" tabIndex={-1}>
          <h2>Iniciar sesión</h2>
          <p className="login-greeting">Bienvenida de nuevo. Accede a los historiales de tu institución.</p>
          {aviso && <Alerta tipo="warn">{aviso}</Alerta>}
          {envio.error && <Alerta>{envio.error.message}</Alerta>}
          {verificando && <LoadingState texto="Verificando sesión…" compacto />}

          <form className="stack" onSubmit={e => { e.preventDefault(); envio.enviar(() => iniciarSesion(usuario.trim(), contrasena)); }}>
            <FormField label="Usuario" required>
              {p => <input {...p} value={usuario} onChange={e => setUsuario(e.target.value)} maxLength={80} autoComplete="username" required />}
            </FormField>
            <FormField label="Contraseña" required>
              {p => <input {...p} type="password" value={contrasena} onChange={e => setContrasena(e.target.value)} maxLength={200} autoComplete="current-password" required />}
            </FormField>
            <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Iniciar sesión</BotonEnviar>
          </form>

          {/* Solo en `vite` (desarrollo): la compilación de producción elimina este enlace y la vista previa. */}
          {import.meta.env.DEV && (
            <p className="meta login-preview">
              <Icon name="ojo" size={15} /><Link to="/vista-previa">Estado de integración de los módulos</Link><span>· solo desarrollo, sin sesión</span>
            </p>
          )}
          <p className="login-audit"><Icon name="auditoria" size={18} /><span>Acceso por rol y trazabilidad de las operaciones sobre los historiales clínicos.</span></p>
        </div>
        </div>
      </div>
    </div>
  );
}
