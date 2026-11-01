import { Link, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, Card, FormField, FormularioVistaPrevia, Icon, PageHeader, PendienteIntegracion } from '@plataforma/ui/index.js';

const MOTIVOS = [
  ['Traslado', 'Continuará su atención en otra institución.'],
  ['Fallecimiento', 'Requiere el número de certificado de defunción.'],
  ['Causa administrativa', 'Duplicado, solicitud del paciente u otra causa.']
];

export default function Archivar() {
  const { id } = useParams();
  const { enlace } = useModulo();
  return <>
    <PageHeader titulo="Archivar historial clínico" descripcion="Baja del expediente con conservación de su información." />
    <PendienteIntegracion compacto />
    <Alerta tipo="info">El historial no se elimina: quedará archivado en solo lectura. La reactivación y sus permisos se definirán en el backend del Hospital.</Alerta>
    <FormularioVistaPrevia titulo="Archivar historial clínico" mostrarAcciones={false}>
      <Card titulo="Motivo de la baja *">
        <div className="archive-reasons">{MOTIVOS.map(([motivo, texto], i) => <label key={motivo} className="archive-reason">
          <input type="radio" name="motivo" defaultChecked={i === 0} /><span><b>{motivo}</b><small>{texto}</small></span>
        </label>)}</div>
        <div className="form-grid">
          <FormField label="Fecha de traslado" required>{a => <input {...a} type="date" />}</FormField>
          <FormField label="Institución de destino" required>{a => <input {...a} placeholder="Nombre de la institución" />}</FormField>
          <FormField label="Número de certificado de defunción" hint="Requerido para fallecimiento">{a => <input {...a} />}</FormField>
          <FormField label="Observaciones" full>{a => <textarea {...a} rows={3} />}</FormField>
        </div>
        <div className="archive-effects">
          <div><Icon name="calendario" /><b>Citas futuras</b><p>Se consultarán las citas afectadas antes de confirmar.</p></div>
          <div><Icon name="archivo" /><b>Archivado</b><p>Nuevo estado, con motivo y fecha. Se conserva el historial.</p></div>
          <div><Icon name="auditoria" /><b>Bitácora</b><p>La acción deberá quedar registrada con tu usuario.</p></div>
        </div>
        <label className="check mt-4"><input type="checkbox" />Confirmo que los datos de la baja son correctos.</label>
        <div className="form-actions">
          <Link className="btn" to={enlace(`/pacientes/${encodeURIComponent(id)}`)}>Cancelar</Link>
          <button type="submit" className="btn btn-primary">Archivar historial</button>
        </div>
      </Card>
    </FormularioVistaPrevia>
  </>;
}
