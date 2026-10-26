import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, DataTable, ErrorState, LoadingState, StatusBadge, useCarga } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';

export function TablaAuditoria({ eventos, conPaciente }) {
  const { modulo } = useSesion();
  return (
    <DataTable titulo="Eventos de auditoría" vacio="Sin eventos registrados" filas={eventos} claveFila={(e, i) => e.id_evento || `${e.fecha_hora}-${e.accion}`} compacta
      columnas={[
        { clave: 'fecha', titulo: 'Fecha y hora', render: e => fechaHora(e.fecha_hora) },
        { clave: 'accion', titulo: 'Acción', principal: true, render: e => <><code>{e.accion}</code>{e.detalle && <div className="cell-sub">{e.detalle}</div>}</> },
        ...(conPaciente ? [{ clave: 'paciente', titulo: 'Paciente', render: e => e.id_paciente || '—' }] : []),
        { clave: 'usuario', titulo: 'Usuario', render: e => <>{e.id_usuario}<div className="cell-sub">{modulo.roles[e.rol] || e.rol || '—'}</div></> },
        { clave: 'ref', titulo: 'Referencia', render: e => e.referencia || e.recurso || '—' },
        { clave: 'resultado', titulo: 'Resultado', render: e => (e.resultado ? <StatusBadge>{e.resultado}</StatusBadge> : '—') }
      ]} />
  );
}

export default function AuditoriaPaciente({ paciente }) {
  const { api } = useSesion();
  const { datos, cargando, error, recargar } = useCarga(() => api.auditoria({ id_paciente: paciente.id_paciente, limite: 200 }), [api, paciente]);
  return (
    <Card titulo="Bitácora de accesos y cambios" descripcion="Quién consultó o modificó este historial y cuándo, incluidos los accesos denegados (colección bitacora_acceso)."
      acciones={<button type="button" className="btn btn-sm" onClick={recargar}>Actualizar</button>}>
      {cargando ? <LoadingState /> : error ? <ErrorState error={error} onReintentar={recargar} /> : <TablaAuditoria eventos={datos} />}
    </Card>
  );
}
