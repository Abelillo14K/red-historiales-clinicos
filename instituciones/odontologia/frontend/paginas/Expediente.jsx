import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, DataTable, Dialogo, EmptyState, ErrorState, FormField, Icon, KeyValue, LoadingState, StatusBadge, Tabs, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { fecha, fechaHora, fechaLocal } from '@plataforma/formato.js';
import EncabezadoExpediente from '../componentes/EncabezadoExpediente.jsx';
import PiezasDentales from '../componentes/PiezasDentales.jsx';
import { TONO_CITA, deConsultas, sexo } from '../componentes/formato.js';

// Pestañas del expediente y permiso que requiere cada una (el backend vuelve a verificarlo).
const PESTANAS = [
  { clave: 'resumen', titulo: 'Datos generales' },
  { clave: 'consultas', titulo: 'Consultas', permiso: 'historial.leer', cuenta: p => p.consultas?.length },
  { clave: 'diagnosticos', titulo: 'Diagnósticos', permiso: 'historial.leer', cuenta: p => deConsultas(p.consultas, 'diagnosticos').length },
  { clave: 'tratamientos', titulo: 'Tratamientos', permiso: 'historial.leer', cuenta: p => deConsultas(p.consultas, 'tratamientos').length },
  { clave: 'prescripciones', titulo: 'Prescripciones', permiso: 'historial.leer', cuenta: p => deConsultas(p.consultas, 'prescripciones').length },
  { clave: 'piezas', titulo: 'Piezas dentales', permiso: 'historial.leer' },
  { clave: 'citas', titulo: 'Citas', permiso: 'historial.leer', cuenta: p => p.citas?.length }
];

export default function Expediente() {
  const { id, seccion = 'resumen' } = useParams();
  const { api, puede, enlace } = useModulo();
  const navegar = useNavigate();
  const clinico = puede('historial.leer');
  const pac = useCarga(() => (clinico ? api.pacientes.obtener(id) : api.pacientes.administrativo(id)), [api, id, clinico]);

  if (pac.cargando && !pac.datos) return <LoadingState texto="Cargando expediente…" />;
  if (pac.error) return <><ErrorState error={pac.error} onReintentar={pac.recargar} /><Link className="btn" to={enlace('/pacientes')}>Volver a pacientes</Link></>;
  const p = pac.datos;
  const editable = p.estado_historial === 'Activo' && puede('clinico.escribir');
  const pestanas = PESTANAS.filter(t => !t.permiso || puede(t.permiso)).map(t => ({ ...t, cuenta: t.cuenta ? t.cuenta(p) : undefined }));
  const actual = pestanas.some(t => t.clave === seccion) ? seccion : 'resumen';
  const base = `/pacientes/${encodeURIComponent(id)}`;
  const ctx = { paciente: p, editable, recargar: pac.recargar };

  return (
    <>
      <EncabezadoExpediente paciente={p} />
      {p.estado_historial !== 'Activo' && (
        <div className="archived-banner" role="status">
          <Icon name="archivo" />
          <span>Historial archivado el {fechaHora(p.fecha_archivado)} — motivo: {p.motivo_archivado}. Se conserva completo en modo de solo lectura.</span>
        </div>
      )}
      {pestanas.length > 1 && <Tabs etiqueta="Secciones del expediente" actual={actual} pestanas={pestanas}
        onCambiar={k => navegar(enlace(k === 'resumen' ? base : `${base}/${k}`))} />}
      <div role="tabpanel" aria-label={pestanas.find(t => t.clave === actual)?.titulo}>
        {actual === 'resumen' && <Resumen paciente={p} />}
        {actual === 'consultas' && <Consultas {...ctx} />}
        {actual === 'diagnosticos' && <Listado titulo="Diagnósticos" filas={deConsultas(p.consultas, 'diagnosticos')} columnas={[
          { clave: 'codigo', titulo: 'Código', principal: true, render: d => <code>{d.codigo}</code> },
          { clave: 'descripcion', titulo: 'Descripción' }, { clave: 'pieza', titulo: 'Pieza', render: d => d.pieza || '—' },
          { clave: 'fecha', titulo: 'Consulta', render: d => fechaLocal(d.consulta.fecha_hora) }
        ]} />}
        {actual === 'tratamientos' && <Listado titulo="Tratamientos" filas={deConsultas(p.consultas, 'tratamientos')} columnas={[
          { clave: 'procedimiento', titulo: 'Procedimiento', principal: true },
          { clave: 'pieza', titulo: 'Pieza', render: t => t.pieza || 'General' },
          { clave: 'descripcion', titulo: 'Descripción', render: t => t.descripcion || '—' },
          { clave: 'recomendaciones', titulo: 'Recomendaciones', render: t => t.recomendaciones || '—' },
          { clave: 'fecha', titulo: 'Consulta', render: t => fechaLocal(t.consulta.fecha_hora) }
        ]} />}
        {actual === 'prescripciones' && <Listado titulo="Prescripciones" filas={deConsultas(p.consultas, 'prescripciones').flatMap(rx => rx.medicamentos.map((m, i) => ({ ...m, rx, i })))}
          clave={m => `${m.rx.id_prescripcion}-${m.i}`} columnas={[
            { clave: 'nombre', titulo: 'Medicamento', principal: true },
            { clave: 'dosis', titulo: 'Dosis' }, { clave: 'frecuencia', titulo: 'Frecuencia' }, { clave: 'duracion', titulo: 'Duración' },
            { clave: 'via', titulo: 'Vía', render: m => m.via_administracion },
            { clave: 'fecha', titulo: 'Emitida', render: m => fechaLocal(m.rx.fecha_emision) }
          ]} />}
        {actual === 'piezas' && <Card titulo="Piezas dentales" icono="diente" descripcion="Odontograma: elija una pieza para ver su detalle o registrar su estado.">
          <PiezasDentales paciente={p} editable={editable} onCambio={pac.recargar} />
        </Card>}
        {actual === 'citas' && <Listado titulo="Citas del paciente" filas={p.citas} clave={c => c.id_cita} columnas={[
          { clave: 'fecha', titulo: 'Fecha y hora', principal: true, render: c => fechaHora(c.fecha_hora) },
          { clave: 'odontologo', titulo: 'Odontólogo' }, { clave: 'motivo', titulo: 'Motivo' },
          { clave: 'estado', titulo: 'Estado', render: c => <StatusBadge tono={TONO_CITA[c.estado]}>{c.estado}</StatusBadge> }
        ]} />}
      </div>
    </>
  );
}

