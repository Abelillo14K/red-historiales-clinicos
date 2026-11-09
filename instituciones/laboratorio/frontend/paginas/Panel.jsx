import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, ErrorState, Icon, LoadingState, PageHeader, StatCard, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import { TONO_ESTADO } from '../componentes/formato.js';

const ACCESOS = [
  { to: '/pacientes/nuevo', icono: 'mas', titulo: 'Registrar paciente', texto: 'Datos generales del paciente', permiso: 'pacientes.registrar' },
  { to: '/pacientes', icono: 'buscar', titulo: 'Buscar paciente', texto: 'Por nombre, apellido o documento', permiso: 'pacientes.listar' },
  { to: '/solicitudes/nueva', icono: 'matraz', titulo: 'Nueva solicitud', texto: 'Exámenes para un paciente', permiso: 'laboratorio.solicitudes.crear' },
  { to: '/solicitudes?estado=Pendiente', icono: 'reloj', titulo: 'Solicitudes pendientes', texto: 'Exámenes por procesar', permiso: 'laboratorio.resultados.registrar' },
  { to: '/resultados?estado=Preliminar', icono: 'resultado', titulo: 'Por validar', texto: 'Resultados preliminares', permiso: 'laboratorio.resultados.validar' },
  { to: '/archivados', icono: 'archivo', titulo: 'Historiales archivados', texto: 'Consulta de solo lectura', permiso: 'historial.leer_archivados' }
];

export default function Panel() {
  const { api, modulo, puede, enlace } = useModulo();
  const resumen = useCarga(() => api.panel(), [api]);
  const verSolicitudes = puede('laboratorio.solicitudes.ver');
  const recientes = useCarga(() => (verSolicitudes ? api.solicitudes.listar({ limite: 5 }) : Promise.resolve(null)), [api, verSolicitudes]);
  const r = resumen.datos;
  const tarjeta = (etiqueta, valor, icono, tono, contexto, to) =>
    <StatCard etiqueta={etiqueta} valor={valor ?? '—'} icono={icono} tono={tono} contexto={contexto} to={to && enlace(to)} LinkComponent={Link} />;

  return (
    <>
      <PageHeader titulo="Panel principal" descripcion={`Resumen de la actividad de ${modulo.nombre}.`} />
      <ErrorState error={resumen.error} onReintentar={resumen.recargar} />
      <section className="stats" aria-label="Resumen">
        {tarjeta('Pacientes activos', r?.pacientes_activos, 'pacientes', undefined, 'Expedientes disponibles para atención', '/pacientes')}
        {tarjeta('Solicitudes pendientes', r?.solicitudes.pendientes, 'matraz', 'warn', 'Sin exámenes iniciados', verSolicitudes && '/solicitudes?estado=Pendiente')}
        {tarjeta('En proceso', r?.solicitudes.en_proceso, 'reloj', 'info', 'Con resultados por completar o validar', verSolicitudes && '/solicitudes?estado=En proceso')}
        {tarjeta('Historiales archivados', r?.pacientes_archivados, 'archivo', 'warn', 'Conservados en solo lectura', puede('historial.leer_archivados') && '/archivados')}
      </section>
      <div className="grid grid-main">
        {verSolicitudes && <Card titulo="Solicitudes recientes" icono="matraz" acciones={<Link className="btn btn-sm" to={enlace('/solicitudes')}>Ver todas</Link>}>
          <ErrorState error={recientes.error} onReintentar={recientes.recargar} />
          {recientes.cargando ? <LoadingState compacto /> : recientes.datos && (
            <DataTable titulo="Solicitudes recientes" compacta vacio="Todavía no hay solicitudes" filas={recientes.datos.items} claveFila={s => s.id_solicitud} columnas={[
              { clave: 'fecha', titulo: 'Fecha', principal: true, render: s => <Link className="row-link" to={enlace(`/solicitudes/${s.id_solicitud}`)}>{fechaHora(s.fecha_solicitud)}</Link> },
              { clave: 'paciente', titulo: 'Paciente', render: s => s.paciente },
              { clave: 'prioridad', titulo: 'Prioridad', render: s => <StatusBadge tono={TONO_ESTADO[s.prioridad]} sinPunto>{s.prioridad}</StatusBadge> },
              { clave: 'estado', titulo: 'Estado', render: s => <StatusBadge tono={TONO_ESTADO[s.estado]}>{s.estado}</StatusBadge> }
            ]} />)}
        </Card>}
        <Card titulo="Accesos rápidos" icono="derecha">
          <div className="quick-actions">
            {ACCESOS.filter(a => puede(a.permiso)).map(a => (
              <Link key={a.to} className="quick-action" to={enlace(a.to)}>
                <span className="stat-icon" aria-hidden="true"><Icon name={a.icono} /></span>
                <span><b>{a.titulo}</b><small>{a.texto}</small></span>
                <Icon name="chevron" size={16} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
