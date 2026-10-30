import { Link } from 'react-router-dom';
import { Card, PageHeader } from './Pagina.jsx';
import { FilterBar, FormField, FormularioVistaPrevia } from './Formularios.jsx';
import { FormSteps, FormSummary, SectionHeading } from './FlujoClinico.jsx';
import { Icon } from './Icon.jsx';
import { PendienteIntegracion } from './Estados.jsx';
import { StatusBadge, TablaPendiente } from './Datos.jsx';

// Patrones visuales compartidos. Los datos y acciones llegan por props;
// estos componentes no conocen motores, sesiones ni operaciones de persistencia.
export function SectionIntro({ titulo, descripcion, icono = 'consulta', acciones }) {
  return <div className="section-intro">
    <span className="section-intro-icon" aria-hidden="true"><Icon name={icono} size={23} /></span>
    <div><h2>{titulo}</h2>{descripcion && <p>{descripcion}</p>}</div>
    {acciones && <div className="actions">{acciones}</div>}
  </div>;
}

export function MetricStrip({ items, etiqueta = 'Resumen de la sección' }) {
  return <dl className="metric-strip" aria-label={etiqueta}>{items.map(({ etiqueta: label, valor, icono, tono }) =>
    <div key={label} className={tono ? `tone-${tono}` : undefined}>
      {icono && <span className="metric-icon" aria-hidden="true"><Icon name={icono} size={20} /></span>}
      <dt>{label}</dt><dd>{valor ?? '—'}</dd>
    </div>
  )}</dl>;
}

export function ContextPanel({ titulo, descripcion, icono = 'info', items = [], children }) {
  return <Card titulo={titulo} icono={icono} className="context-panel">
    {descripcion && <p className="meta">{descripcion}</p>}
    {items.length > 0 && <dl className="context-list">{items.map(([label, valor]) => <div key={label}><dt>{label}</dt><dd>{valor ?? '—'}</dd></div>)}</dl>}
    {children}
  </Card>;
}

export function CamposVistaPrevia({ campos }) {
  return <div className="form-grid">{campos.map(({ label, tipo = 'text', opciones, required, full, hint, placeholder }) =>
    <FormField key={label} label={label} required={required} full={full} hint={hint}>
      {a => opciones ? <select {...a}><option value="">Seleccione…</option>{opciones.map(o => <option key={o}>{o}</option>)}</select>
        : tipo === 'textarea' ? <textarea {...a} rows={3} placeholder={placeholder} />
          : <input {...a} type={tipo} step={tipo === 'number' ? 'any' : undefined} placeholder={placeholder} />}
    </FormField>
  )}</div>;
}

export function FormularioInstitucionalVistaPrevia({ titulo, descripcion, volver, secciones, resumen = [], etiquetaEnvio = 'Guardar', nota }) {
  return <>
    <PageHeader titulo={titulo} descripcion={descripcion} acciones={<Link className="btn" to={volver}>Volver</Link>} />
    <PendienteIntegracion compacto />
    <FormSteps pasos={secciones.map(s => ({ id: s.id, titulo: s.paso || s.titulo }))} />
    <FormularioVistaPrevia titulo={titulo} mostrarAcciones={false}>
      <div className="form-layout">
        <div className="form-body">{secciones.map((s, i) => <Card key={s.id} id={s.id}>
          <SectionHeading numero={i + 1} titulo={s.titulo} descripcion={s.descripcion} />
          {s.campos && <CamposVistaPrevia campos={s.campos} />}{s.contenido}
        </Card>)}</div>
        <div className="form-side"><FormSummary items={resumen}>
          <p className="summary-note">{nota || 'Los datos y el código definitivo estarán disponibles al conectar el backend de esta institución.'}</p>
          <button type="submit" className="btn btn-primary btn-block">{etiquetaEnvio}</button>
          <Link className="btn btn-block" to={volver}>Cancelar</Link>
        </FormSummary>
        <ContextPanel titulo="Información del expediente" icono="auditoria" descripcion="Los campos clínicos y sus permisos se confirmarán con el backend. Esta vista presenta el diseño del formulario." />
        </div>
      </div>
    </FormularioVistaPrevia>
  </>;
}

export function EncabezadoExpedienteVistaPrevia({ id, vistaPrevia, datosClave, acciones, icono = 'usuario' }) {
  return <section className="card patient-header" aria-labelledby="titulo-expediente">
    <div className="patient-main">
      <div className="patient-id"><div className="avatar" aria-hidden="true"><Icon name={icono} size={26} /></div>
        <div><h1 id="titulo-expediente">{vistaPrevia ? 'Expediente clínico' : `Expediente ${id}`}</h1>
          <div className="page-meta"><span>{vistaPrevia ? 'Estructura sin paciente' : id}</span><StatusBadge tono="info">Pendiente de integración</StatusBadge></div>
        </div>
      </div>
      <div className="actions">{acciones}</div>
    </div>
    <dl className="patient-facts">{datosClave.map(d => <div key={d}><dt>{d}</dt><dd>—<small>Sin datos</small></dd></div>)}</dl>
  </section>;
}

