import { useNavigate, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, ContextPanel, Icon, KeyValue, MetricStrip, PendienteIntegracion, SectionIntro, TablaPendiente, Tabs } from '@plataforma/ui/index.js';
import EncabezadoExpediente from '../componentes/EncabezadoExpediente.jsx';
import PiezasDentales from '../componentes/PiezasDentales.jsx';

// Secciones del expediente odontológico. Las comunes usan las columnas del contrato
// (docs/GUIA_INTEGRACION_EQUIPO.md §5.1); «Piezas dentales» es la extensión propia.
const PESTANAS = [
  { clave: 'resumen', titulo: 'Datos generales' },
  { clave: 'consultas', titulo: 'Consultas', accion: 'Registrar consulta', descripcion: 'Atenciones del paciente, de la más reciente a la más antigua.',
    columnas: ['Fecha y hora', 'Odontólogo', 'Motivo', 'Observaciones'] },
  { clave: 'diagnosticos', titulo: 'Diagnósticos', accion: 'Agregar diagnóstico', descripcion: 'Diagnósticos registrados en las consultas.',
    columnas: ['Código', 'Descripción', 'Consulta', 'Fecha'] },
  { clave: 'tratamientos', titulo: 'Tratamientos', accion: 'Registrar tratamiento', descripcion: 'Tratamiento indicado en cada consulta. El detalle por pieza dental se agregará con su contrato de datos.',
    columnas: ['Descripción', 'Recomendaciones', 'Consulta', 'Fecha'] },
  { clave: 'prescripciones', titulo: 'Prescripciones', accion: 'Recetar medicamento', descripcion: 'Historial de medicamentos recetados.',
    columnas: ['Medicamento', 'Dosis', 'Frecuencia', 'Duración', 'Vía de administración'] },
  { clave: 'piezas', titulo: 'Piezas dentales' }
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
      <div className="workspace-grid"><div className="workspace-main">
      <Tabs etiqueta="Secciones del expediente" actual={actual.clave} pestanas={PESTANAS}
        onCambiar={k => navegar(enlace(k === 'resumen' ? base : `${base}/${k}`))} />
      <div role="tabpanel" aria-label={actual.titulo}>
        <SectionIntro titulo={actual.titulo} descripcion={actual.descripcion || 'Información del expediente odontológico.'} icono={actual.clave === 'piezas' ? 'diente' : 'consulta'} />
        {actual.clave === 'resumen' && <Resumen />}
        {actual.clave === 'piezas' && (
          <Card titulo="Piezas dentales" icono="diente" descripcion="Mapa visual y detalle de tratamientos por pieza.">
            <PiezasDentales />
          </Card>
        )}
        {actual.columnas && (
          <Card titulo={actual.titulo} icono={actual.clave === 'prescripciones' ? 'receta' : 'consulta'} descripcion={actual.descripcion}
            acciones={<button type="button" className="btn btn-primary btn-sm" disabled title="Disponible al conectar el backend"><Icon name="mas" size={16} />{actual.accion}</button>}>
            <TablaPendiente titulo={actual.titulo} columnas={comoColumnas(actual.columnas)} />
          </Card>
        )}
      </div>
      </div><aside className="workspace-aside" aria-label="Resumen odontológico">
        <ContextPanel titulo="Atención odontológica" icono="diente" items={[
          ['Última consulta', '—'], ['Tratamiento activo', '—'], ['Odontólogo', '—']
        ]} />
        <ContextPanel titulo="Próxima cita" icono="calendario" descripcion="La fecha y el motivo se mostrarán al vincular la agenda del paciente." />
        <ContextPanel titulo="Alergias y antecedentes" icono="auditoria" descripcion="Sin datos de un paciente. La información relevante se mostrará en el contexto de cada atención." />
      </aside></div>
    </>
  );
}

function Resumen() {
  return (
    <>
      <MetricStrip items={[
        { etiqueta: 'Consultas', icono: 'consulta' }, { etiqueta: 'Tratamientos', icono: 'diente' }, { etiqueta: 'Prescripciones', icono: 'receta' }
      ]} />
      <Card titulo="Datos generales" icono="usuario">
        <KeyValue items={[['Nombres', '—'], ['Apellidos', '—'], ['Fecha de nacimiento', '—'], ['Sexo', '—'], ['Estado del historial', '—']]} />
      </Card>
      <Card titulo="Contacto y antecedentes" icono="pacientes">
        <KeyValue items={[
          ['Teléfono', '—'], ['Correo electrónico', '—'], ['Contacto de emergencia', '—'], ['Alergias registradas', '—'], ['Antecedentes médicos', '—']
        ]} />
      </Card>
    </>
  );
}
