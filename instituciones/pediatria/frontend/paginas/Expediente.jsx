import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, Dialogo, ErrorState, FormField, Icon, LoadingState, StatusBadge, Tabs, useCarga, useConfirmar, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import Resumen from './expediente/Resumen.jsx';
import Consultas from './expediente/Consultas.jsx';
import Prescripciones from './expediente/Prescripciones.jsx';
import Crecimiento from './expediente/Crecimiento.jsx';
import VacunacionPaciente from './expediente/VacunacionPaciente.jsx';
import AuditoriaPaciente from './expediente/AuditoriaPaciente.jsx';
import { edad, fecha, fechaHora, fechaLocal } from '@plataforma/formato.js';

// Pestañas del expediente y permiso que requiere cada una (el backend vuelve a verificarlo).
const PESTANAS = [
  { clave: 'resumen', titulo: 'Datos generales y tutores' },
  { clave: 'consultas', titulo: 'Consultas', permiso: 'historial.leer', cuenta: p => p.consultas?.length },
  { clave: 'prescripciones', titulo: 'Prescripciones', permiso: 'historial.leer' },
  { clave: 'crecimiento', titulo: 'Crecimiento', permiso: 'historial.leer', cuenta: p => p.controles_crecimiento?.length },
  { clave: 'vacunacion', titulo: 'Vacunación', permiso: 'historial.leer', cuenta: p => p.esquema_vacunacion?.filter(d => d.estado === 'Pendiente').length },
  { clave: 'auditoria', titulo: 'Auditoría', permiso: 'auditoria.leer' }
];

export default function Expediente() {
  const { id, seccion = 'resumen' } = useParams();
  const { api, puede } = useSesion();
  const navegar = useNavigate();
  const clinico = puede('historial.leer');
  const pac = useCarga(() => (clinico ? api.pacientes.obtener(id) : api.pacientes.administrativo(id)), [api, id, clinico]);
  const cat = useCarga(() => (clinico ? Promise.all([api.catalogos.medicos(), api.catalogos.vacunas()]) : Promise.resolve([[], []])), [api, clinico]);
  const [archivando, setArchivando] = useState(false);

  if (pac.cargando && !pac.datos) return <LoadingState texto="Cargando expediente…" />;
  if (pac.error) {
    return <>
      <ErrorState error={pac.error} onReintentar={pac.recargar} />
      <Link className="btn" to="/pacientes">Volver a pacientes</Link>
    </>;
  }
  const p = pac.datos;
  const activo = p.estado_historial === 'Activo';
  const pestanas = PESTANAS.filter(t => puede(t.permiso)).map(t => ({ ...t, cuenta: t.cuenta ? t.cuenta(p) : undefined }));
  const actual = pestanas.some(t => t.clave === seccion) ? seccion : 'resumen';
  const ctx = {
    paciente: p, recargar: pac.recargar, editable: activo,
    medicos: cat.datos?.[0] || [], vacunas: cat.datos?.[1] || []
  };

  return (
    <>
      <section className="card patient-header" aria-labelledby="titulo-paciente">
        <div className="patient-main">
          <div className="patient-id">
            <div className="avatar" aria-hidden="true">{p.nombres[0]}{p.apellidos[0]}</div>
            <div>
              <h1 id="titulo-paciente">{p.nombres} {p.apellidos}</h1>
              <div className="page-meta">
                <code>{p.id_paciente}</code>
                <span>{p.sexo === 'F' ? 'Femenino' : 'Masculino'}</span>
                <span aria-hidden="true">·</span>
                <span>{edad(p.fecha_nacimiento)}</span>
                <span aria-hidden="true">·</span>
                <span>Nacimiento {fecha(p.fecha_nacimiento)}</span>
                <StatusBadge>{p.estado_historial}</StatusBadge>
              </div>
            </div>
          </div>
          <div className="actions">
            {activo && puede('clinico.escribir') && <Link className="btn btn-primary" to={`/pacientes/${id}/consultas/nueva`}><Icon name="mas" size={16} />Nueva consulta</Link>}
            {activo && puede('historial.archivar') && <button type="button" className="btn btn-danger" onClick={() => setArchivando(true)}><Icon name="archivo" size={16} />Archivar historial</button>}
          </div>
        </div>
        <DatosClave paciente={p} />
      </section>
      {!activo && (
        <div className="archived-banner" role="status">
          <Icon name="archivo" />
          <span>Historial archivado el {fechaHora(p.fecha_archivado)} — motivo: {p.motivo_archivado || 'no indicado'}. Se conserva completo en modo de solo lectura.</span>
        </div>
      )}
      {cat.error && <ErrorState error={cat.error} onReintentar={cat.recargar} />}
      {pestanas.length > 1 && (
        <Tabs etiqueta="Secciones del expediente" actual={actual} pestanas={pestanas}
          onCambiar={k => navegar(k === 'resumen' ? `/pacientes/${id}` : `/pacientes/${id}/${k}`)} />
      )}
      <div role="tabpanel" aria-label={pestanas.find(t => t.clave === actual)?.titulo}>
        {actual === 'resumen' && <Resumen {...ctx} />}
        {actual === 'consultas' && <Consultas {...ctx} />}
        {actual === 'prescripciones' && <Prescripciones {...ctx} />}
        {actual === 'crecimiento' && <Crecimiento {...ctx} />}
        {actual === 'vacunacion' && <VacunacionPaciente {...ctx} />}
        {actual === 'auditoria' && <AuditoriaPaciente {...ctx} />}
      </div>
      <DialogoArchivar abierto={archivando} paciente={p} onCerrar={() => setArchivando(false)} onHecho={() => { setArchivando(false); pac.recargar(); }} />
    </>
  );
}

