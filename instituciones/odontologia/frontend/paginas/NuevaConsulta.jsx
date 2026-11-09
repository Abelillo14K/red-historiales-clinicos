import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, ErrorState, FormField, FormSteps, FormSummary, LoadingState, PageHeader, SectionHeading, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { aIso, fechaHora, localAhora } from '@plataforma/formato.js';

const DX = { codigo: '', descripcion: '', pieza: '' };
const TX = { pieza: '', id_procedimiento: '', procedimiento: '', descripcion: '', recomendaciones: '' };
const MED = { nombre: '', dosis: '', frecuencia: '', duracion: '', via_administracion: 'Oral' };
const vacio = o => Object.values(o).every(v => !String(v).trim() || v === 'Oral');
const v = x => x.trim() || null;

// Registrar consulta (regla común) con diagnósticos, tratamiento por pieza y receta en una sola transacción.
export default function NuevaConsulta() {
  const { id } = useParams();
  const { api, enlace } = useModulo();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const datos = useCarga(async () => {
    const [p, odontologos, procedimientos] = await Promise.all([api.pacientes.obtener(id), api.catalogos.odontologos(), api.catalogos.procedimientos()]);
    return { p, odontologos, procedimientos };
  }, [api, id]);
  const [c, setC] = useState({ id_odontologo: '', fecha_hora: localAhora(), motivo: '', id_cita: '', antecedentes: '', examen_bucal: '', hallazgos: '', indicaciones: '' });
  const [dx, setDx] = useState([{ ...DX }]);
  const [tx, setTx] = useState([{ ...TX }]);
  const [meds, setMeds] = useState([{ ...MED }]);
  const [error, setError] = useState('');
  const volver = enlace(`/pacientes/${encodeURIComponent(id)}`);

  if (datos.cargando) return <LoadingState />;
  if (datos.error) return <ErrorState error={datos.error} onReintentar={datos.recargar} />;
  const { p, odontologos, procedimientos } = datos.datos;
  const citas = (p.citas || []).filter(x => x.estado === 'Programada');
  const campo = (k, props = {}) => a => {
    const Tag = props.textarea ? 'textarea' : 'input';
    const { textarea, ...resto } = props;
    return <Tag {...a} {...resto} rows={textarea ? 2 : undefined} value={c[k]} onChange={e => setC({ ...c, [k]: e.target.value })} />;
  };
  const fila = (lista, poner) => (i, k) => a => <input {...a} value={lista[i][k]} onChange={e => poner(lista.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />;
  const enDx = fila(dx, setDx), enTx = fila(tx, setTx), enMed = fila(meds, setMeds);
  const dxLlenos = dx.filter(x => !vacio(x)), txLlenos = tx.filter(x => !vacio(x)), medsLlenos = meds.filter(x => !vacio(x));

  async function enviar(e) {
    e.preventDefault();
    if (!c.id_odontologo || !c.motivo.trim()) return setError('Elija el odontólogo e indique el motivo de consulta');
    setError('');
    const r = await envio.enviar(() => api.consultas.crear(id, {
      id_odontologo: c.id_odontologo, fecha_hora: aIso(c.fecha_hora), motivo: c.motivo.trim(), id_cita: c.id_cita || null,
      evaluacion: { antecedentes: v(c.antecedentes), examen_bucal: v(c.examen_bucal), hallazgos: v(c.hallazgos) },
      diagnosticos: dxLlenos.map(x => ({ codigo: x.codigo.trim(), descripcion: x.descripcion.trim(), pieza: v(x.pieza) })),
      tratamientos: txLlenos.map(x => ({ pieza: v(x.pieza), id_procedimiento: v(x.id_procedimiento), procedimiento: x.id_procedimiento ? null : v(x.procedimiento), descripcion: v(x.descripcion), recomendaciones: v(x.recomendaciones) })),
      prescripcion: medsLlenos.length ? { indicaciones_generales: v(c.indicaciones), medicamentos: medsLlenos.map(m => Object.fromEntries(Object.entries(m).map(([k, x]) => [k, x.trim()]))) } : null
    }));
    if (r) { notificar('Consulta registrada'); navegar(`${volver}/consultas`); }
  }

  return (
    <>
      <PageHeader titulo="Nueva consulta odontológica" descripcion={`${p.nombres} ${p.apellidos} · expediente ${p.id_paciente}`}
        acciones={<Link className="btn" to={volver}>Cancelar</Link>} />
      {p.antecedentes?.alergias && <Alerta tipo="warn" titulo="Alergias registradas">{p.antecedentes.alergias}</Alerta>}
      <FormSteps pasos={[
        { id: 'odonto-consulta', titulo: 'Atención', completo: Boolean(c.id_odontologo && c.motivo.trim()) },
        { id: 'odonto-evaluacion', titulo: 'Evaluación', completo: Boolean(c.examen_bucal.trim() || c.hallazgos.trim()) },
        { id: 'odonto-diagnosticos', titulo: 'Diagnósticos', completo: dxLlenos.length > 0 },
        { id: 'odonto-tratamiento', titulo: 'Tratamiento', completo: txLlenos.length > 0 },
        { id: 'odonto-receta', titulo: 'Receta', completo: medsLlenos.length > 0 }
      ]} />
      <form onSubmit={enviar} noValidate>
        {(error || envio.error) && <Alerta titulo="No se pudo registrar">{error || envio.error.message}</Alerta>}
        <div className="form-layout">
          <div className="form-body">
            <Card id="odonto-consulta">
              <SectionHeading numero="1" titulo="Datos de la consulta" />
              <div className="form-grid">
                <FormField label="Odontólogo responsable" required hint={odontologos.length ? undefined : 'Registre odontólogos en Catálogos'}>{a => (
                  <select {...a} value={c.id_odontologo} onChange={e => setC({ ...c, id_odontologo: e.target.value })}>
                    <option value="">Seleccione…</option>
                    {odontologos.filter(o => o.activo).map(o => <option key={o.id_odontologo} value={o.id_odontologo}>{o.nombres} {o.apellidos} ({o.colegiado})</option>)}
                  </select>)}</FormField>
                <FormField label="Fecha y hora" required>{campo('fecha_hora', { type: 'datetime-local', max: localAhora(5) })}</FormField>
                <FormField label="Cita que se atiende" hint="Opcional: quedará como Atendida">{a => (
                  <select {...a} value={c.id_cita} onChange={e => setC({ ...c, id_cita: e.target.value })}>
                    <option value="">Sin cita</option>
                    {citas.map(x => <option key={x.id_cita} value={x.id_cita}>{fechaHora(x.fecha_hora)} · {x.motivo}</option>)}
                  </select>)}</FormField>
                <FormField label="Motivo de consulta" required full>{campo('motivo', { maxLength: 300 })}</FormField>
              </div>
            </Card>
            <Card id="odonto-evaluacion">
              <SectionHeading numero="2" titulo="Evaluación odontológica" />
              <div className="form-grid">
                <FormField label="Antecedentes de la atención">{campo('antecedentes', { textarea: true, maxLength: 1000 })}</FormField>
                <FormField label="Examen bucal">{campo('examen_bucal', { textarea: true, maxLength: 1000 })}</FormField>
                <FormField label="Hallazgos" full>{campo('hallazgos', { textarea: true, maxLength: 1000 })}</FormField>
              </div>
            </Card>
            <Card id="odonto-diagnosticos">
              <SectionHeading numero="3" titulo="Diagnósticos" descripcion="Opcional. La pieza usa la numeración FDI (11–48, temporales 51–85)." />
              <div className="sub-list">{dx.map((_, i) => <div className="sub-item form-grid" key={i}>
                <FormField label="Código">{enDx(i, 'codigo')}</FormField>
                <FormField label="Descripción">{enDx(i, 'descripcion')}</FormField>
                <FormField label="Pieza">{enDx(i, 'pieza')}</FormField>
              </div>)}</div>
              <button type="button" className="btn btn-sm mt-2" onClick={() => setDx([...dx, { ...DX }])}>+ Otro diagnóstico</button>
            </Card>
            <Card id="odonto-tratamiento">
              <SectionHeading numero="4" titulo="Tratamiento por pieza" descripcion="Opcional. Se registra en la consulta y como último tratamiento de la pieza en el odontograma." />
              <div className="sub-list">{tx.map((t, i) => <div className="sub-item form-grid" key={i}>
                <FormField label="Pieza">{enTx(i, 'pieza')}</FormField>
                <FormField label="Procedimiento del catálogo">{a => (
                  <select {...a} value={t.id_procedimiento} onChange={e => setTx(tx.map((x, j) => (j === i ? { ...x, id_procedimiento: e.target.value } : x)))}>
                    <option value="">Otro (escribirlo)</option>
                    {procedimientos.map(x => <option key={x.id_procedimiento} value={x.id_procedimiento}>{x.codigo} · {x.nombre}</option>)}
                  </select>)}</FormField>
                {!t.id_procedimiento && <FormField label="Procedimiento">{enTx(i, 'procedimiento')}</FormField>}
                <FormField label="Descripción del tratamiento" full>{enTx(i, 'descripcion')}</FormField>
                <FormField label="Recomendaciones" full>{enTx(i, 'recomendaciones')}</FormField>
              </div>)}</div>
              <button type="button" className="btn btn-sm mt-2" onClick={() => setTx([...tx, { ...TX }])}>+ Otro tratamiento</button>
            </Card>
            <Card id="odonto-receta">
              <SectionHeading numero="5" titulo="Receta e indicaciones" descripcion="Opcional. Si agrega medicamentos se emite una receta." />
              <div className="sub-list">{meds.map((_, i) => <div className="sub-item form-grid" key={i}>
                <FormField label="Medicamento">{enMed(i, 'nombre')}</FormField>
                <FormField label="Dosis">{enMed(i, 'dosis')}</FormField>
                <FormField label="Frecuencia">{enMed(i, 'frecuencia')}</FormField>
                <FormField label="Duración">{enMed(i, 'duracion')}</FormField>
                <FormField label="Vía de administración">{enMed(i, 'via_administracion')}</FormField>
              </div>)}</div>
              <button type="button" className="btn btn-sm mt-2" onClick={() => setMeds([...meds, { ...MED }])}>+ Otro medicamento</button>
              <FormField label="Indicaciones generales" full>{campo('indicaciones', { textarea: true, maxLength: 1000 })}</FormField>
            </Card>
          </div>
          <div className="form-side">
            <FormSummary titulo="Consulta" items={[
              ['Paciente', `${p.nombres} ${p.apellidos}`], ['Diagnósticos', dxLlenos.length], ['Tratamientos', txLlenos.length], ['Medicamentos', medsLlenos.length]
            ]}>
              <p className="summary-note">Todo se guarda junto: si algo falla, no se guarda nada.</p>
              <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Guardar consulta</BotonEnviar>
              <Link className="btn btn-block" to={volver}>Cancelar</Link>
            </FormSummary>
          </div>
        </div>
      </form>
    </>
  );
}
