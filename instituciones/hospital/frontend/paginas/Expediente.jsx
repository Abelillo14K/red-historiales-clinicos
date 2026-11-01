import { useNavigate, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, ContextPanel, Icon, KeyValue, PendienteIntegracion, SectionIntro, TablaPendiente, Tabs } from '@plataforma/ui/index.js';
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
    columnas: ['Medicamento', 'Dosis', 'Frecuencia', 'Duración', 'Vía de administración'] },
  { clave: 'examenes', titulo: 'Exámenes', accion: 'Ordenar examen', descripcion: 'Órdenes y resultados asociados al historial.', columnas: ['Examen', 'Fecha', 'Estado', 'Resultado'] },
  { clave: 'hospitalizaciones', titulo: 'Hospitalizaciones', accion: 'Registrar ingreso', descripcion: 'Ingresos y egresos hospitalarios.', columnas: ['Ingreso', 'Egreso', 'Servicio', 'Estado'] },
  { clave: 'antecedentes', titulo: 'Antecedentes', accion: 'Agregar antecedente', descripcion: 'Antecedentes personales y familiares.', columnas: ['Tipo', 'Descripción', 'Fecha de registro'] }
];
const comoColumnas = titulos => titulos.map(t => ({ clave: t, titulo: t }));

export default function Expediente() {
  const { id, seccion = 'consultas' } = useParams();
  const { vistaPrevia, enlace } = useModulo();
  const navegar = useNavigate();
  const actual = PESTANAS.find(t => t.clave === seccion) || PESTANAS[0];
  const base = `/pacientes/${encodeURIComponent(id)}`;

  return (
    <>
      <EncabezadoExpediente id={id} vistaPrevia={vistaPrevia} />
      <PendienteIntegracion compacto />
      <div className="clinical-columns">
      <div>
      <Tabs etiqueta="Secciones del expediente" actual={actual.clave} pestanas={PESTANAS}
        onCambiar={k => navegar(enlace(`${base}/${k}`))} />
      <div role="tabpanel" aria-label={actual.titulo}>
        <SectionIntro titulo={actual.titulo} descripcion={actual.descripcion || 'Identificación y contexto de atención del paciente.'} icono="hospital" />
        {actual.clave === 'resumen' ? <Resumen /> : (
          <Card titulo={actual.titulo} icono="consulta" descripcion={actual.descripcion}
            acciones={<button type="button" className="btn btn-primary btn-sm" disabled title="Disponible al conectar el backend"><Icon name="mas" size={16} />{actual.accion}</button>}>
            <TablaPendiente titulo={actual.titulo} columnas={comoColumnas(actual.columnas)} />
          </Card>
        )}
      </div>
      </div>
      <aside className="stack" aria-label="Resumen de la atención">
        <Card titulo="Signos vitales" icono="diagnostico"><dl className="vital-grid">
          {['Presión arterial', 'Frec. cardíaca', 'Temperatura', 'Saturación O₂', 'Frec. respiratoria', 'IMC'].map(v => <div key={v}><dt>{v}</dt><dd>—</dd></div>)}
        </dl></Card>
        <ContextPanel titulo="Contactos de emergencia" icono="pacientes" descripcion="Los contactos se mostrarán al conectar el expediente del paciente." />
      </aside>
      </div>
    </>
  );
}

function Resumen() {
  return (
    <div className="grid grid-2">
      <Card titulo="Datos generales" icono="usuario">
        <KeyValue items={[['Nombres', '—'], ['Apellidos', '—'], ['Fecha de nacimiento', '—'], ['Sexo', '—'], ['Estado del historial', '—']]} />
      </Card>
      <Card titulo="Contacto y seguro médico" icono="hospital">
        <KeyValue items={[
          ['Teléfono', '—'], ['Correo electrónico', '—'], ['Aseguradora', '—'], ['Número de póliza', '—'], ['Vigencia', '—']
        ]} />
      </Card>
    </div>
  );
}
