import { Link } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, ContextPanel, PageHeader, PendienteIntegracion } from '@plataforma/ui/index.js';
import VisorResultado from '../componentes/VisorResultado.jsx';

export default function DetalleResultado() {
  const { enlace } = useModulo();
  return <>
    <PageHeader titulo="Detalle del resultado" descripcion="Informe con identificación, parámetros y validación del laboratorio."
      acciones={<Link className="btn" to={enlace('/resultados')}>Volver a resultados</Link>} />
    <PendienteIntegracion compacto />
    <div className="workspace-grid"><div className="workspace-main"><Card titulo="Informe del examen" icono="resultado"><VisorResultado /></Card></div>
      <aside className="workspace-aside" aria-label="Contexto del informe">
        <ContextPanel titulo="Estado del informe" icono="resultado" items={[
          ['Resultado', 'Sin seleccionar'], ['Muestra', '—'], ['Validado por', '—']
        ]} />
        <ContextPanel titulo="Trazabilidad" icono="auditoria" descripcion="La solicitud, la muestra y el profesional responsable se vincularán con los datos del laboratorio." />
      </aside>
    </div>
  </>;
}
