import { Link, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, ContextPanel, ErrorState, LoadingState, PageHeader, useCarga, useConfirmar, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import VisorResultado from '../componentes/VisorResultado.jsx';

export default function DetalleResultado() {
  const { resultado: id } = useParams();
  const { api, puede, enlace } = useModulo();
  const confirmar = useConfirmar();
  const notificar = useNotificar();
  const envio = useEnvio();
  const res = useCarga(() => api.resultados.obtener(id), [api, id]);

  if (res.cargando && !res.datos) return <LoadingState texto="Cargando resultado…" />;
  if (res.error) return <><ErrorState error={res.error} onReintentar={res.recargar} /><Link className="btn" to={enlace('/resultados')}>Volver a resultados</Link></>;
  const r = res.datos;
  const preliminar = r.estado === 'Preliminar';
  const faltan = r.parametros.length - r.detalles.length;

  async function validar() {
    const ok = await confirmar({
      titulo: 'Validar resultado', confirmar: 'Validar y emitir',
      mensaje: 'Al validar, el resultado queda emitido con tu usuario y ya no admite cambios.'
    });
    if (!ok) return;
    const v = await envio.enviar(() => api.resultados.validar(r.id_resultado));
    if (v) { notificar('Resultado validado y emitido'); res.recargar(); }
  }

  return <>
    <PageHeader titulo="Detalle del resultado" descripcion={`${r.tipo_examen.nombre} · ${r.paciente}`}
      acciones={<>
        <Link className="btn" to={enlace(`/solicitudes/${r.id_solicitud}`)}>Ver solicitud</Link>
        <Link className="btn" to={enlace('/resultados')}>Volver a resultados</Link>
      </>} />
    {envio.error && <Alerta titulo="No se pudo validar">{envio.error.message}</Alerta>}
    <div className="workspace-grid">
      <div className="workspace-main"><Card titulo="Informe del examen" icono="resultado"><VisorResultado resultado={r} /></Card></div>
      <aside className="workspace-aside" aria-label="Contexto del informe">
        <ContextPanel titulo="Estado del informe" icono="resultado" items={[
          ['Estado', r.estado], ['Parámetros registrados', `${r.detalles.length} de ${r.parametros.length}`],
          ['Fecha de emisión', r.fecha_emision ? fechaHora(r.fecha_emision) : 'Sin emitir'], ['Validado por', r.validado_por]
        ]}>
          {preliminar && puede('laboratorio.resultados.registrar') &&
            <Link className="btn btn-block mt-4" to={enlace(`/resultados/nuevo?examen=${r.id_examen}&solicitud=${r.id_solicitud}`)}>Completar o corregir valores</Link>}
          {preliminar && puede('laboratorio.resultados.validar') && (faltan > 0
            ? <p className="meta mt-4">Faltan {faltan} parámetro(s) por registrar antes de validar.</p>
            : <BotonEnviar type="button" enviando={envio.enviando} className="btn btn-primary btn-block mt-4" onClick={validar}>Validar y emitir</BotonEnviar>)}
        </ContextPanel>
        <ContextPanel titulo="Trazabilidad" icono="auditoria" descripcion="El registro y la validación quedan en la bitácora con el usuario que los realizó." />
      </aside>
    </div>
  </>;
}
