import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, EmptyState, ErrorState, FormField, FormSteps, FormSummary, LoadingState, PageHeader, SearchBar, SectionHeading, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { aIso, localAhora } from '@plataforma/formato.js';

// Registrar consulta (regla común) = crear una solicitud con uno o varios exámenes del catálogo.
export default function NuevaSolicitud() {
  const { api, enlace } = useModulo();
  const [params, setParams] = useSearchParams();
  const idPaciente = params.get('paciente');
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const paciente = useCarga(() => (idPaciente ? api.pacientes.administrativo(idPaciente) : Promise.resolve(null)), [api, idPaciente]);
  const catalogo = useCarga(() => Promise.all([api.catalogos.tiposExamen(), api.catalogos.medicos()]), [api]);
  const [s, setS] = useState({ id_medico: '', institucion_remitente: '', fecha_solicitud: localAhora(), prioridad: 'Rutina', motivo: '', indicaciones: '', observaciones: '' });
  // Exámenes elegidos: { [id_tipo_examen]: { codigo_muestra, fecha_toma_muestra } }
  const [examenes, setExamenes] = useState({});
  const [error, setError] = useState('');
  const texto = clave => a => <input {...a} value={s[clave]} onChange={e => setS({ ...s, [clave]: e.target.value })} />;
  const area = clave => a => <textarea {...a} rows={2} maxLength={500} value={s[clave]} onChange={e => setS({ ...s, [clave]: e.target.value })} />;

  if (catalogo.cargando || paciente.cargando) return <LoadingState />;
  const [tipos, medicos] = catalogo.datos || [[], []];
  const activos = tipos.filter(t => t.activo);
  const p = paciente.datos;
  const elegidos = Object.keys(examenes);

  async function enviar(e) {
    e.preventDefault();
    if (!elegidos.length) return setError('Seleccione al menos un examen');
    setError('');
    const vacio = v => v.trim() || null;
    const r = await envio.enviar(() => api.solicitudes.crear(p.id_paciente, {
      id_medico: s.id_medico || null, institucion_remitente: vacio(s.institucion_remitente),
      fecha_solicitud: aIso(s.fecha_solicitud), prioridad: s.prioridad,
      motivo: vacio(s.motivo), indicaciones: vacio(s.indicaciones), observaciones: vacio(s.observaciones),
      examenes: elegidos.map(id => ({
        id_tipo_examen: id, codigo_muestra: vacio(examenes[id].codigo_muestra), fecha_toma_muestra: aIso(examenes[id].fecha_toma_muestra) || null
      }))
    }));
    if (r) { notificar(`Solicitud ${r.id_solicitud} registrada`); navegar(enlace(`/solicitudes/${r.id_solicitud}`)); }
  }

  const alternar = id => setExamenes(x => {
    const { [id]: quitado, ...resto } = x;
    return quitado ? resto : { ...x, [id]: { codigo_muestra: '', fecha_toma_muestra: '' } };
  });
  const cambiarExamen = (id, campo, valor) => setExamenes(x => ({ ...x, [id]: { ...x[id], [campo]: valor } }));

  return (
    <>
      <PageHeader titulo="Nueva solicitud de exámenes" descripcion="Paciente, exámenes del catálogo, muestra e indicaciones."
        acciones={<Link className="btn" to={enlace(p ? `/pacientes/${p.id_paciente}` : '/solicitudes')}>Cancelar</Link>} />
      <ErrorState error={paciente.error || catalogo.error} onReintentar={() => { paciente.recargar(); catalogo.recargar(); }} />
      {!p ? <ElegirPaciente onElegir={id => setParams({ paciente: id })} /> : <>
        <FormSteps pasos={[
          { id: 'sol-origen', titulo: 'Origen', completo: true },
          { id: 'sol-examenes', titulo: 'Exámenes', completo: elegidos.length > 0 },
          { id: 'sol-notas', titulo: 'Indicaciones', completo: Boolean(s.indicaciones.trim() || s.observaciones.trim()) }
        ]} />
        <form onSubmit={enviar} noValidate>
          {(error || envio.error) && <Alerta titulo="No se pudo registrar">{error || envio.error.message}</Alerta>}
          {p.estado_historial !== 'Activo' && <Alerta tipo="warn" titulo="Historial archivado">No admite solicitudes nuevas.</Alerta>}
          <div className="form-layout">
            <div className="form-body">
              <Card id="sol-origen">
                <SectionHeading numero="1" titulo="Origen de la solicitud" />
                <div className="form-grid">
                  <FormField label="Médico solicitante" hint={medicos.length ? undefined : 'Sin médicos en el catálogo'}>{a => (
                    <select {...a} value={s.id_medico} onChange={e => setS({ ...s, id_medico: e.target.value })}>
                      <option value="">Sin médico registrado</option>
                      {medicos.map(m => <option key={m.id_medico} value={m.id_medico}>{m.nombre_completo} ({m.numero_colegiado})</option>)}
                    </select>)}</FormField>
                  <FormField label="Institución remitente">{texto('institucion_remitente')}</FormField>
                  <FormField label="Fecha de solicitud" required>{a => <input {...a} type="datetime-local" max={localAhora(5)} value={s.fecha_solicitud} onChange={e => setS({ ...s, fecha_solicitud: e.target.value })} />}</FormField>
                  <FormField label="Prioridad">{a => (
                    <select {...a} value={s.prioridad} onChange={e => setS({ ...s, prioridad: e.target.value })}>
                      <option>Rutina</option><option>Urgente</option>
                    </select>)}</FormField>
                  <FormField label="Motivo de la solicitud" full>{area('motivo')}</FormField>
                </div>
              </Card>
              <Card id="sol-examenes">
                <SectionHeading numero="2" titulo="Exámenes solicitados" descripcion="Marque los exámenes; el código y la toma de muestra son opcionales." />
                {activos.length === 0
                  ? <EmptyState icono="matraz" titulo="No hay tipos de examen en el catálogo">La administración debe registrarlos en Catálogos.</EmptyState>
                  : <div className="sub-list">{activos.map(t => (
                    <div className="sub-item" key={t.id_tipo_examen}>
                      <label className="check"><input type="checkbox" checked={Boolean(examenes[t.id_tipo_examen])} onChange={() => alternar(t.id_tipo_examen)} />
                        {t.nombre} <span className="meta">· {t.categoria} · {t.tipo_muestra} · {t.tiempo_entrega_horas} h</span></label>
                      {examenes[t.id_tipo_examen] && <div className="form-grid mt-2">
                        <FormField label="Código de muestra">{a => <input {...a} maxLength={30} value={examenes[t.id_tipo_examen].codigo_muestra} onChange={e => cambiarExamen(t.id_tipo_examen, 'codigo_muestra', e.target.value)} />}</FormField>
                        <FormField label="Fecha y hora de toma">{a => <input {...a} type="datetime-local" max={localAhora(5)} value={examenes[t.id_tipo_examen].fecha_toma_muestra} onChange={e => cambiarExamen(t.id_tipo_examen, 'fecha_toma_muestra', e.target.value)} />}</FormField>
                      </div>}
                    </div>))}
                  </div>}
              </Card>
              <Card id="sol-notas">
                <SectionHeading numero="3" titulo="Indicaciones y observaciones" />
                <div className="form-grid">
                  <FormField label="Indicaciones de preparación registradas" full>{area('indicaciones')}</FormField>
                  <FormField label="Observaciones de la solicitud" full>{area('observaciones')}</FormField>
                </div>
              </Card>
            </div>
            <div className="form-side">
              <FormSummary titulo="Solicitud nueva" items={[
                ['Paciente', `${p.nombres} ${p.apellidos}`], ['Expediente', p.id_paciente],
                ['Exámenes', elegidos.length ? activos.filter(t => examenes[t.id_tipo_examen]).map(t => t.nombre).join(', ') : '—'],
                ['Prioridad', s.prioridad]
              ]}>
                <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Guardar solicitud</BotonEnviar>
                <button type="button" className="btn btn-block" onClick={() => setParams({})}>Cambiar paciente</button>
              </FormSummary>
            </div>
          </div>
        </form>
      </>}
    </>
  );
}

// Sin ?paciente= en la ruta: buscar y elegir un paciente activo.
function ElegirPaciente({ onElegir }) {
  const { api } = useModulo();
  const [q, setQ] = useState('');
  const lista = useCarga(() => (q.trim().length >= 2 ? api.pacientes.listar({ q: q.trim(), limite: 10 }) : Promise.resolve(null)), [api, q]);
  return (
    <Card titulo="Paciente" icono="pacientes" descripcion="Busque al paciente; si no existe, regístrelo primero.">
      <SearchBar label="Buscar paciente" value={q} onChange={setQ} placeholder="Nombre, apellido o documento (mínimo 2 caracteres)" />
      <ErrorState error={lista.error} onReintentar={lista.recargar} />
      {lista.datos && (lista.datos.items.length === 0 ? <EmptyState titulo="Sin resultados" /> : (
        <ul className="sub-list mt-4">{lista.datos.items.map(p => (
          <li className="sub-item" key={p.id_paciente}>
            <button type="button" className="btn btn-block" onClick={() => onElegir(p.id_paciente)}>{p.apellidos}, {p.nombres} · expediente {p.id_paciente}</button>
          </li>))}
        </ul>))}
    </Card>
  );
}
