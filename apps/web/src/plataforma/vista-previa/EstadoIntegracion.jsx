import { Link } from 'react-router-dom';
import { NOMBRE_PLATAFORMA } from '../modulos/registro.js';
import { Logo } from '../layout/Sidebar.jsx';
import { Alerta, Card, Icon, KeyValue, PageHeader, StatusBadge } from '../ui/index.js';
import { catalogo } from './catalogo.js';
import ControlesVistaPrevia from './ControlesVistaPrevia.jsx';

// Página sin menú lateral para la portada de la vista previa y sus avisos.
export function PaginaVistaPrevia({ children }) {
  return (
    <div className="preview-page">
      <header className="preview-top">
        <Link className="brand" to="/vista-previa">
          <Logo />
          <span><b>{NOMBRE_PLATAFORMA}</b><small>Vista previa de desarrollo</small></span>
        </Link>
        <ControlesVistaPrevia regreso={<Link className="btn btn-sm" to="/login">Inicio de sesión</Link>} />
      </header>
      <main id="contenido" className="preview-main">{children}</main>
    </div>
  );
}

function Paso({ hecho, children }) {
  return (
    <li className={hecho ? 'hecho' : 'falta'}>
      <Icon name={hecho ? 'ok' : 'reloj'} size={16} />
      <span>{children}<span className="sr-only">{hecho ? ' (hecho)' : ' (pendiente)'}</span></span>
    </li>
  );
}

function TarjetaInstitucion({ item }) {
  const { modulo, carpeta, error, conectado, operaciones } = item;
  const id = `inst-${carpeta}`;
  if (error) {
    return (
      <Card className="integration-card" id={id} titulo={`instituciones/${carpeta}`}>
        <StatusBadge tono="bad">Manifiesto inválido</StatusBadge>
        <Alerta titulo="El manifiesto no cumple el contrato">{error}</Alerta>
      </Card>
    );
  }
  const pantallas = modulo.rutas.length;
  return (
    <section className="card integration-card" aria-labelledby={`${id}-t`}>
      <div className="card-head">
        <div className="integration-title">
          <span className="inst-mark" aria-hidden="true">{modulo.sigla || modulo.nombre.slice(0, 2).toUpperCase()}</span>
          <h2 id={`${id}-t`}>{modulo.nombre}</h2>
        </div>
        <StatusBadge tono={conectado ? 'ok' : 'warn'}>{conectado ? 'Implementado' : 'Pendiente de integrar'}</StatusBadge>
      </div>
      {modulo.descripcion && <p className="meta">{modulo.descripcion}</p>}
      <KeyValue items={[
        ['Identificador', <code key="i">{modulo.institucion}</code>],
        ['Carpeta', <code key="c">instituciones/{carpeta}</code>],
        ['Pantallas', `${pantallas} ${pantallas === 1 ? 'ruta' : 'rutas'}`],
        ['Operaciones de API', operaciones ? `${operaciones} declaradas` : 'Ninguna todavía']
      ]} />
      <ul className="checklist" aria-label={`Integración de ${modulo.nombre}`}>
        <Paso hecho>Manifiesto válido (contrato v{modulo.contrato})</Paso>
        <Paso hecho={operaciones > 0}>Operaciones declaradas en <code>api.js</code></Paso>
        <Paso hecho={conectado}>Registrado en <code>registro.js</code> con backend que atiende <code>/api/sesion</code></Paso>
      </ul>
      <div className="actions">
        {conectado
          ? <Link className="btn" to="/login"><Icon name="llave" size={16} />Usar con sesión real</Link>
          : <Link className="btn btn-primary" to={`/vista-previa/${modulo.institucion}`}><Icon name="ojo" size={16} />Abrir vista previa</Link>}
      </div>
    </section>
  );
}

export default function EstadoIntegracion() {
  const pendientes = catalogo.filter(x => !x.conectado).length;
  return (
    <PaginaVistaPrevia>
      <PageHeader titulo="Estado de integración"
        descripcion={`Instituciones de ${NOMBRE_PLATAFORMA}: ${catalogo.length - pendientes} conectada(s) y ${pendientes} pendiente(s). Cada una conserva su propio backend y su propio motor de datos.`} />
      <Alerta tipo="warn" titulo="Solo para desarrollo">
        <p>Esta vista no existe en la compilación de producción. No usa ni modifica la sesión, no emite tokens, no llama a las API de las instituciones y no permite guardar datos. En la aplicación real la institución de cada sesión la decide siempre el backend.</p>
      </Alerta>
      <div className="integration-grid">
        {catalogo.map(item => <TarjetaInstitucion key={item.carpeta} item={item} />)}
      </div>
      <Card titulo="De pendiente a conectado" descripcion="Pasos detallados en docs/FRONTEND_EQUIPO.md §7." className="mt-4">
        <ol className="lista">
          <li>El backend de la institución atiende <code>GET /api/sesion</code> y sus rutas, con su propio motor.</li>
          <li>Declarar en <code>api.js</code> las operaciones reales sobre el cliente HTTP común.</li>
          <li>Reemplazar en cada página el estado pendiente por la carga real (<code>useCarga</code>) y los formularios por envíos reales (<code>useEnvio</code>).</li>
          <li>Definir <code>roles</code> y los permisos de cada ruta según la tabla de permisos de su backend.</li>
          <li>Agregar el módulo a <code>plataforma/modulos/registro.js</code> (una línea, coordinada con el equipo).</li>
        </ol>
      </Card>
    </PaginaVistaPrevia>
  );
}
