import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, ErrorState, Icon, LoadingState, PageHeader, StatCard, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import { TONO_CITA } from '../componentes/formato.js';

const ACCESOS = [
  { to: '/pacientes/nuevo', icono: 'mas', titulo: 'Registrar paciente', texto: 'Datos generales y antecedentes', permiso: 'pacientes.registrar' },
  { to: '/pacientes', icono: 'buscar', titulo: 'Buscar paciente', texto: 'Por nombre, apellido o documento', permiso: 'pacientes.listar' },
  { to: '/citas', icono: 'calendario', titulo: 'Citas', texto: 'Agenda odontológica', permiso: 'odontologia.citas.ver' },
  { to: '/catalogos', icono: 'consulta', titulo: 'Catálogos', texto: 'Odontólogos y procedimientos', permiso: 'catalogos.editar' },
  { to: '/archivados', icono: 'archivo', titulo: 'Historiales archivados', texto: 'Consulta de solo lectura', permiso: 'historial.leer_archivados' }
];

export default function Panel() {
  const { api, modulo, puede, enlace } = useModulo();
  const resumen = useCarga(() => api.panel(), [api]);
  const r = resumen.datos;
  const tarjeta = (etiqueta, valor, icono, tono, contexto, to) =>
    <StatCard etiqueta={etiqueta} valor={valor ?? '—'} icono={icono} tono={tono} contexto={contexto} to={to && enlace(to)} LinkComponent={Link} />;

  return (
    <>
      <PageHeader titulo="Panel principal" descripcion={`Resumen de la actividad de ${modulo.nombre}.`} />
      <ErrorState error={resumen.error} onReintentar={resumen.recargar} />
      <section className="stats" aria-label="Resumen">
        {tarjeta('Pacientes activos', r?.pacientes_activos, 'pacientes', undefined, 'Expedientes disponibles para atención', '/pacientes')}
        {tarjeta('Citas en 7 días', r?.citas_proximas, 'calendario', 'info', 'Programadas desde ahora', puede('odontologia.citas.ver') && '/citas')}
        {tarjeta('Consultas registradas', r?.consultas, 'diente', 'ok', 'Todas las consultas de la clínica')}
        {tarjeta('Historiales archivados', r?.pacientes_archivados, 'archivo', 'warn', 'Conservados en solo lectura', puede('historial.leer_archivados') && '/archivados')}
      </section>
      <div className="grid grid-main">
        <Card titulo="Próximas citas" icono="calendario" acciones={puede('odontologia.citas.ver') && <Link className="btn btn-sm" to={enlace('/citas')}>Ver agenda</Link>}>
          {resumen.cargando ? <LoadingState compacto /> : r && <DataTable titulo="Próximas citas" compacta vacio="No hay citas en los próximos 7 días" filas={r.proximas_citas} claveFila={c => c.id_cita} columnas={[
            { clave: 'fecha', titulo: 'Fecha y hora', principal: true, render: c => fechaHora(c.fecha_hora) },
            { clave: 'paciente', titulo: 'Paciente' }, { clave: 'motivo', titulo: 'Motivo' },
            { clave: 'estado', titulo: 'Estado', render: c => <StatusBadge tono={TONO_CITA[c.estado]}>{c.estado}</StatusBadge> }
          ]} />}
        </Card>
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
