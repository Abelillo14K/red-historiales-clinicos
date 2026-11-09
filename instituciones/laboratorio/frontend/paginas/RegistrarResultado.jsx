import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, EmptyState, ErrorState, FormField, FormSummary, LoadingState, PageHeader, SectionHeading, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { aIso, localAhora } from '@plataforma/formato.js';
import { referencia } from '../componentes/formato.js';

// Agregar diagnóstico (regla común) = registrar los valores del examen. Los campos salen de los
// parámetros de su tipo de examen; se puede guardar parcialmente y completar después.
export default function RegistrarResultado() {
  const { api, enlace } = useModulo();
  const [params] = useSearchParams();
  const idExamen = params.get('examen');
  const idSolicitud = params.get('solicitud');
  const datos = useCarga(async () => {
    if (!idExamen || !idSolicitud) return null;
    const solicitud = await api.solicitudes.obtener(idSolicitud);
    const examen = solicitud.examenes.find(e => e.id_examen === idExamen);
    if (!examen) return { solicitud, examen: null, tipo: null };
    return { solicitud, examen, tipo: await api.catalogos.tipoExamen(examen.id_tipo_examen) };
  }, [api, idExamen, idSolicitud]);

  if (!idExamen || !idSolicitud) {
    return <>
      <PageHeader titulo="Registrar resultado" />
      <EmptyState icono="matraz" titulo="Elija un examen" accion={<Link className="btn btn-primary" to={enlace('/solicitudes?estado=Pendiente')}>Ver solicitudes pendientes</Link>}>
        Los resultados se registran desde el examen de una solicitud.
      </EmptyState>
    </>;
  }
  if (datos.cargando) return <LoadingState />;
  if (datos.error) return <ErrorState error={datos.error} onReintentar={datos.recargar} />;
  if (!datos.datos.examen) return <Alerta titulo="Examen no encontrado">El examen no pertenece a la solicitud {idSolicitud}.</Alerta>;
  return <Formulario {...datos.datos} />;
}

function Formulario({ solicitud, examen, tipo }) {
  const { api, enlace } = useModulo();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const previos = new Map((examen.resultado?.detalles || []).map(d => [d.id_parametro, d.valor_numerico ?? d.valor_texto]));
  const [valores, setValores] = useState(() => Object.fromEntries(tipo.parametros.map(p => [p.id_parametro, previos.has(p.id_parametro) ? String(previos.get(p.id_parametro)) : ''])));
  const [fecha, setFecha] = useState(localAhora());
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const validado = examen.resultado?.estado === 'Validado';
  const llenos = tipo.parametros.filter(p => valores[p.id_parametro].trim());

  async function enviar(e) {
    e.preventDefault();
    if (!llenos.length) return setError('Registre al menos un parámetro');
    setError('');
    const r = await envio.enviar(() => api.resultados.registrar(examen.id_examen, {
      fecha_analisis: aIso(fecha), observaciones: observaciones.trim() || null,
      valores: llenos.map(p => ({ id_parametro: p.id_parametro, valor: valores[p.id_parametro].trim() }))
    }));
    if (r) {
      notificar(r.fuera_de_rango ? `Resultado guardado: ${r.fuera_de_rango} valor(es) fuera de rango` : 'Resultado guardado');
      navegar(enlace(`/resultados/${r.id_resultado}`));
    }
  }

  return (
    <>
      <PageHeader titulo="Registrar resultado" descripcion={`${tipo.nombre} · ${solicitud.paciente} · solicitud ${solicitud.id_solicitud}`}
        acciones={<Link className="btn" to={enlace(`/solicitudes/${solicitud.id_solicitud}`)}>Volver a la solicitud</Link>} />
      {validado && <Alerta tipo="info" titulo="Resultado validado">Ya fue emitido y no admite cambios.</Alerta>}
      <form onSubmit={enviar} noValidate>
        {(error || envio.error) && <Alerta titulo="No se pudo guardar">{error || envio.error.message}</Alerta>}
        <fieldset className="fieldset-plain" disabled={validado}>
          <legend className="sr-only">Resultado del examen</legend>
          <div className="form-layout">
            <div className="form-body">
              <Card>
                <SectionHeading numero="1" titulo="Parámetros del resultado" descripcion="Los valores fuera del rango de referencia se marcan al guardar." />
                <div className="form-grid">
                  {tipo.parametros.map(p => (
                    <FormField key={p.id_parametro} label={`${p.nombre}${p.unidad_medida ? ` (${p.unidad_medida})` : ''}`} hint={`Referencia: ${referencia(p)}`}>
                      {a => <input {...a} inputMode={p.tipo_dato === 'Numerico' ? 'decimal' : undefined} maxLength={80}
                        value={valores[p.id_parametro]} onChange={e => setValores({ ...valores, [p.id_parametro]: e.target.value })} />}
                    </FormField>
                  ))}
                </div>
              </Card>
              <Card>
                <SectionHeading numero="2" titulo="Análisis" />
                <div className="form-grid">
                  <FormField label="Fecha del análisis" required>{a => <input {...a} type="datetime-local" max={localAhora(5)} value={fecha} onChange={e => setFecha(e.target.value)} />}</FormField>
                  <FormField label="Observaciones del análisis" full>{a => <textarea {...a} rows={3} maxLength={500} value={observaciones} onChange={e => setObservaciones(e.target.value)} />}</FormField>
                </div>
              </Card>
            </div>
            <div className="form-side">
              <FormSummary titulo="Resultado" items={[
                ['Examen', tipo.nombre], ['Muestra', examen.codigo_muestra || '—'],
                ['Parámetros', `${llenos.length} de ${tipo.parametros.length}`], ['Estado', examen.resultado?.estado || 'Nuevo']
              ]}>
                <p className="summary-note">Se guarda como preliminar. Un bioquímico lo valida cuando todos los parámetros estén registrados.</p>
                <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Guardar resultado</BotonEnviar>
              </FormSummary>
            </div>
          </div>
        </fieldset>
      </form>
    </>
  );
}