// Franja de datos clave bajo el nombre: lo que se consulta primero al abrir el expediente.
// Secretaría recibe la proyección administrativa (sin arreglos clínicos): solo ve tutor y registro.
function DatosClave({ paciente: p }) {
  const tutor = (p.tutores || []).find(t => t.es_principal) || p.tutores?.[0];
  const clinico = Array.isArray(p.consultas);
  const reciente = (xs, campo) => [...(xs || [])].sort((a, b) => new Date(b[campo]) - new Date(a[campo]))[0];
  const consulta = clinico ? reciente(p.consultas, 'fecha_hora') : null;
  const control = clinico ? reciente(p.controles_crecimiento, 'fecha') : null;
  const pendientes = clinico ? p.esquema_vacunacion.filter(d => d.estado === 'Pendiente').length : 0;
  return (
    <dl className="patient-facts">
      <div><dt>Tutor principal</dt><dd>{tutor ? <>{tutor.nombres} {tutor.apellidos}<small>{tutor.parentesco}{tutor.telefono ? ` · ${tutor.telefono}` : ''}</small></> : '—'}</dd></div>
      {clinico && <>
        <div><dt>Última consulta</dt><dd>{consulta ? <>{fechaLocal(consulta.fecha_hora)}<small>{consulta.motivo}</small></> : 'Sin consultas'}</dd></div>
        <div><dt>Último control</dt><dd>{control ? <>{control.peso_kg} kg · {control.talla_cm} cm<small>{fechaLocal(control.fecha)}</small></> : 'Sin mediciones'}</dd></div>
        <div><dt>Vacunación</dt><dd>{pendientes ? `${pendientes} ${pendientes === 1 ? 'dosis pendiente' : 'dosis pendientes'}` : 'Sin dosis pendientes'}<small>{p.esquema_vacunacion.filter(d => d.estado === 'Aplicada').length} aplicadas</small></dd></div>
      </>}
      <div><dt>Registro</dt><dd>{p.fecha_registro ? fechaLocal(p.fecha_registro) : 'Antes de Fase II'}{p.registrado_por && <small>por {p.registrado_por.id_usuario}</small>}</dd></div>
    </dl>
  );
}

function DialogoArchivar({ abierto, paciente, onCerrar, onHecho }) {
  const { api } = useSesion();
  const confirmar = useConfirmar();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [motivo, setMotivo] = useState('');
  const [otro, setOtro] = useState('');
  // Se conserva la categoría de baja junto al detalle (traslado, fallecimiento u otra causa).
  const texto = motivo === 'Otra causa administrativa' ? (otro.trim() && `Otra causa administrativa: ${otro.trim()}`) : motivo;

  async function enviar(e) {
    e.preventDefault();
    if (!texto) return envio.setError(new Error('Indique el motivo del archivo'));
    const ok = await confirmar({
      titulo: 'Confirmar archivo', peligro: true, confirmar: 'Archivar',
      mensaje: `El historial de ${paciente.nombres} ${paciente.apellidos} pasará a estado Archivado. No se elimina información, pero ya no admitirá nuevas consultas, controles ni vacunas.`
    });
    if (!ok) return;
    const r = await envio.enviar(() => api.pacientes.archivar(paciente.id_paciente, texto));
    if (r) { notificar('Historial archivado'); setMotivo(''); setOtro(''); onHecho(); }
  }

  return (
    <Dialogo abierto={abierto} titulo="Archivar historial" descripcion="Baja administrativa del paciente. Solo la administración puede consultar historiales archivados." onCerrar={onCerrar}>
      <form onSubmit={enviar} className="stack">
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        <FormField label="Motivo" required>
          {a => <select {...a} value={motivo} onChange={e => setMotivo(e.target.value)}>
            <option value="">Seleccione…</option>
            <option>Traslado a otra institución</option>
            <option>Fallecimiento</option>
            <option>Otra causa administrativa</option>
          </select>}
        </FormField>
        {motivo === 'Otra causa administrativa' && (
          <FormField label="Detalle del motivo" required>{a => <input {...a} value={otro} onChange={e => setOtro(e.target.value)} maxLength={200} />}</FormField>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <BotonEnviar enviando={envio.enviando} className="btn btn-danger solid">Archivar…</BotonEnviar>
        </div>
      </form>
    </Dialogo>
  );
}
