import { useLocation } from 'react-router-dom';
import { AdministracionInstitucionalVistaPrevia, Card, ContextPanel, MetricStrip, PageHeader, PendienteIntegracion, TablaPendiente } from '@plataforma/ui/index.js';

const SECCIONES = {
  hospitalizacion: { titulo: 'Hospitalización', descripcion: 'Ingresos, estancias y egresos hospitalarios.', columnas: ['Paciente', 'Ingreso', 'Servicio', 'Cama', 'Estado', 'Egreso'] },
  catalogos: { titulo: 'Catálogos', descripcion: 'Datos de referencia para el registro y la atención del paciente.', columnas: ['Catálogo', 'Código', 'Nombre', 'Estado'] },
  bitacora: { titulo: 'Bitácora de acceso', descripcion: 'Trazabilidad de accesos y operaciones sobre los historiales.', columnas: ['Fecha y hora', 'Usuario', 'Acción', 'Paciente', 'Resultado'] }
};

export default function SeccionHospital() {
  const { pathname } = useLocation();
  const tipo = pathname.split('/').filter(Boolean).at(-1);
  if (tipo === 'catalogos' || tipo === 'bitacora') return <AdministracionInstitucionalVistaPrevia tipo={tipo}
    catalogos={['Profesionales', 'Diagnósticos', 'Medicamentos', 'Exámenes', 'Aseguradoras']} />;
  const s = SECCIONES[tipo];
  return <>
    <PageHeader titulo={s.titulo} descripcion={s.descripcion} />
    <PendienteIntegracion compacto />
    <MetricStrip items={[
      { etiqueta: 'Ingresos activos', icono: 'hospital' }, { etiqueta: 'Egresos registrados', icono: 'archivo' }, { etiqueta: 'Servicios', icono: 'medico' }
    ]} />
    <div className="workspace-grid"><div className="workspace-main">
      <Card titulo="Estancias hospitalarias" icono="hospital"><TablaPendiente titulo={s.titulo} columnas={s.columnas.map(t => ({ clave: t, titulo: t }))} /></Card>
    </div><aside className="workspace-aside" aria-label="Contexto de hospitalización">
      <ContextPanel titulo="Estancia seleccionada" icono="hospital" items={[
        ['Paciente', '—'], ['Servicio', '—'], ['Cama', '—'], ['Fecha de ingreso', '—']
      ]} />
    </aside></div>
  </>;
}