export function ArchivoInstitucionalVistaPrevia({ volver, prefijo }) {
  return <FormularioInstitucionalVistaPrevia titulo="Archivar historial clínico" descripcion="Conservación del expediente en modo de solo lectura."
    volver={volver} etiquetaEnvio="Archivar historial" resumen={[
      ['Expediente', 'Sin paciente'], ['Estado previsto', 'Archivado'], ['Auditoría', 'Al integrar el backend']
    ]} secciones={[
      { id: `${prefijo}-motivo`, titulo: 'Motivo de la baja', paso: 'Motivo', contenido: <div className="archive-reasons">
        {['Traslado', 'Fallecimiento', 'Causa administrativa'].map((m, i) => <label className="archive-reason" key={m}>
          <input type="radio" name={`${prefijo}-motivo`} defaultChecked={i === 0} /><span><b>{m}</b><small>La causa y sus detalles se conservarán en el expediente.</small></span>
        </label>)}
      </div> },
      { id: `${prefijo}-detalle`, titulo: 'Detalles del archivo', paso: 'Detalles', campos: [
        { label: 'Fecha de la baja', tipo: 'date', required: true }, { label: 'Institución de destino' },
        { label: 'Observaciones', tipo: 'textarea', full: true }
      ] },
      { id: `${prefijo}-confirmacion`, titulo: 'Confirmación', contenido: <>
        <div className="archive-effects">
          <div><Icon name="archivo" /><b>Solo lectura</b><p>Se conserva el historial de atenciones.</p></div>
          <div><Icon name="pacientes" /><b>Datos del paciente</b><p>El expediente no se elimina.</p></div>
          <div><Icon name="auditoria" /><b>Trazabilidad</b><p>La operación deberá registrar su responsable.</p></div>
        </div>
        <label className="check mt-4"><input type="checkbox" />Confirmo que los datos de la baja son correctos.</label>
      </> }
    ]} />;
}

export function AgendaInstitucionalVistaPrevia({ titulo, profesional }) {
  return <>
    <PageHeader titulo={titulo} descripcion="Agenda, datos de la cita y contexto de atención del paciente."
      acciones={<button type="button" className="btn btn-primary" disabled><Icon name="mas" size={16} />Programar cita</button>} />
    <PendienteIntegracion compacto />
    <MetricStrip items={[
      { etiqueta: 'Citas de hoy', icono: 'calendario' }, { etiqueta: 'Pendientes', icono: 'reloj' },
      { etiqueta: 'Atendidas', icono: 'ok' }, { etiqueta: 'Canceladas', icono: 'archivo' }
    ]} />
    <div className="workspace-grid"><div className="workspace-main">
      <Card titulo="Agenda de atención" icono="calendario">
        <FilterBar etiqueta="Filtrar citas">
          <FormField label="Fecha">{a => <input {...a} type="date" disabled />}</FormField>
          <FormField label="Estado">{a => <select {...a} disabled><option>Todos</option></select>}</FormField>
        </FilterBar>
        <TablaPendiente titulo="Citas" columnas={['Fecha y hora', 'Paciente', profesional, 'Motivo', 'Estado'].map(t => ({ clave: t, titulo: t }))} />
      </Card>
      <Card titulo="Datos de la cita" icono="consulta" descripcion="Diseño del formulario de programación.">
        <FormularioVistaPrevia titulo="Programar cita" etiquetaEnvio="Guardar cita">
          <CamposVistaPrevia campos={[
            { label: 'Paciente o expediente', tipo: 'search', required: true }, { label: profesional, opciones: [], required: true },
            { label: 'Fecha y hora de la cita', tipo: 'datetime-local', required: true }, { label: 'Motivo de la cita', required: true },
            { label: 'Observaciones', tipo: 'textarea', full: true }
          ]} />
        </FormularioVistaPrevia>
      </Card>
    </div><aside className="workspace-aside" aria-label="Contexto de la agenda">
      <ContextPanel titulo="Cita seleccionada" icono="calendario" items={[
        ['Paciente', '—'], [profesional, '—'], ['Fecha y hora', '—'], ['Estado', '—']
      ]} />
      <ContextPanel titulo="Continuidad de atención" icono="consulta" descripcion="La cita se vinculará con el expediente y la consulta de la institución." />
    </aside></div>
  </>;
}

export function AdministracionInstitucionalVistaPrevia({ tipo, catalogos }) {
  const esCatalogo = tipo === 'catalogos';
  const titulo = esCatalogo ? 'Catálogos' : 'Bitácora de acceso';
  const icono = esCatalogo ? 'consulta' : 'auditoria';
  const columnas = esCatalogo ? ['Catálogo', 'Código', 'Nombre', 'Estado'] : ['Fecha y hora', 'Usuario', 'Acción', 'Paciente', 'Resultado'];
  return <>
    <PageHeader titulo={titulo} descripcion={esCatalogo ? 'Datos de referencia para los formularios y atenciones de la institución.' : 'Accesos y operaciones registrados con su usuario responsable.'} />
    <PendienteIntegracion compacto />
    <div className="workspace-grid"><div className="workspace-main">
      <SectionIntro titulo={esCatalogo ? 'Referencias de la institución' : 'Trazabilidad de operaciones'} icono={icono} descripcion="La información se cargará desde el backend de esta institución." />
      <Card titulo={titulo} icono={icono}>
        <FilterBar etiqueta={esCatalogo ? 'Filtrar catálogos' : 'Filtrar bitácora'}>
          <FormField label={esCatalogo ? 'Catálogo' : 'Acción'}>{a => <select {...a} disabled><option>Todos</option>{esCatalogo && catalogos.map(c => <option key={c}>{c}</option>)}</select>}</FormField>
          <FormField label={esCatalogo ? 'Buscar referencia' : 'Código de paciente'}>{a => <input {...a} disabled />}</FormField>
        </FilterBar>
        <TablaPendiente titulo={titulo} columnas={columnas.map(t => ({ clave: t, titulo: t }))} />
      </Card>
    </div><aside className="workspace-aside" aria-label={`Contexto de ${titulo.toLowerCase()}`}>
      <ContextPanel titulo={esCatalogo ? 'Catálogos previstos' : 'Información del evento'} icono={icono}
        items={esCatalogo ? catalogos.map(c => [c, 'Por integrar']) : [['Usuario', '—'], ['Acción', '—'], ['Resultado', '—']]} />
    </aside></div>
  </>;
}
