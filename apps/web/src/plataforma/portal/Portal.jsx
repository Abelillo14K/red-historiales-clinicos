import { Suspense, lazy, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext.jsx';
import { NOMBRE_PLATAFORMA, registro } from '../modulos/registro.js';
import { Logo } from '../layout/Sidebar.jsx';
import UserMenu from '../layout/UserMenu.jsx';
import { Alerta, Icon, StatusBadge } from '../ui/index.js';
import { ESTADOS, tarjetasPortal } from './portal.js';
import { presentaciones } from './presentaciones.js';

// Acción «Ver diseño» de los módulos pendientes: SOLO en desarrollo (vite). En producción
// import.meta.env.DEV es false y Vite elimina la rama, la vista previa y sus módulos.
const AccionVistaPrevia = import.meta.env.DEV ? lazy(() => import('../vista-previa/AccionVistaPrevia.jsx')) : null;

function Tarjeta({ t }) {
  const estado = ESTADOS[t.estado];
  const id = `portal-${t.carpeta}`;
  let accion;
  if (t.estado === 'disponible') {
    // Hoy la sesión ya pertenece a esta institución: entrar es solo navegar a su panel.
    accion = (
      <Link className="btn btn-primary portal-cta" to="/">
        Ingresar<span className="sr-only"> a {t.nombre}</span><Icon name="derecha" size={16} />
      </Link>
    );
  } else if (t.estado === 'sin_autorizacion') {
    accion = <p className="portal-card-note">Su sesión no incluye esta institución.</p>;
  } else if (AccionVistaPrevia) {
    accion = <Suspense fallback={null}><AccionVistaPrevia carpeta={t.carpeta} nombre={t.nombre} /></Suspense>;
  } else {
    accion = <p className="portal-card-note">Se habilitará cuando su servidor esté conectado.</p>;
  }
  return (
    <li>
      <article className={`portal-card is-${t.estado}`} aria-labelledby={`${id}-t`}>
        <span className="portal-icon" aria-hidden="true"><Icon name={t.icono} size={26} /></span>
        <div className="portal-card-title">
          <h2 id={`${id}-t`}>{t.nombre}</h2>
          <StatusBadge tono={estado.tono}>{estado.etiqueta}</StatusBadge>
        </div>
        <p className="portal-desc">{t.descripcion}</p>
        <div className="portal-card-foot">{accion}</div>
      </article>
    </li>
  );
}

// Portal posterior al inicio de sesión. Solo navegación: no cambia la sesión ni el token
// y no decide permisos (ver portal.js). Usa la sesión ya verificada con /api/sesion.
export default function Portal() {
  const { sesion, rolEtiqueta, resolucion } = useSesion();
  const tarjetas = useMemo(() => tarjetasPortal(presentaciones, registro, sesion), [sesion]);
  return (
    <div className="portal-page">
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <header className="portal-top">
        <div className="brand"><Logo /><span><b>{NOMBRE_PLATAFORMA}</b><small>Historiales clínicos</small></span></div>
        <div className="portal-top-end"><UserMenu /></div>
      </header>
      <main id="contenido" className="portal-main" tabIndex={-1}>
        <div className="portal-intro">
          <p className="portal-welcome">Hola, <b>{sesion.usuario}</b><span aria-hidden="true"> · </span><span>{rolEtiqueta}</span></p>
          <h1>Selecciona una institución</h1>
          <p className="portal-sub">Elige el centro médico al que deseas acceder.</p>
        </div>
        {resolucion.estado !== 'lista' && (
          <Alerta tipo="info" titulo="Su sesión no corresponde a ningún módulo conectado">
            {resolucion.estado === 'sesion_incompleta'
              ? 'El servidor no informó los permisos de la sesión.'
              : `La institución «${resolucion.institucion}» todavía no tiene un módulo en esta interfaz.`}
          </Alerta>
        )}
        <ul className="portal-grid" aria-label="Instituciones de la red">
          {tarjetas.map(t => <Tarjeta key={t.carpeta} t={t} />)}
        </ul>
        <p className="portal-foot"><Icon name="auditoria" size={15} />El servidor determina a qué institución pertenece su sesión. Esta pantalla solo le permite navegar entre ellas.</p>
      </main>
    </div>
  );
}
