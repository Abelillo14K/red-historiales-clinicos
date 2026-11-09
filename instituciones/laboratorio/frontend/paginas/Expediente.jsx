import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, DataTable, ErrorState, Icon, KeyValue, LoadingState, StatusBadge, Tabs, useCarga } from '@plataforma/ui/index.js';
import { fecha, fechaHora, fechaLocal } from '@plataforma/formato.js';
import EncabezadoExpediente from '../componentes/EncabezadoExpediente.jsx';
import { TONO_ESTADO, valorDe } from '../componentes/formato.js';

// Pestañas del expediente y permiso que requiere cada una (el backend vuelve a verificarlo).
const PESTANAS = [
  { clave: 'resumen', titulo: 'Datos generales' },
  { clave: 'solicitudes', titulo: 'Solicitudes', permiso: 'historial.leer', cuenta: p => p.solicitudes?.length },
  { clave: 'resultados', titulo: 'Resultados', permiso: 'historial.leer', cuenta: p => examenes(p).filter(e => e.resultado).length },
  { clave: 'historial', titulo: 'Historial de resultados', permiso: 'historial.leer' }
];

const examenes = p => (p.solicitudes || []).flatMap(s => s.examenes.map(e => ({ ...e, solicitud: s })));

export default function Expediente() {
  const { id, seccion = 'resumen' } = useParams();
  const { api, puede, enlace } = useModulo();
  const navegar = useNavigate();
  const clinico = puede('historial.leer');
  const pac = useCarga(() => (clinico ? api.pacientes.obtener(id) : api.pacientes.administrativo(id)), [api, id, clinico]);

  if (pac.cargando && !pac.datos) return <LoadingState texto="Cargando expediente…" />;
  if (pac.error) {
    return <>
      <ErrorState error={pac.error} onReintentar={pac.recargar} />
      <Link className="btn" to={enlace('/pacientes')}>Volver a pacientes</Link>
    </>;
  }
  const p = pac.datos;
  const pestanas = PESTANAS.filter(t => !t.permiso || puede(t.permiso)).map(t => ({ ...t, cuenta: t.cuenta ? t.cuenta(p) : undefined }));
  const actual = pestanas.some(t => t.clave === seccion) ? seccion : 'resumen';
  const base = `/pacientes/${encodeURIComponent(id)}`;

  return (
    <>
      <EncabezadoExpediente paciente={p} />
      {p.estado_historial !== 'Activo' && (
        <div className="archived-banner" role="status">
          <Icon name="archivo" />
          <span>Historial archivado el {fechaHora(p.fecha_archivado)} — motivo: {p.motivo_archivado}. Se conserva completo en modo de solo lectura.</span>
        </div>
      )}
      {pestanas.length > 1 && (
        <Tabs etiqueta="Secciones del expediente" actual={actual} pestanas={pestanas}
          onCambiar={k => navegar(enlace(k === 'resumen' ? base : `${base}/${k}`))} />
      )}
      <div role="tabpanel" aria-label={pestanas.find(t => t.clave === actual)?.titulo}>
        {actual === 'resumen' && <Resumen paciente={p} />}
        {actual === 'solicitudes' && <Solicitudes paciente={p} />}
        {actual === 'resultados' && <Resultados paciente={p} />}
        {actual === 'historial' && <Historial paciente={p} />}
      </div>
    </>
  );
}

function Resumen({ paciente: p }) {
  return (
    <div className="grid grid-2">
      <Card titulo="Datos generales" icono="usuario">
        <KeyValue items={[
          ['Nombres', p.nombres], ['Apellidos', p.apellidos], ['Documento de identidad', p.documento_identidad],
          ['Fecha de nacimiento', fecha(p.fecha_nacimiento)], ['Sexo', p.sexo === 'F' ? 'Femenino' : 'Masculino'],
          ['Estado del historial', p.estado_historial], ['Fecha de registro', fechaLocal(p.fecha_registro)]
        ]} />
      </Card>
      <Card titulo="Contacto" icono="telefono">
        <KeyValue items={[
          ['Teléfono', p.telefono], ['Correo electrónico', p.correo], ['Dirección', p.direccion],
          ['Contacto de emergencia', p.contacto_emergencia], ['Teléfono de emergencia', p.telefono_emergencia],
          ['Observaciones', p.observaciones]
        ]} />
      </Card>
    </div>
  );
}

