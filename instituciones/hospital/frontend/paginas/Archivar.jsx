import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, DataTable, ErrorState, FormField, Icon, LoadingState, PageHeader, SectionHeading, useCarga, useConfirmar, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';

const MOTIVOS = [
  ['Traslado', 'Continuará su atención en otra institución.'],
  ['Fallecimiento', 'Requiere el número de certificado de defunción.'],
  ['Causa administrativa', 'Duplicado, solicitud del paciente u otra causa.']
];

export default function Archivar() {
  const { id } = useParams();
  const { api } = useSesion();
  const { enlace } = useModulo();
  const navegar = useNavigate();
  const confirmar = useConfirmar();
  const notificar = useNotificar();
  const envio = useEnvio();
  const datos = useCarga(() => Promise.all([api.pacientes.obtener(id), api.pacientes.impactoArchivado(id)]), [api, id]);
  const [motivo, setMotivo] = useState('Traslado');
  const [f, setF] = useState({ fecha_traslado: '', institucion_destino: '', numero_certificado_defuncion: '', observaciones: '' });
  const [cancelarCitas, setCancelarCitas] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [errores, setErrores] = useState({});

  if (datos.cargando) return <LoadingState texto="Cargando el expediente…" />;
  if (datos.error) return <ErrorState error={datos.error} onReintentar={datos.recargar} />;

  const [expediente, impacto] = datos.datos;
  const paciente = expediente.paciente;
  const citas = impacto.citas_futuras || [];

  function validar() {
    const e = {};
    if (motivo === 'Traslado' && !f.institucion_destino.trim()) e.institucion_destino = 'Indique la institución de destino';
    if (motivo === 'Fallecimiento' && !f.numero_certificado_defuncion.trim()) e.numero_certificado_defuncion = 'Indique el número de certificado';
    if (citas.length && !cancelarCitas) e.citas = 'Debe confirmar la cancelación de las citas futuras';
    if (!confirmado) e.confirmado = 'Confirme que los datos de la baja son correctos';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const ok = await confirmar({
      titulo: 'Confirmar archivo',
      peligro: true,
      confirmar: 'Archivar',
      mensaje: `El historial de ${paciente.primer_nombre} ${paciente.primer_apellido} pasará a estado Archivado. No se elimina información, pero ya no admitirá nuevas atenciones.`
    });
    if (!ok) return;
    const cuerpo = { motivo_archivado: motivo, observaciones: f.observaciones.trim(), cancelar_citas: cancelarCitas };
    if (motivo === 'Traslado') {
      cuerpo.institucion_destino = f.institucion_destino.trim();
      if (f.fecha_traslado) cuerpo.fecha_traslado = f.fecha_traslado;
    }
    if (motivo === 'Fallecimiento') cuerpo.numero_certificado_defuncion = f.numero_certificado_defuncion.trim();
    const r = await envio.enviar(() => api.pacientes.archivar(id, cuerpo));
    if (r) { notificar('Historial archivado'); navegar(enlace(`/pacientes/${id}`)); }
  }

  const volver = enlace(`/pacientes/${id}`);

  return (
    <>
      <PageHeader titulo="Archivar historial clínico" descripcion="Baja del expediente con conservación de su información."
        acciones={<Link className="btn" to={volver}>Volver al historial</Link>} />
      <div className="page-meta"><b>{paciente.primer_nombre} {paciente.segundo_nombre} {paciente.primer_apellido} {paciente.segundo_apellido}</b><code>{paciente.numero_expediente}</code></div>
      <Alerta tipo="info">El historial no se elimina: quedará archivado en solo lectura. La información clínica se conserva completa.</Alerta>
      {impacto.hospitalizacion_activa && <Alerta tipo="warn" titulo="Hospitalización activa">Registre primero el egreso del paciente desde la sección Hospitalización.</Alerta>}
      <form onSubmit={enviar} noValidate>
        {envio.error && <Alerta titulo="No se pudo archivar">{envio.error.message}</Alerta>}
        {Object.keys(errores).length > 0 && <Alerta>Revise los campos marcados.</Alerta>}
        <div className="form-layout">
          <div className="form-body">
            <Card>
              <SectionHeading numero="1" titulo="Motivo de la baja" descripcion="Seleccione la causa del archivo." />
              <div className="archive-reasons">
                {MOTIVOS.map(([valor, texto]) => (
                  <label className="archive-reason" key={valor}>
                    <input type="radio" name="motivo" value={valor} checked={motivo === valor} onChange={() => setMotivo(valor)} />
                    <span><b>{valor}</b><small>{texto}</small></span>
                  </label>
                ))}
              </div>
              <div className="form-grid mt-4">
                {motivo === 'Traslado' && <>
                  <FormField label="Fecha de traslado">{a => <input {...a} type="date" value={f.fecha_traslado} onChange={e => setF({ ...f, fecha_traslado: e.target.value })} />}</FormField>
                  <FormField label="Institución de destino" error={errores.institucion_destino} required>{a => <input {...a} value={f.institucion_destino} onChange={e => setF({ ...f, institucion_destino: e.target.value })} maxLength={150} />}</FormField>
                </>}
                {motivo === 'Fallecimiento' && <FormField label="Número de certificado de defunción" error={errores.numero_certificado_defuncion} required>{a => <input {...a} value={f.numero_certificado_defuncion} onChange={e => setF({ ...f, numero_certificado_defuncion: e.target.value })} maxLength={40} />}</FormField>}
                <FormField label="Observaciones" full>{a => <textarea {...a} rows={3} value={f.observaciones} onChange={e => setF({ ...f, observaciones: e.target.value })} maxLength={255} />}</FormField>
              </div>
            </Card>

            <Card titulo="Impacto del archivado" icono="archivo">
              <div className="archive-effects">
                <div><Icon name="calendario" /><b>Citas futuras</b><p>{citas.length ? `${citas.length} cita(s) deben cancelarse.` : 'No hay citas futuras.'}</p></div>
                <div><Icon name="hospital" /><b>Hospitalización</b><p>{impacto.hospitalizacion_activa ? 'Hay un ingreso activo que impide archivar.' : 'Sin hospitalización activa.'}</p></div>
                <div><Icon name="auditoria" /><b>Bitácora</b><p>La acción quedará registrada con su usuario.</p></div>
              </div>
              {citas.length > 0 && <DataTable titulo="Citas futuras" claveFila={c => c.id_cita} filas={citas} columnas={[
                { clave: 'id_cita', titulo: 'Cita' },
                { clave: 'fecha_hora_cita', titulo: 'Fecha y hora', render: c => fechaHora(c.fecha_hora_cita) },
                { clave: 'id_medico', titulo: 'Médico' }
              ]} />}
              {citas.length > 0 && <label className="check mt-4"><input type="checkbox" checked={cancelarCitas} onChange={e => setCancelarCitas(e.target.checked)} /> <b>Cancelar las citas futuras al archivar</b></label>}
              {errores.citas && <span className="error">{errores.citas}</span>}
              <label className="check mt-4"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} /> <b>Confirmo que los datos de la baja son correctos.</b></label>
              {errores.confirmado && <span className="error">{errores.confirmado}</span>}
            </Card>
          </div>

          <div className="form-side">
            <Card titulo="Resumen del archivo">
              <dl className="kv">
                <div><dt>Paciente</dt><dd>{paciente.primer_nombre} {paciente.primer_apellido}</dd></div>
                <div><dt>Expediente</dt><dd><code>{paciente.numero_expediente}</code></dd></div>
                <div><dt>Motivo</dt><dd>{motivo}</dd></div>
                <div><dt>Citas a cancelar</dt><dd>{cancelarCitas ? citas.length : 0}</dd></div>
              </dl>
              <BotonEnviar enviando={envio.enviando} className="btn btn-danger btn-block" disabled={impacto.hospitalizacion_activa}>Archivar historial</BotonEnviar>
              <Link className="btn btn-block" to={volver}>Cancelar</Link>
            </Card>
          </div>
        </div>
      </form>
    </>
  );
}