function Listado({ titulo, filas, columnas, clave }) {
  return <Card titulo={titulo}>
    <DataTable titulo={titulo} vacio="Sin registros todavía" filas={filas} columnas={columnas} claveFila={clave || (x => x._fila)} />
  </Card>;
}

function Resumen({ paciente: p }) {
  return (
    <div className="grid grid-2">
      <Card titulo="Datos generales" icono="usuario">
        <KeyValue items={[
          ['Nombres', p.nombres], ['Apellidos', p.apellidos], ['Documento de identidad', p.documento_identidad],
          ['Fecha de nacimiento', fecha(p.fecha_nacimiento)], ['Sexo', sexo(p.sexo)], ['Estado del historial', p.estado_historial],
          ['Registrado', `${fechaLocal(p.fecha_registro)} por ${p.registrado_por}`]
        ]} />
      </Card>
      <Card titulo="Contacto" icono="telefono">
        <KeyValue items={[
          ['Teléfono', p.contacto?.telefono], ['Correo electrónico', p.contacto?.correo], ['Dirección', p.contacto?.direccion],
          ['Contacto de emergencia', p.contacto?.contacto_emergencia], ['Teléfono de emergencia', p.contacto?.telefono_emergencia]
        ]} />
      </Card>
      {p.antecedentes && <Card titulo="Antecedentes y alergias" icono="auditoria">
        <KeyValue items={[['Antecedentes médicos', p.antecedentes.medicos], ['Alergias', p.antecedentes.alergias], ['Medicamentos que utiliza', p.antecedentes.medicamentos]]} />
      </Card>}
      {p.atencion_inicial && <Card titulo="Información odontológica inicial" icono="diente">
        <KeyValue items={[['Motivo de la primera atención', p.atencion_inicial.motivo], ['Última atención', p.atencion_inicial.ultima_atencion ? fecha(p.atencion_inicial.ultima_atencion) : null], ['Observaciones', p.atencion_inicial.observaciones]]} />
      </Card>}
    </div>
  );
}