function Solicitudes({ paciente: p }) {
  const { enlace } = useModulo();
  return (
    <Card titulo="Solicitudes de exámenes" icono="matraz" descripcion="Más reciente primero.">
      <DataTable titulo="Solicitudes" vacio="El paciente no tiene solicitudes" filas={p.solicitudes} claveFila={s => s.id_solicitud} columnas={[
        { clave: 'fecha', titulo: 'Fecha', principal: true, render: s => <Link className="row-link" to={enlace(`/solicitudes/${s.id_solicitud}`)}>{fechaHora(s.fecha_solicitud)}</Link> },
        { clave: 'examenes', titulo: 'Exámenes', render: s => s.examenes.map(e => e.tipo_examen).join(', ') },
        { clave: 'origen', titulo: 'Solicitado por', render: s => s.medico || s.institucion_remitente || '—' },
        { clave: 'prioridad', titulo: 'Prioridad', render: s => <StatusBadge tono={TONO_ESTADO[s.prioridad]} sinPunto>{s.prioridad}</StatusBadge> },
        { clave: 'estado', titulo: 'Estado', render: s => <StatusBadge tono={TONO_ESTADO[s.estado]}>{s.estado}</StatusBadge> }
      ]} />
    </Card>
  );
}

function Resultados({ paciente: p }) {
  const { enlace } = useModulo();
  const conResultado = examenes(p).filter(e => e.resultado);
  return (
    <Card titulo="Resultados" icono="resultado" descripcion="Un resultado por examen; el detalle muestra cada parámetro con su referencia.">
      <DataTable titulo="Resultados" vacio="Aún no hay resultados" filas={conResultado} claveFila={e => e.id_examen} columnas={[
        { clave: 'examen', titulo: 'Examen', principal: true, render: e => <Link className="row-link" to={enlace(`/resultados/${e.resultado.id_resultado}`)}>{e.tipo_examen}</Link> },
        { clave: 'fecha', titulo: 'Fecha de análisis', render: e => fechaHora(e.resultado.fecha_analisis) },
        { clave: 'fuera', titulo: 'Fuera de rango', num: true, render: e => e.resultado.detalles.filter(d => d.fuera_de_rango).length },
        { clave: 'estado', titulo: 'Estado', render: e => <StatusBadge tono={TONO_ESTADO[e.resultado.estado]}>{e.resultado.estado}</StatusBadge> }
      ]} />
    </Card>
  );
}

// Todos los valores registrados del paciente, agrupables por parámetro (orden cronológico inverso).
function Historial({ paciente: p }) {
  const filas = examenes(p).filter(e => e.resultado).flatMap(e => e.resultado.detalles.map(d => ({ ...d, examen: e })))
    .sort((a, b) => a.parametro.localeCompare(b.parametro) || new Date(b.examen.resultado.fecha_analisis) - new Date(a.examen.resultado.fecha_analisis));
  return (
    <Card titulo="Historial de resultados" icono="crecimiento" descripcion="Valores por parámetro para comparar entre fechas.">
      <DataTable titulo="Historial de resultados" vacio="Aún no hay valores registrados" filas={filas} claveFila={d => `${d.examen.id_examen}-${d.id_parametro}`}
        resaltar={d => d.fuera_de_rango} columnas={[
          { clave: 'parametro', titulo: 'Parámetro', principal: true, render: d => d.parametro },
          { clave: 'valor', titulo: 'Valor', render: d => `${valorDe(d)}${d.unidad_medida && d.valor_numerico != null ? ` ${d.unidad_medida}` : ''}` },
          { clave: 'rango', titulo: 'Referencia', render: d => (d.fuera_de_rango ? <StatusBadge tono="warn" sinPunto>Fuera de rango</StatusBadge> : 'Dentro') },
          { clave: 'examen', titulo: 'Examen', render: d => d.examen.tipo_examen },
          { clave: 'fecha', titulo: 'Fecha', render: d => fechaLocal(d.examen.resultado.fecha_analisis) },
          { clave: 'estado', titulo: 'Estado', render: d => <StatusBadge tono={TONO_ESTADO[d.examen.resultado.estado]}>{d.examen.resultado.estado}</StatusBadge> }
        ]} />
    </Card>
  );
}
