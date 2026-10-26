import { useNavigate, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, Icon, KeyValue, PendienteIntegracion, TablaPendiente, Tabs } from '@plataforma/ui/index.js';
import EncabezadoExpediente from '../componentes/EncabezadoExpediente.jsx';

// Secciones del expediente. Columnas tomadas del contrato común de operaciones
// (docs/GUIA_INTEGRACION_EQUIPO.md §5.1); el backend del Hospital puede ampliarlas.
const PESTANAS = [
  { clave: 'resumen', titulo: 'Datos generales' },
  { clave: 'consultas', titulo: 'Consultas', accion: 'Registrar consulta', descripcion: 'Atenciones del paciente, de la más reciente a la más antigua.',
    columnas: ['Fecha y hora', 'Médico', 'Motivo', 'Observaciones'] },
  { clave: 'diagnosticos', titulo: 'Diagnósticos', accion: 'Agregar diagnóstico', descripcion: 'Diagnósticos registrados en las consultas.',
    columnas: ['Código', 'Descripción', 'Consulta', 'Fecha'] },
  { clave: 'tratamientos', titulo: 'Tratamientos', accion: 'Registrar tratamiento', descripcion: 'Tratamiento indicado en cada consulta.',
    columnas: ['Descripción', 'Recomendaciones', 'Consulta', 'Fecha'] },
  { clave: 'prescripciones', titulo: 'Medicamentos y prescripciones', accion: 'Recetar medicamento', descripcion: 'Historial de medicamentos recetados.',
    columnas: ['Medicamento', 'Dosis', 'Frecuencia', 'Duración', 'Vía de administración'] }
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
        {actual.clave === 'resumen' ? <Resumen /> : (
          <Card titulo={actual.titulo} descripcion={actual.descripcion}
            acciones={<button type="button" className="btn btn-primary btn-sm" disabled title="Disponible al conectar el backend"><Icon name="mas" size={16} />{actual.accion}</button>}>
            <TablaPendiente titulo={actual.titulo} columnas={comoColumnas(actual.columnas)} />
          </Card>
        )}
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
      <Card titulo="Información propia del hospital">
        <div className="reserved-slot">
          <span className="state-icon" aria-hidden="true"><Icon name="hospital" size={22} /></span>
          <div>
            <b>Espacio reservado</b>
            <p>Datos institucionales del expediente (por ejemplo, los que el equipo del hospital defina en su modelo). Se mostrarán aquí al conectar el backend.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