// Cada consulta con su evaluación, diagnósticos, tratamientos y recetas; se pueden agregar más.
function Consultas({ paciente: p, editable, recargar }) {
  const { enlace } = useModulo();
  const [dialogo, setDialogo] = useState(null);
  if (!p.consultas.length) {
    return <EmptyState icono="diente" titulo="Sin consultas registradas"
      accion={editable && <Link className="btn btn-primary" to={enlace(`/pacientes/${p.id_paciente}/consultas/nueva`)}>Registrar la primera consulta</Link>} />;
  }
  return <div className="stack">
    {p.consultas.map(c => (
      <Card key={c.id_consulta} titulo={`${fechaHora(c.fecha_hora)} · ${c.motivo}`} descripcion={`Atendió: ${c.odontologo}`}
        acciones={editable && <>
          <button type="button" className="btn btn-sm" onClick={() => setDialogo({ tipo: 'diagnostico', consulta: c })}>+ Diagnóstico</button>
          <button type="button" className="btn btn-sm" onClick={() => setDialogo({ tipo: 'tratamiento', consulta: c })}>+ Tratamiento</button>
          <button type="button" className="btn btn-sm" onClick={() => setDialogo({ tipo: 'receta', consulta: c })}>+ Receta</button>
        </>}>
        <KeyValue items={[['Antecedentes de la atención', c.evaluacion?.antecedentes], ['Examen bucal', c.evaluacion?.examen_bucal], ['Hallazgos', c.evaluacion?.hallazgos]]} />
        <h3 className="mt-4">Diagnósticos</h3>
        {c.diagnosticos.length ? <ul>{c.diagnosticos.map((d, i) => <li key={i}><code>{d.codigo}</code> {d.descripcion}{d.pieza && ` · pieza ${d.pieza}`}</li>)}</ul> : <p className="meta">Sin diagnósticos.</p>}
        <h3 className="mt-4">Tratamientos</h3>
        {c.tratamientos.length ? <ul>{c.tratamientos.map(t => <li key={t.id_tratamiento}><b>{t.procedimiento}</b>{t.pieza ? ` · pieza ${t.pieza}` : ''}{t.descripcion && ` — ${t.descripcion}`}{t.recomendaciones && <div className="meta">Recomendaciones: {t.recomendaciones}</div>}</li>)}</ul> : <p className="meta">Sin tratamientos.</p>}
        <h3 className="mt-4">Recetas</h3>
        {c.prescripciones.length ? c.prescripciones.map(rx => <div key={rx.id_prescripcion} className="sub-item">
          <ul>{rx.medicamentos.map((m, i) => <li key={i}><b>{m.nombre}</b> {m.dosis}, {m.frecuencia}, {m.duracion} ({m.via_administracion})</li>)}</ul>
          {rx.indicaciones_generales && <p className="meta">Indicaciones: {rx.indicaciones_generales}</p>}
        </div>) : <p className="meta">Sin recetas.</p>}
      </Card>
    ))}
    {dialogo && <DialogoAgregar {...dialogo} paciente={p} onCerrar={() => setDialogo(null)} onHecho={() => { setDialogo(null); recargar(); }} />}
  </div>;
}

const MEDICAMENTO = { nombre: '', dosis: '', frecuencia: '', duracion: '', via_administracion: 'Oral' };

