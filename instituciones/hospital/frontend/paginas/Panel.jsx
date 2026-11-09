import { Link } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, ErrorState, Icon, LoadingState, PageHeader, SectionIntro, StatCard, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';

const ACCESOS = [
  { to: '/pacientes/nuevo', icono: 'mas', titulo: 'Registrar paciente', texto: 'Datos generales y contacto', permiso: 'pacientes.registrar' },
  { to: '/pacientes', icono: 'buscar', titulo: 'Buscar paciente', texto: 'Por nombre, expediente o DPI', permiso: 'pacientes.listar' },
  { to: '/citas', icono: 'calendario', titulo: 'Agenda de citas', texto: 'Programación y seguimiento', permiso: 'hospital.citas.ver' },
  { to: '/hospitalizacion', icono: 'hospital', titulo: 'Hospitalización', texto: 'Ingresos, camas y egresos', permiso: 'hospital.hospitalizacion.ver' },
  { to: '/archivados', icono: 'archivo', titulo: 'Historiales archivados', texto: 'Consulta de solo lectura', permiso: 'historial.leer_archivados' }
];

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

export default function Panel() {
  const { api, sesion, rolEtiqueta, puede } = useSesion();
  const { modulo, enlace } = useModulo();
  const { datos, cargando, error, recargar } = useCarga(() => api.panel.resumen(), [api]);
  const clinico = puede('historial.leer');
  const accesos = ACCESOS.filter(a => puede(a.permiso));

  return (
    <>
      <PageHeader titulo="Panel principal" descripcion={`${saludo()}, ${sesion.usuario}. Sesión como ${rolEtiqueta.toLowerCase()} en ${sesion.institucion_nombre}.`} />
      <SectionIntro titulo={modulo.nombre} icono="hospital" descripcion="Atenciones, agenda y seguimiento de los expedientes hospitalarios." />
      <ErrorState error={error} onReintentar={recargar} />
      {cargando ? <LoadingState /> : datos && (
        <>
          <section className={`stats${clinico ? ' stats-6' : ''}`} aria-label="Resumen">
            <StatCard etiqueta="Pacientes activos" valor={datos.pacientes_activos} icono="pacientes" contexto="Historiales que admiten nuevas atenciones" to={enlace('/pacientes')} LinkComponent={Link} />
            <StatCard etiqueta="Citas para hoy" valor={datos.citas_hoy} icono="calendario" tono="info" contexto="Programadas y confirmadas" to={enlace('/citas')} LinkComponent={Link} />
            <StatCard etiqueta="Hospitalizados" valor={datos.hospitalizados} icono="hospital" tono="ok" contexto="Ingresos activos sin egreso" to={enlace('/hospitalizacion')} LinkComponent={Link} />
            <StatCard etiqueta="Historiales archivados" valor={datos.historiales_archivados} icono="archivo" tono="warn" contexto="Expedientes en solo lectura"
              to={puede('historial.leer_archivados') ? enlace('/archivados') : undefined} LinkComponent={Link} />
            {clinico && <>
              <StatCard etiqueta="Consultas registradas" valor={datos.consultas_registradas} icono="consulta" tono="info" contexto="Total de atenciones del hospital" />
              <StatCard etiqueta="Consultas recientes" valor={datos.consultas_recientes?.length || 0} icono="reloj" contexto="Últimas cinco atenciones" />
            </>}
          </section>

          <div className="grid grid-main">
            {clinico ? (
              <Card titulo="Consultas recientes" icono="consulta" descripcion="Las cinco atenciones más recientes del hospital.">
                <DataTable titulo="Consultas recientes" vacio="Sin consultas registradas" claveFila={c => c.id_consulta}
                  filas={datos.consultas_recientes} columnas={[
                    { clave: 'paciente', titulo: 'Paciente', principal: true, render: c => (
                      <>
                        <Link className="row-link" to={enlace(`/pacientes/${c.id_paciente}`)}>{c.paciente}</Link>
                        <div className="cell-sub"><code>Consulta {c.id_consulta}</code></div>
                      </>
                    ) },
                    { clave: 'tipo_consulta', titulo: 'Tipo', render: c => <StatusBadge tono="info" sinPunto>{c.tipo_consulta}</StatusBadge> },
                    { clave: 'fecha', titulo: 'Fecha y hora', render: c => fechaHora(c.fecha) }
                  ]} />
              </Card>
            ) : (
              <Card titulo="Gestión administrativa" icono="pacientes" descripcion="Lo que su rol puede hacer en este hospital.">
                <ul className="lista">
                  <li>Registrar pacientes con sus contactos de emergencia.</li>
                  <li>Actualizar datos administrativos y de contacto.</li>
                  <li>Programar, confirmar y cancelar citas.</li>
                  <li>Consultar historiales archivados si su rol lo permite.</li>
                </ul>
                <p className="criteria">La información clínica está restringida al personal médico y a la administración. El servidor la protege aunque se intente acceder directamente.</p>
              </Card>
            )}
            <Card titulo="Accesos rápidos" icono="derecha">
              <div className="quick-actions">
                {accesos.map(a => (
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
      )}
    </>
  );
}
