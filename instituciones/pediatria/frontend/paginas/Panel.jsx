import { Link } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, DataTable, EmptyState, ErrorState, Icon, LoadingState, PageHeader, StatCard, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fecha, fechaHora, hoy } from '@plataforma/formato.js';

const ACCESOS = [
  { to: '/pacientes/nuevo', icono: 'mas', titulo: 'Registrar paciente', texto: 'Nuevo historial con tutores', permiso: 'pacientes.registrar' },
  { to: '/pacientes', icono: 'buscar', titulo: 'Buscar paciente', texto: 'Por nombre, código o tutor', permiso: 'pacientes.listar' },
  { to: '/vacunacion', icono: 'vacuna', titulo: 'Dosis pendientes', texto: 'Vacunas programadas', permiso: 'historial.leer' },
  { to: '/archivados', icono: 'archivo', titulo: 'Historiales archivados', texto: 'Consulta de solo lectura', permiso: 'historial.leer_archivados' },
  { to: '/auditoria', icono: 'auditoria', titulo: 'Auditoría', texto: 'Accesos y cambios', permiso: 'auditoria.leer' }
];

const saludo = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };

export default function Panel() {
  const { api, sesion, rolEtiqueta, puede } = useSesion();
  const { datos, cargando, error, recargar } = useCarga(() => api.panel(), [api]);
  const clinico = puede('historial.leer');
  const accesos = ACCESOS.filter(a => puede(a.permiso));
  const hoyIso = hoy();
  const vencida = d => String(d.fecha_programada).slice(0, 10) < hoyIso;

  return (
    <>
      <PageHeader titulo="Panel principal" descripcion={`${saludo()}, ${sesion.usuario}. Sesión como ${rolEtiqueta.toLowerCase()} en ${sesion.institucion_nombre}.`} />
      <ErrorState error={error} onReintentar={recargar} />
      {cargando ? <LoadingState /> : datos && <>
        <section className={`stats${clinico ? ' stats-6' : ''}`} aria-label="Resumen">
          <StatCard etiqueta="Pacientes activos" valor={datos.pacientes_activos} icono="pacientes" contexto="Historiales que admiten nuevas atenciones" to="/pacientes" LinkComponent={Link} />
          <StatCard etiqueta="Historiales archivados" valor={datos.pacientes_archivados} icono="archivo" tono="warn" contexto="Baja administrativa, solo lectura"
            to={puede('historial.leer_archivados') ? '/archivados' : undefined} LinkComponent={Link} />
          {clinico && <>
            <StatCard etiqueta="Consultas registradas" valor={datos.consultas} icono="consulta" tono="info" contexto="Incluye historiales archivados" />
            <StatCard etiqueta="Controles de crecimiento" valor={datos.controles_crecimiento} icono="crecimiento" tono="ok" contexto="Incluye historiales archivados" />
            <StatCard etiqueta="Dosis pendientes" valor={datos.dosis_pendientes} icono="calendario" tono="warn" contexto="Solo historiales activos" to="/vacunacion" LinkComponent={Link} />
            <StatCard etiqueta="Dosis aplicadas" valor={datos.dosis_aplicadas} icono="vacuna" tono="ok" contexto="Incluye historiales archivados" />
          </>}
        </section>
        {clinico && (
          <p className="stats-note"><Icon name="info" size={15} />Los archivados conservan su historial completo, por eso cuentan en consultas, controles y dosis aplicadas; las dosis pendientes solo se cuentan en historiales activos, porque un archivado no admite nuevas aplicaciones.</p>
        )}

        <div className="grid grid-main">
          {clinico ? (
            <Card titulo="Consultas recientes" descripcion="Las seis atenciones más recientes de historiales activos.">
              <DataTable titulo="Consultas recientes" vacio="Sin consultas registradas" claveFila={c => `${c.id_paciente}-${c.id_consulta}`}
                filas={datos.consultas_recientes} columnas={[
                  { clave: 'p', titulo: 'Paciente', principal: true, render: c => <>
                    <Link className="row-link" to={`/pacientes/${c.id_paciente}/consultas`}>{c.nombres} {c.apellidos}</Link>
                    <div className="cell-sub"><code>{c.id_paciente}</code></div>
                  </> },
                  { clave: 'motivo', titulo: 'Motivo' },
                  { clave: 'f', titulo: 'Fecha y hora', render: c => fechaHora(c.fecha_hora) }
                ]} />
            </Card>
          ) : (
            <Card titulo="Gestión administrativa" descripcion="Lo que su rol puede hacer en este centro.">
              <ul className="lista">
                <li>Registrar pacientes nuevos con sus tutores responsables.</li>
                <li>Actualizar datos generales y de contacto de los tutores.</li>
                <li>Buscar pacientes por nombre, código, tutor o DPI exacto.</li>
              </ul>
              <p className="criteria">La información clínica (consultas, crecimiento y vacunación) está restringida al personal médico y a la administración. El servidor la protege aunque se intente acceder directamente.</p>
            </Card>
          )}
          <Card titulo="Accesos rápidos">
            <div className="quick-actions">
              {accesos.map(a => (
                <Link key={a.to} className="quick-action" to={a.to}>
                  <span className="stat-icon" aria-hidden="true"><Icon name={a.icono} /></span>
                  <span><b>{a.titulo}</b><small>{a.texto}</small></span>
                  <Icon name="chevron" size={16} />
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {clinico && (
          <Card titulo="Próximas dosis pendientes" descripcion="Historiales activos, ordenadas por fecha programada. «Vencida» solo indica que la fecha programada ya pasó."
            acciones={<Link to="/vacunacion" className="btn btn-sm">Ver todas</Link>}>
            {datos.proximas_dosis.length === 0 ? <EmptyState icono="vacuna" titulo="No hay dosis pendientes" /> : (
              <DataTable titulo="Próximas dosis" claveFila={d => `${d.id_paciente}-${d.id_esquema}`} filas={datos.proximas_dosis}
                resaltar={vencida} columnas={[
                  { clave: 'p', titulo: 'Paciente', principal: true, render: d => <Link className="row-link" to={`/pacientes/${d.id_paciente}/vacunacion`}>{d.nombres} {d.apellidos}</Link> },
                  { clave: 'v', titulo: 'Vacuna', render: d => <>{d.vacuna || d.id_vacuna}<div className="cell-sub">Dosis {d.numero_dosis}</div></> },
                  { clave: 'f', titulo: 'Programada', render: d => fecha(d.fecha_programada) },
                  { clave: 'e', titulo: 'Estado', render: d => <StatusBadge>{vencida(d) ? 'Vencida' : 'Pendiente'}</StatusBadge> }
                ]} />
            )}
          </Card>
        )}
      </>}
    </>
  );
}