function DialogoAgregar({ tipo, consulta, paciente, onCerrar, onHecho }) {
  const { api } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const procs = useCarga(() => (tipo === 'tratamiento' ? api.catalogos.procedimientos() : Promise.resolve([])), [api, tipo]);
  const [d, setD] = useState({ codigo: '', descripcion: '', pieza: '', id_procedimiento: '', procedimiento: '', recomendaciones: '', indicaciones_generales: '', medicamento: MEDICAMENTO });
  const campo = (k, props = {}) => a => <input {...a} {...props} value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })} />;
  const med = k => a => <input {...a} value={d.medicamento[k]} onChange={e => setD({ ...d, medicamento: { ...d.medicamento, [k]: e.target.value } })} />;
  const v = x => x.trim() || null;
  const titulos = { diagnostico: 'Agregar diagnóstico', tratamiento: 'Agregar tratamiento', receta: 'Agregar receta' };

  async function enviar(e) {
    e.preventDefault();
    const [idP, idC] = [paciente.id_paciente, consulta.id_consulta];
    const r = await envio.enviar(() => (tipo === 'diagnostico'
      ? api.consultas.agregarDiagnostico(idP, idC, { codigo: d.codigo.trim(), descripcion: d.descripcion.trim(), pieza: v(d.pieza) })
      : tipo === 'tratamiento'
        ? api.consultas.agregarTratamiento(idP, idC, { pieza: v(d.pieza), id_procedimiento: v(d.id_procedimiento), procedimiento: d.id_procedimiento ? null : v(d.procedimiento), descripcion: v(d.descripcion), recomendaciones: v(d.recomendaciones) })
        : api.consultas.agregarPrescripcion(idP, idC, { indicaciones_generales: v(d.indicaciones_generales), medicamentos: [Object.fromEntries(Object.entries(d.medicamento).map(([k, x]) => [k, x.trim()]))] })));
    if (r) { notificar({ diagnostico: 'Diagnóstico agregado', tratamiento: 'Tratamiento agregado', receta: 'Receta agregada' }[tipo]); onHecho(); }
  }

  return <Dialogo abierto ancho titulo={titulos[tipo]} descripcion={`Consulta del ${fechaHora(consulta.fecha_hora)}`} onCerrar={onCerrar}>
    <form onSubmit={enviar} className="stack">
      {envio.error && <Alerta>{envio.error.message}</Alerta>}
      <div className="form-grid">
        {tipo === 'diagnostico' && <>
          <FormField label="Código" required hint="Por ejemplo, K02.1">{campo('codigo', { maxLength: 20 })}</FormField>
          <FormField label="Pieza (FDI)" hint="Opcional, por ejemplo 36">{campo('pieza', { maxLength: 2, inputMode: 'numeric' })}</FormField>
          <FormField label="Descripción" required full>{campo('descripcion', { maxLength: 300 })}</FormField>
        </>}
        {tipo === 'tratamiento' && <>
          <FormField label="Procedimiento del catálogo">{a => (
            <select {...a} value={d.id_procedimiento} onChange={e => setD({ ...d, id_procedimiento: e.target.value })}>
              <option value="">Otro (escribirlo)</option>
              {(procs.datos || []).map(x => <option key={x.id_procedimiento} value={x.id_procedimiento}>{x.codigo} · {x.nombre}</option>)}
            </select>)}</FormField>
          {!d.id_procedimiento && <FormField label="Procedimiento" required>{campo('procedimiento', { maxLength: 150 })}</FormField>}
          <FormField label="Pieza (FDI)" hint="Vacío si es general">{campo('pieza', { maxLength: 2, inputMode: 'numeric' })}</FormField>
          <FormField label="Descripción" full>{campo('descripcion', { maxLength: 1000 })}</FormField>
          <FormField label="Recomendaciones" full>{campo('recomendaciones', { maxLength: 1000 })}</FormField>
        </>}
        {tipo === 'receta' && <>
          <FormField label="Medicamento" required>{med('nombre')}</FormField>
          <FormField label="Dosis" required>{med('dosis')}</FormField>
          <FormField label="Frecuencia" required>{med('frecuencia')}</FormField>
          <FormField label="Duración" required>{med('duracion')}</FormField>
          <FormField label="Vía de administración" required>{med('via_administracion')}</FormField>
          <FormField label="Indicaciones generales" full>{campo('indicaciones_generales', { maxLength: 1000 })}</FormField>
        </>}
      </div>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
        <BotonEnviar enviando={envio.enviando}>Guardar</BotonEnviar>
      </div>
    </form>
  </Dialogo>;
}
