import { useNavigate, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, Icon, KeyValue, PendienteIntegracion, TablaPendiente, Tabs } from '@plataforma/ui/index.js';
import EncabezadoExpediente from '../componentes/EncabezadoExpediente.jsx';
import VisorResultado from '../componentes/VisorResultado.jsx';

// Secciones del expediente del laboratorio. «Atenciones relacionadas» usa las columnas
// de la consulta común (docs/GUIA_INTEGRACION_EQUIPO.md §5.1); las demás son orientativas.
const PESTANAS = [
  { clave: 'resumen', titulo: 'Datos generales' },
  { clave: 'solicitudes', titulo: 'Solicitudes', accion: 'Nueva solicitud', descripcion: 'Exámenes solicitados para el paciente.',
    columnas: ['Fecha de solicitud', 'Examen', 'Solicitado por', 'Estado'] },
  { clave: 'resultados', titulo: 'Resultados', descripcion: 'Resultados emitidos; el detalle depende del tipo de examen.',
    columnas: ['Fecha', 'Examen', 'Estado'], visor: true },
  { clave: 'historial', titulo: 'Historial de resultados', descripcion: 'Resultados anteriores del paciente, agrupables por tipo de examen.',
    columnas: ['Examen', 'Fecha', 'Estado'] },
  { clave: 'atenciones', titulo: 'Atenciones relacionadas', descripcion: 'Consultas o atenciones vinculadas a los exámenes, según el contrato común.',
    columnas: ['Fecha y hora', 'Profesional', 'Motivo'] }
];
const comoColumnas = titulos => titulos.map(t => ({ clave: t, titulo: t }));

export default function Expediente() {
  const { id, seccion = 'resumen' } = useParams();
  const { vistaPrevia, enlace } = useModulo();
  const navegar = useNavigate();
  const actual = PESTANAS.find(t => t.clave === seccion) || PESTANAS[0];
  const base = `/pacientes/${encodeURIComponent(id)}`;

  return (
    <>
      <EncabezadoExpediente id={id} vistaPrevia={vistaPrevia} />
      <PendienteIntegracion compacto />
      <Tabs etiqueta="Secciones del expediente" actual={actual.clave} pestanas={PESTANAS}
        onCambiar={k => navegar(enlace(k === 'resumen' ? base : `${base}/${k}`))} />
      <div role="tabpanel" aria-label={actual.titulo}>
        {actual.clave === 'resumen' ? <Resumen /> : <>
          <Card titulo={actual.titulo} descripcion={actual.descripcion}
            acciones={actual.accion && <button type="button" className="btn btn-primary btn-sm" disabled title="Disponible al conectar el backend"><Icon name="mas" size={16} />{actual.accion}</button>}>
            <TablaPendiente titulo={actual.titulo} columnas={comoColumnas(actual.columnas)} />
          </Card>
          {actual.visor && <Card titulo="Detalle del resultado"><VisorResultado /></Card>}
        </>}
      </div>
    </>
  );
}

function Resumen() {
  return (
    <div className="grid grid-2">
      <Card titulo="Datos generales">
        <KeyValue items={[['Nombres', '—'], ['Apellidos', '—'], ['Fecha de nacimiento', '—'], ['Sexo', '—'], ['Estado del historial', '—']]} />
      </Card>
      <Card titulo="Información propia del laboratorio">
        <div className="reserved-slot">
          <span className="state-icon" aria-hidden="true"><Icon name="matraz" size={22} /></span>
          <div>
            <b>Espacio reservado</b>
            <p>Datos institucionales del paciente en el laboratorio que defina su backend. Se mostrarán aquí al conectarlo.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
