import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, Icon, PageHeader, PendienteIntegracion, StatCard, TablaPendiente } from '@plataforma/ui/index.js';

// Indicadores previstos. Sin backend se muestra «—» (nunca un número inventado).
const INDICADORES = [
  { etiqueta: 'Pacientes activos', icono: 'pacientes' },
  { etiqueta: 'Solicitudes pendientes', icono: 'matraz', tono: 'warn' },
  { etiqueta: 'Resultados emitidos', icono: 'resultado', tono: 'ok' },
  { etiqueta: 'Historiales archivados', icono: 'archivo', tono: 'warn' }
];

const ACCESOS = [
  { to: '/pacientes/nuevo', icono: 'mas', titulo: 'Registrar paciente', texto: 'Datos generales del paciente', permiso: 'pacientes.registrar' },
  { to: '/pacientes', icono: 'buscar', titulo: 'Buscar paciente', texto: 'Por nombre, apellido o código', permiso: 'pacientes.listar' },
  { to: '/solicitudes', icono: 'matraz', titulo: 'Solicitudes de exámenes', texto: 'Órdenes recibidas', permiso: 'laboratorio.solicitudes.ver' },
  { to: '/resultados', icono: 'resultado', titulo: 'Resultados', texto: 'Resultados por tipo de examen', permiso: 'laboratorio.resultados.ver' },
  { to: '/archivados', icono: 'archivo', titulo: 'Historiales archivados', texto: 'Consulta de solo lectura', permiso: 'historial.leer_archivados' }
];

export default function Panel() {
  const { modulo, puede, enlace } = useModulo();
  return (
    <>
      <PageHeader titulo="Panel principal" descripcion={`Resumen de la actividad de ${modulo.nombre}.`} />
      <PendienteIntegracion />
      <section className="stats" aria-label="Resumen">
        {INDICADORES.map(i => <StatCard key={i.etiqueta} {...i} valor="—" texto contexto="Sin datos hasta conectar el backend" />)}
      </section>
      <div className="grid grid-main">
        <Card titulo="Solicitudes recientes" descripcion="Últimas solicitudes de exámenes recibidas.">
          <TablaPendiente titulo="Solicitudes recientes" columnas={[
            { clave: 'fecha', titulo: 'Fecha de solicitud' }, { clave: 'paciente', titulo: 'Paciente' },
            { clave: 'examen', titulo: 'Examen' }, { clave: 'estado', titulo: 'Estado' }
          ]} />
        </Card>
        <Card titulo="Accesos rápidos">
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
