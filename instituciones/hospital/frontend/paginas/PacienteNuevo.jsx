import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, ErrorState, FormField, FormSteps, FormSummary, LoadingState, PageHeader, SectionHeading, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { hoy } from '@plataforma/formato.js';

const SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const CONTACTO_VACIO = { nombre_contacto: '', parentesco: '', telefono: '' };
const ALERGIA_VACIA = { id_alergia: '', severidad: 'Leve', reaccion: '' };
const PASOS = [
  { id: 'hospital-generales', titulo: 'Datos generales' },
  { id: 'hospital-contacto', titulo: 'Contacto' },
  { id: 'hospital-emergencia', titulo: 'Emergencia' },
  { id: 'hospital-seguro', titulo: 'Seguro' },
  { id: 'hospital-alergias', titulo: 'Alergias' }
];

export default function PacienteNuevo() {
  const { api, puede } = useSesion();
  const { enlace } = useModulo();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const envio = useEnvio();
  const clinico = puede('clinico.escribir');
  const catalogos = useCarga(() => Promise.all([api.catalogos.listar('seguros'), api.catalogos.listar('alergias')]), [api]);
  const [p, setP] = useState({
    primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '',
    fecha_nacimiento: '', genero: '', estado_civil: '', documento_identidad: '', tipo_sangre: '',
    direccion: '', telefono: '', correo: '', nacionalidad: ''
  });
  const [contactos, setContactos] = useState([{ ...CONTACTO_VACIO }]);
  const [usaSeguro, setUsaSeguro] = useState(false);
  const [seguro, setSeguro] = useState({ id_seguro: '', numero_poliza: '', fecha_inicio: '', fecha_fin: '' });
  const [alergias, setAlergias] = useState([{ ...ALERGIA_VACIA }]);
  const [errores, setErrores] = useState({});

  const seguros = catalogos.datos?.[0]?.items || [];
  const catalogoAlergias = catalogos.datos?.[1]?.items || [];
  const cambiar = (k, v) => setP(x => ({ ...x, [k]: v }));
  const cambiarContacto = (i, k, v) => setContactos(xs => xs.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const cambiarAlergia = (i, k, v) => setAlergias(xs => xs.map((x, j) => j === i ? { ...x, [k]: v } : x));

  function validar() {
    const e = {};
    if (!p.primer_nombre.trim()) e.primer_nombre = 'Obligatorio';
    if (!p.primer_apellido.trim()) e.primer_apellido = 'Obligatorio';
    if (!p.fecha_nacimiento) e.fecha_nacimiento = 'Obligatorio';
    else if (p.fecha_nacimiento > hoy()) e.fecha_nacimiento = 'No puede ser una fecha futura';
    if (!p.genero) e.genero = 'Seleccione una opción';
    if (p.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.correo)) e.correo = 'Correo no válido';
    const completos = contactos.filter(c => c.nombre_contacto.trim() || c.parentesco.trim() || c.telefono.trim());
    if (!completos.length) e.contactos = 'Registre al menos un contacto de emergencia';
    else if (completos.some(c => !c.nombre_contacto.trim() || !c.parentesco.trim() || !c.telefono.trim())) e.contactos = 'Complete todos los campos de los contactos indicados';
    if (usaSeguro) {
      if (!seguro.id_seguro) e.seguro = 'Seleccione la aseguradora';
      else if (!seguro.numero_poliza.trim()) e.seguro = 'Indique el número de póliza';
      else if (seguro.fecha_inicio && seguro.fecha_fin && seguro.fecha_fin < seguro.fecha_inicio) e.seguro = 'La vigencia final no puede ser anterior a la inicial';
    }
    const alergiasValidas = alergias.filter(a => a.id_alergia);
    if (alergiasValidas.length !== new Set(alergiasValidas.map(a => a.id_alergia)).size) e.alergias = 'Hay alergias repetidas';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const cuerpo = {
      ...p,
      segundo_nombre: p.segundo_nombre.trim(),
      segundo_apellido: p.segundo_apellido.trim(),
      estado_civil: p.estado_civil.trim(),
      documento_identidad: p.documento_identidad.trim(),
      tipo_sangre: p.tipo_sangre || null,
      direccion: p.direccion.trim(),
      telefono: p.telefono.trim(),
      correo: p.correo.trim(),
      nacionalidad: p.nacionalidad.trim(),
      contactos: contactos.filter(c => c.nombre_contacto.trim()).map(c => ({
        nombre_contacto: c.nombre_contacto.trim(),
        parentesco: c.parentesco.trim(),
        telefono: c.telefono.trim()
      })),
      alergias: clinico ? alergias.filter(a => a.id_alergia).map(a => ({
        id_alergia: Number(a.id_alergia),
        severidad: a.severidad,
        reaccion: a.reaccion.trim()
      })) : []
    };
    if (usaSeguro) cuerpo.seguro = {
      id_seguro: Number(seguro.id_seguro),
      numero_poliza: seguro.numero_poliza.trim(),
      fecha_inicio: seguro.fecha_inicio || null,
      fecha_fin: seguro.fecha_fin || null
    };
    const r = await envio.enviar(() => api.pacientes.crear(cuerpo));
    if (r) {
      notificar(`Paciente ${r.numero_expediente} registrado`);
      navegar(enlace(`/pacientes/${r.id_paciente}`));
    }
  }

  const pasos = PASOS.map(paso => ({
    ...paso,
    completo: paso.id === 'hospital-generales'
      ? Boolean(p.primer_nombre.trim() && p.primer_apellido.trim() && p.fecha_nacimiento && p.genero)
      : paso.id === 'hospital-emergencia'
        ? contactos.some(c => c.nombre_contacto.trim() && c.parentesco.trim() && c.telefono.trim())
        : false
  }));

  return (
    <>
      <PageHeader titulo="Registrar paciente" descripcion="Complete la identificación, los contactos de emergencia y, si corresponde, el seguro y las alergias."
        acciones={<Link className="btn" to={enlace('/pacientes')}>Cancelar</Link>} />
      <ErrorState error={catalogos.error} onReintentar={catalogos.recargar} />
      {catalogos.cargando ? <LoadingState /> : (
        <>
          <FormSteps pasos={pasos} />
          <form onSubmit={enviar} noValidate>
            {envio.error && <Alerta titulo="No se pudo registrar el paciente">{envio.error.message}</Alerta>}
            {Object.keys(errores).length > 0 && <Alerta>Revise los campos marcados.</Alerta>}
            <div className="form-layout">
              <div className="form-body">
                <Card id="hospital-generales">
                  <SectionHeading numero="1" titulo="Datos generales" descripcion="Identificación del paciente. Los campos con * son obligatorios." />
                  <div className="form-grid">
                    <FormField label="Primer nombre" error={errores.primer_nombre} required>{a => <input {...a} value={p.primer_nombre} onChange={e => cambiar('primer_nombre', e.target.value)} maxLength={60} />}</FormField>
                    <FormField label="Segundo nombre">{a => <input {...a} value={p.segundo_nombre} onChange={e => cambiar('segundo_nombre', e.target.value)} maxLength={60} />}</FormField>
                    <FormField label="Primer apellido" error={errores.primer_apellido} required>{a => <input {...a} value={p.primer_apellido} onChange={e => cambiar('primer_apellido', e.target.value)} maxLength={60} />}</FormField>
                    <FormField label="Segundo apellido">{a => <input {...a} value={p.segundo_apellido} onChange={e => cambiar('segundo_apellido', e.target.value)} maxLength={60} />}</FormField>
                    <FormField label="Fecha de nacimiento" error={errores.fecha_nacimiento} required>{a => <input {...a} type="date" max={hoy()} value={p.fecha_nacimiento} onChange={e => cambiar('fecha_nacimiento', e.target.value)} />}</FormField>
                    <FormField label="Género" error={errores.genero} required>{a => (
                      <select {...a} value={p.genero} onChange={e => cambiar('genero', e.target.value)}>
                        <option value="">Seleccione…</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Masculino">Masculino</option>
                      </select>)}</FormField>
                    <FormField label="Estado civil">{a => <input {...a} value={p.estado_civil} onChange={e => cambiar('estado_civil', e.target.value)} maxLength={20} />}</FormField>
                    <FormField label="DPI">{a => <input {...a} value={p.documento_identidad} onChange={e => cambiar('documento_identidad', e.target.value)} maxLength={20} placeholder="0000 00000 0000" />}</FormField>
                    <FormField label="Tipo de sangre">{a => (
                      <select {...a} value={p.tipo_sangre} onChange={e => cambiar('tipo_sangre', e.target.value)}>
                        <option value="">No indicado</option>
                        {SANGRE.map(t => <option key={t}>{t}</option>)}
                      </select>)}</FormField>
                    <FormField label="Nacionalidad">{a => <input {...a} value={p.nacionalidad} onChange={e => cambiar('nacionalidad', e.target.value)} maxLength={60} />}</FormField>
                  </div>
                </Card>

                <Card id="hospital-contacto">
                  <SectionHeading numero="2" titulo="Datos de contacto" descripcion="Dirección y medios para localizar al paciente." />
                  <div className="form-grid">
                    <FormField label="Dirección" full>{a => <input {...a} value={p.direccion} onChange={e => cambiar('direccion', e.target.value)} maxLength={200} />}</FormField>
                    <FormField label="Teléfono">{a => <input {...a} type="tel" value={p.telefono} onChange={e => cambiar('telefono', e.target.value)} maxLength={15} />}</FormField>
                    <FormField label="Correo electrónico" error={errores.correo}>{a => <input {...a} type="email" value={p.correo} onChange={e => cambiar('correo', e.target.value)} maxLength={120} />}</FormField>
                  </div>
                </Card>

                <Card id="hospital-emergencia" acciones={<button type="button" className="btn btn-sm" disabled={contactos.length >= 10} onClick={() => setContactos(xs => [...xs, { ...CONTACTO_VACIO }])}>Agregar contacto</button>}>
                  <SectionHeading numero="3" titulo="Contactos de emergencia" descripcion="Se requiere al menos un contacto completo." />
                  {errores.contactos && <Alerta>{errores.contactos}</Alerta>}
                  <div className="sub-list">
                    {contactos.map((c, i) => (
                      <div className="sub-item" key={i}>
                        <div className="sub-item-head">
                          <h3>Contacto {i + 1}</h3>
                          {contactos.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => setContactos(xs => xs.filter((_, j) => j !== i))}>Quitar</button>}
                        </div>
                        <div className="form-grid">
                          <FormField label="Nombre completo" required>{a => <input {...a} value={c.nombre_contacto} onChange={e => cambiarContacto(i, 'nombre_contacto', e.target.value)} maxLength={120} />}</FormField>
                          <FormField label="Parentesco" required>{a => <input {...a} value={c.parentesco} onChange={e => cambiarContacto(i, 'parentesco', e.target.value)} maxLength={40} />}</FormField>
                          <FormField label="Teléfono" required>{a => <input {...a} type="tel" value={c.telefono} onChange={e => cambiarContacto(i, 'telefono', e.target.value)} maxLength={15} />}</FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card id="hospital-seguro">
                  <SectionHeading numero="4" titulo="Seguro médico" descripcion="Opcional." />
                  <label className="check"><input type="checkbox" checked={usaSeguro} onChange={e => setUsaSeguro(e.target.checked)} /> <b>Registrar seguro médico</b></label>
                  {usaSeguro && <div className="form-grid mt-4">
                    <FormField label="Aseguradora" required>{a => (
                      <select {...a} value={seguro.id_seguro} onChange={e => setSeguro({ ...seguro, id_seguro: e.target.value })}>
                        <option value="">Seleccione…</option>
                        {seguros.map(s => <option key={s.id_seguro} value={s.id_seguro}>{s.nombre_aseguradora}</option>)}
                      </select>)}</FormField>
                    <FormField label="Número de póliza" required>{a => <input {...a} value={seguro.numero_poliza} onChange={e => setSeguro({ ...seguro, numero_poliza: e.target.value })} maxLength={40} />}</FormField>
                    <FormField label="Vigente desde">{a => <input {...a} type="date" value={seguro.fecha_inicio} onChange={e => setSeguro({ ...seguro, fecha_inicio: e.target.value })} />}</FormField>
                    <FormField label="Vigente hasta">{a => <input {...a} type="date" value={seguro.fecha_fin} onChange={e => setSeguro({ ...seguro, fecha_fin: e.target.value })} />}</FormField>
                    {errores.seguro && <div className="field full"><span className="error">{errores.seguro}</span></div>}
                  </div>}
                </Card>

                {clinico && <Card id="hospital-alergias" acciones={<button type="button" className="btn btn-sm" onClick={() => setAlergias(xs => [...xs, { ...ALERGIA_VACIA }])}>Agregar alergia</button>}>
                  <SectionHeading numero="5" titulo="Alergias conocidas" descripcion="Información restringida que se mostrará en la consulta y la receta." />
                  {errores.alergias && <Alerta>{errores.alergias}</Alerta>}
                  <div className="sub-list">
                    {alergias.map((a, i) => (
                      <div className="sub-item" key={i}>
                        <div className="sub-item-head">
                          <h3>Alergia {i + 1}</h3>
                          {alergias.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => setAlergias(xs => xs.filter((_, j) => j !== i))}>Quitar</button>}
                        </div>
                        <div className="form-grid">
                          <FormField label="Alergia">{c => (
                            <select {...c} value={a.id_alergia} onChange={e => cambiarAlergia(i, 'id_alergia', e.target.value)}>
                              <option value="">Seleccione…</option>
                              {catalogoAlergias.map(x => <option key={x.id_alergia} value={x.id_alergia}>{x.nombre_alergia}</option>)}
                            </select>)}</FormField>
                          <FormField label="Severidad">{c => (
                            <select {...c} value={a.severidad} onChange={e => cambiarAlergia(i, 'severidad', e.target.value)}>
                              <option>Leve</option><option>Moderada</option><option>Severa</option>
                            </select>)}</FormField>
                          <FormField label="Reacción">{c => <input {...c} value={a.reaccion} onChange={e => cambiarAlergia(i, 'reaccion', e.target.value)} maxLength={255} />}</FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>}
              </div>

              <div className="form-side">
                <FormSummary titulo="Expediente que se asignará">
                  <span className="summary-code">HG · Automático</span>
                  <p className="summary-note">El backend asignará el número definitivo al guardar el registro.</p>
                  <BotonEnviar enviando={envio.enviando} className="btn btn-primary btn-block">Guardar y abrir historial</BotonEnviar>
                  <Link className="btn btn-block" to={enlace('/pacientes')}>Cancelar</Link>
                </FormSummary>
                <Card titulo="Clasificación de los datos">
                  <dl className="classification-list">
                    <div><dt>Datos generales y contacto</dt><dd><span className="badge primary plain">Confidencial</span></dd></div>
                    {clinico && <div><dt>Alergias</dt><dd><span className="badge bad plain">Restringida</span></dd></div>}
                  </dl>
                </Card>
              </div>
            </div>
          </form>
        </>
      )}
    </>
  );
}
