import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, ErrorState, FormField, Icon, LoadingState, PageHeader, SectionHeading, useCarga, useConfirmar, useEnvio, useNotificar } from '@plataforma/ui/index.js';

const MOTIVOS = [
  ['Traslado a otra institución', 'Continuará su atención en otra institución.'],
  ['Fallecimiento', 'Se conserva la información del paciente.'],
  ['Otra causa administrativa', 'Indique el detalle de la causa administrativa.']
];

// Baja del paciente: el historial no se elimina, queda en solo lectura con su motivo.
export default function Archivar() {
  const { id } = useParams();
  const { api, enlace } = useModulo();
  const navegar = useNavigate();
  const confirmar = useConfirmar();
  const notificar = useNotificar();
  const envio = useEnvio();
  const pac = useCarga(() => api.pacientes.administrativo(id), [api, id]);
  const [motivo, setMotivo] = useState('');
  const [otro, setOtro] = useState('');
  const volver = enlace(`/pacientes/${encodeURIComponent(id)}`);
  // Se conserva la categoría de baja junto al detalle.
  const texto = motivo === 'Otra causa administrativa' ? (otro.trim() && `Otra causa administrativa: ${otro.trim()}`) : motivo;

  if (pac.cargando) return <LoadingState texto="Cargando expediente…" />;
  if (pac.error) return <><ErrorState error={pac.error} onReintentar={pac.recargar} /><Link className="btn" to={enlace('/pacientes')}>Volver a pacientes</Link></>;
  const p = pac.datos;

  async function enviar(e) {
    e.preventDefault();
    if (!texto) return envio.setError(new Error('Indique el motivo de la baja'));
    const ok = await confirmar({
      titulo: 'Confirmar archivo', peligro: true, confirmar: 'Archivar',
      mensaje: `El historial de ${p.nombres} ${p.apellidos} pasará a estado Archivado. No se elimina información, pero ya no admitirá consultas, citas ni cambios en el odontograma.`
    });
    if (!ok) return;
    const r = await envio.enviar(() => api.pacientes.archivar(id, texto));
    if (r) { notificar('Historial archivado'); navegar(volver); }
  }

  return (
    <>
      <PageHeader titulo="Archivar historial clínico" descripcion={`${p.nombres} ${p.apellidos} · expediente ${p.id_paciente}`}
        acciones={<Link className="btn" to={volver}>Volver</Link>} />
      {p.estado_historial !== 'Activo'
        ? <Alerta tipo="info" titulo="Historial ya archivado">Motivo registrado: {p.motivo_archivado}</Alerta>
        : <form onSubmit={enviar} noValidate>
          {envio.error && <Alerta>{envio.error.message}</Alerta>}
          <Card>
            <SectionHeading numero="1" titulo="Motivo de la baja" descripcion="El motivo queda guardado en el expediente y en la bitácora." />
            <fieldset className="fieldset-plain">
              <legend className="sr-only">Motivo de la baja</legend>
              <div className="archive-reasons">
                {MOTIVOS.map(([valor, descripcion]) => <label className="archive-reason" key={valor}>
                  <input type="radio" name="motivo-archivo" value={valor} checked={motivo === valor} onChange={() => setMotivo(valor)} required />
                  <span><b>{valor}</b><small>{descripcion}</small></span>
                </label>)}
              </div>
            </fieldset>
            {motivo === 'Otra causa administrativa' && (
              <FormField label="Detalle del motivo" required>{a => <input {...a} value={otro} onChange={e => setOtro(e.target.value)} maxLength={250} />}</FormField>
            )}
          </Card>
          <Card>
            <SectionHeading numero="2" titulo="Confirmación" />
            <div className="archive-effects">
              <div><Icon name="archivo" /><b>Solo lectura</b><p>No admitirá consultas, citas ni cambios en el odontograma.</p></div>
              <div><Icon name="pacientes" /><b>Historial completo</b><p>Se conservan consultas, tratamientos, recetas y odontograma.</p></div>
              <div><Icon name="auditoria" /><b>Auditoría</b><p>La acción se registra con tu usuario.</p></div>
            </div>
            <div className="form-actions">
              <Link className="btn" to={volver}>Cancelar</Link>
              <BotonEnviar enviando={envio.enviando} className="btn btn-danger solid">Archivar historial…</BotonEnviar>
            </div>
          </Card>
        </form>}
    </>
  );
}
