import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, DataTable, ErrorState, FilterBar, FormField, LoadingState, MetricStrip, PageHeader, StatusBadge, Tabs, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import { referencia } from '../componentes/formato.js';

// Una página para dos rutas del manifiesto: /catalogos y /bitacora.
export default function Administracion() {
  const { pathname } = useLocation();
  return pathname.endsWith('/bitacora') ? <Bitacora /> : <Catalogos />;
}

const TIPO_DATO = { Numerico: 'Numérico', Texto: 'Texto' };
const CARGO = { Tecnico: 'Técnico', Bioquimico: 'Bioquímico', Patologo: 'Patólogo' };

// Pasos en el orden en que se configuran: cada uno usa lo de los anteriores.
const PASOS = [
  { clave: 'muestras', titulo: 'Tipos de muestra',
    descripcion: 'Qué se le toma al paciente (sangre, orina…). Cada tipo de examen indica qué muestra necesita.' },
  { clave: 'parametros', titulo: 'Parámetros',
    descripcion: 'Valores que se miden (hemoglobina, color…). Un parámetro puede usarse en varios exámenes; su rango normal se define en cada examen.' },
  { clave: 'examenes', titulo: 'Tipos de examen',
    descripcion: 'Une una muestra con sus parámetros y el rango normal de cada uno. Es lo que se elige al crear una solicitud.' },
  { clave: 'medicos', titulo: 'Médicos solicitantes',
    descripcion: 'Médicos que piden exámenes (de esta u otra institución). Se eligen, de forma opcional, en cada solicitud.' },
  { clave: 'personal', titulo: 'Personal del laboratorio',
    descripcion: 'Quién valida y emite resultados. El usuario debe ser el mismo de su sesión.' }
];

function Catalogos() {
  const { api } = useModulo();
  // Todos los catálogos se cargan juntos: el resumen y las relaciones entre pestañas los necesitan.
  const datos = useCarga(async () => {
    const [muestras, parametros, tipos, medicos, personal] = await Promise.all([
      api.catalogos.tiposMuestra(), api.catalogos.parametros(), api.catalogos.tiposExamen(), api.catalogos.medicos(), api.catalogos.personal()
    ]);
    const examenes = await Promise.all(tipos.map(t => api.catalogos.tipoExamen(t.id_tipo_examen)));
    return { muestras, parametros, examenes, medicos, personal };
  }, [api]);
  const [elegida, setElegida] = useState(null);

  if (datos.cargando && !datos.datos) return <LoadingState texto="Cargando catálogos…" />;
  if (datos.error) return <ErrorState error={datos.error} onReintentar={datos.recargar} />;
  const d = datos.datos;
  const bioquimicos = d.personal.filter(p => p.cargo === 'Bioquimico' && p.activo).length;
  const cuentas = { muestras: d.muestras.length, parametros: d.parametros.length, examenes: d.examenes.length, medicos: d.medicos.length, personal: bioquimicos };
  const pendiente = PASOS.find(p => !cuentas[p.clave]);
  const actual = elegida || pendiente?.clave || 'examenes';
  const paso = PASOS.find(p => p.clave === actual);
  const ctx = { ...d, recargar: datos.recargar };

  return (
    <>
      <PageHeader titulo="Catálogos" descripcion="Configuración del laboratorio. Se llena en orden: cada paso usa lo de los anteriores." />
      {pendiente
        ? <Alerta tipo="info" titulo={`Siguiente paso: ${PASOS.indexOf(pendiente) + 1}. ${pendiente.titulo}`}>
          Faltan: {PASOS.filter(p => !cuentas[p.clave]).map(p => (p.clave === 'personal' ? 'un bioquímico en Personal' : p.titulo.toLowerCase())).join(', ')}.
          El número de cada pestaña indica cuántos registros tiene.
        </Alerta>
        : <Alerta tipo="ok" titulo="Todo listo">Ya se pueden crear solicitudes, registrar y validar resultados.</Alerta>}
      <Tabs etiqueta="Pasos de configuración" actual={actual} onCambiar={setElegida}
        pestanas={PASOS.map((p, i) => ({ clave: p.clave, titulo: `${i + 1}. ${p.titulo}`, cuenta: cuentas[p.clave] }))} />
      <div role="tabpanel" aria-label={paso.titulo}>
        <p className="meta mt-2">{paso.descripcion}</p>
        {actual === 'muestras' && <Muestras {...ctx} />}
        {actual === 'parametros' && <Parametros {...ctx} />}
        {actual === 'examenes' && <TiposExamen {...ctx} />}
        {actual === 'medicos' && <Medicos {...ctx} />}
        {actual === 'personal' && <Personal {...ctx} />}
      </div>
    </>
  );
}

// Listado a la izquierda y alta a la derecha (solo con catalogos.editar).
function ConAlta({ titulo, tabla, formulario }) {
  const { puede } = useModulo();
  return (
    <div className="grid grid-main">
      <Card titulo={titulo}>{tabla}</Card>
      {puede('catalogos.editar') && formulario}
    </div>
  );
}

// Formulario de alta simple: campos [clave, etiqueta, props]; las opciones son [valor, texto].
function FormularioAlta({ titulo = 'Agregar', campos, crear, recargar, aviso }) {
  const notificar = useNotificar();
  const envio = useEnvio();
  const vacio = () => Object.fromEntries(campos.map(([k]) => [k, '']));
  const [d, setD] = useState(vacio);
  async function enviar(e) {
    e.preventDefault();
    const datos = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim() || null]));
    if (await envio.enviar(() => crear(datos))) { notificar(aviso); setD(vacio()); recargar(); }
  }
  return (
    <Card titulo={titulo}>
      <form onSubmit={enviar} className="stack">
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        {campos.map(([k, etiqueta, { opciones, hint, ...props }]) => (
          <FormField key={k} label={etiqueta} required={props.required} hint={hint}>{a => (opciones
            ? <select {...a} value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })}>
              <option value="">Seleccione…</option>{opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            : <input {...a} {...props} value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })} />)}
          </FormField>
        ))}
        <BotonEnviar enviando={envio.enviando}>Agregar</BotonEnviar>
      </form>
    </Card>
  );
}

function Muestras({ muestras, examenes, recargar }) {
  const { api } = useModulo();
  const usos = m => examenes.filter(t => t.id_tipo_muestra === m.id_tipo_muestra).map(t => t.nombre);
  return <ConAlta titulo="Tipos de muestra"
    tabla={<DataTable titulo="Tipos de muestra" vacio="Agregue la primera muestra (por ejemplo, Sangre)" filas={muestras} claveFila={m => m.id_tipo_muestra} columnas={[
      { clave: 'nombre', titulo: 'Muestra', principal: true },
      { clave: 'usos', titulo: 'La usan los exámenes', render: m => usos(m).join(', ') || <span className="meta">Ninguno todavía</span> }
    ]} />}
    formulario={<FormularioAlta campos={[['nombre', 'Nombre de la muestra', { required: true, maxLength: 60, placeholder: 'Sangre, orina, heces…' }]]}
      crear={d => api.catalogos.crearTipoMuestra(d)} recargar={recargar} aviso="Tipo de muestra agregado" />} />;
}

function Parametros({ parametros, examenes, recargar }) {
  const { api } = useModulo();
  const usos = p => examenes.filter(t => t.parametros.some(x => x.id_parametro === p.id_parametro)).map(t => t.nombre);
  return <ConAlta titulo="Parámetros"
    tabla={<DataTable titulo="Parámetros" vacio="Agregue el primer parámetro (por ejemplo, Hemoglobina)" filas={parametros} claveFila={p => p.id_parametro} columnas={[
      { clave: 'nombre', titulo: 'Parámetro', principal: true },
      { clave: 'unidad', titulo: 'Unidad', render: p => p.unidad_medida || '—' },
      { clave: 'tipo', titulo: 'Se registra como', render: p => TIPO_DATO[p.tipo_dato] },
      { clave: 'usos', titulo: 'Lo usan los exámenes', render: p => usos(p).join(', ') || <span className="meta">Ninguno todavía</span> }
    ]} />}
    formulario={<FormularioAlta campos={CAMPOS_PARAMETRO} crear={d => api.catalogos.crearParametro(d)} recargar={recargar} aviso="Parámetro agregado" />} />;
}

const CAMPOS_PARAMETRO = [
  ['nombre', 'Nombre del parámetro', { required: true, maxLength: 80, placeholder: 'Hemoglobina' }],
  ['unidad_medida', 'Unidad de medida', { maxLength: 20, placeholder: 'g/dL (vacío si no tiene)' }],
  ['tipo_dato', 'Se registra como', { required: true, opciones: [['Numerico', 'Número (permite rango mínimo y máximo)'], ['Texto', 'Texto (permite un valor esperado)']] }]
];

function Medicos({ medicos, recargar }) {
  const { api } = useModulo();
  return <ConAlta titulo="Médicos solicitantes"
    tabla={<DataTable titulo="Médicos solicitantes" vacio="Sin médicos todavía (es opcional)" filas={medicos} claveFila={m => m.id_medico} columnas={[
      { clave: 'nombre_completo', titulo: 'Médico', principal: true },
      { clave: 'numero_colegiado', titulo: 'Colegiado' },
      { clave: 'institucion', titulo: 'Institución', render: m => m.institucion_procedencia || '—' },
      { clave: 'telefono', titulo: 'Teléfono', render: m => m.telefono_contacto || '—' }
    ]} />}
    formulario={<FormularioAlta campos={[
      ['nombre_completo', 'Nombre completo', { required: true, maxLength: 150 }],
      ['numero_colegiado', 'Número de colegiado', { required: true, maxLength: 20 }],
      ['institucion_procedencia', 'Institución de procedencia', { maxLength: 150 }],
      ['telefono_contacto', 'Teléfono', { maxLength: 20 }]
    ]} crear={d => api.catalogos.crearMedico(d)} recargar={recargar} aviso="Médico agregado" />} />;
}

function Personal({ personal, recargar }) {
  const { api } = useModulo();
  return <ConAlta titulo="Personal del laboratorio"
    tabla={<DataTable titulo="Personal del laboratorio" vacio="Agregue al menos un bioquímico para poder validar resultados" filas={personal} claveFila={p => p.id_personal} columnas={[
      { clave: 'nombre', titulo: 'Nombre', principal: true, render: p => `${p.nombres} ${p.apellidos}` },
      { clave: 'cargo', titulo: 'Cargo', render: p => CARGO[p.cargo] },
      { clave: 'usuario', titulo: 'Usuario de sesión', render: p => <code>{p.usuario}</code> },
      { clave: 'valida', titulo: 'Puede validar', render: p => (p.cargo === 'Bioquimico' && p.activo ? <StatusBadge tono="ok">Sí</StatusBadge> : 'No') }
    ]} />}
    formulario={<FormularioAlta campos={[
      ['nombres', 'Nombres', { required: true, maxLength: 120 }],
      ['apellidos', 'Apellidos', { required: true, maxLength: 120 }],
      ['cargo', 'Cargo', { required: true, opciones: [['Bioquimico', 'Bioquímico (valida resultados)'], ['Tecnico', 'Técnico'], ['Patologo', 'Patólogo']] }],
      ['usuario', 'Usuario de sesión', { required: true, maxLength: 80, hint: 'El mismo nombre que va en su token, por ejemplo EDDY-BQ' }],
      ['numero_colegiado', 'Número de colegiado', { maxLength: 20 }]
    ]} crear={d => api.catalogos.crearPersonal(d)} recargar={recargar} aviso="Personal agregado" />} />;
}

const NUEVO = '__nuevo';
const filaVacia = () => ({ id_parametro: '', nuevo: { nombre: '', unidad_medida: '', tipo_dato: 'Numerico' }, min: '', max: '', texto: '' });

// Un tipo de examen define la estructura de su resultado. La muestra y los parámetros se eligen
// de los catálogos o se crean aquí mismo, sin cambiar de pestaña.
function TiposExamen({ muestras, parametros, examenes, recargar }) {
  const { api, puede } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const VACIO = { nombre: '', categoria: '', descripcion: '', id_tipo_muestra: '', muestra_nueva: '', tiempo_entrega_horas: '24', precio: '0' };
  const [t, setT] = useState(VACIO);
  const [filas, setFilas] = useState([filaVacia()]);
  const porId = new Map(parametros.map(p => [p.id_parametro, p]));
  const tipoDe = f => (f.id_parametro === NUEVO ? f.nuevo.tipo_dato : porId.get(f.id_parametro)?.tipo_dato);
  const numero = v => (v === '' ? null : Number(v));
  const cambiar = (i, cambios) => setFilas(fs => fs.map((f, j) => (j === i ? { ...f, ...cambios } : f)));

  function validar() {
    if (!t.nombre.trim() || !t.categoria.trim()) return 'Indique el nombre y la categoría del examen';
    if (!t.id_tipo_muestra || (t.id_tipo_muestra === NUEVO && !t.muestra_nueva.trim())) return 'Elija o cree el tipo de muestra';
    if (!filas.length) return 'Agregue al menos un parámetro';
    if (filas.some(f => !f.id_parametro || (f.id_parametro === NUEVO && !f.nuevo.nombre.trim()))) return 'Cada fila necesita un parámetro (elegido o nuevo con nombre)';
    return null;
  }

  async function enviar(e) {
    e.preventDefault();
    const error = validar();
    if (error) return envio.setError(new Error(error));
    // Primero se crean la muestra y los parámetros nuevos (quedan en el catálogo para otros exámenes).
    const r = await envio.enviar(async () => {
      const id_tipo_muestra = t.id_tipo_muestra === NUEVO
        ? (await api.catalogos.crearTipoMuestra({ nombre: t.muestra_nueva.trim() })).id_tipo_muestra : t.id_tipo_muestra;
      const ids = [];
      for (const f of filas) {
        ids.push(f.id_parametro === NUEVO
          ? (await api.catalogos.crearParametro({ nombre: f.nuevo.nombre.trim(), unidad_medida: f.nuevo.unidad_medida.trim() || null, tipo_dato: f.nuevo.tipo_dato })).id_parametro
          : f.id_parametro);
      }
      return api.catalogos.crearTipoExamen({
        nombre: t.nombre.trim(), categoria: t.categoria.trim(), descripcion: t.descripcion.trim() || null, id_tipo_muestra,
        tiempo_entrega_horas: Number(t.tiempo_entrega_horas), precio: Number(t.precio),
        parametros: filas.map((f, i) => (tipoDe(f) === 'Texto'
          ? { id_parametro: ids[i], valor_ref_texto: f.texto.trim() || null, orden_presentacion: i + 1 }
          : { id_parametro: ids[i], valor_ref_min: numero(f.min), valor_ref_max: numero(f.max), orden_presentacion: i + 1 }))
      });
    });
    if (r) { notificar(`Tipo de examen «${t.nombre.trim()}» agregado`); setT(VACIO); setFilas([filaVacia()]); }
    // Se recarga también si falló a mitad: la muestra o los parámetros nuevos ya pueden existir.
    recargar();
  }

  const campo = (k, props = {}) => a => <input {...a} {...props} value={t[k]} onChange={e => setT({ ...t, [k]: e.target.value })} />;

  return (
    <div className="stack">
      <Card titulo="Tipos de examen">
        <DataTable titulo="Tipos de examen" vacio="Todavía no hay exámenes: créelos con el formulario" filas={examenes} claveFila={x => x.id_tipo_examen} columnas={[
          { clave: 'nombre', titulo: 'Examen', principal: true, render: x => <>{x.nombre}<div className="cell-sub">{x.categoria}</div></> },
          { clave: 'muestra', titulo: 'Muestra', render: x => x.tipo_muestra },
          { clave: 'parametros', titulo: 'Parámetros y rango normal', render: x => (
            <ul className="stack">{x.parametros.map(p => <li key={p.id_parametro}><b>{p.nombre}</b>: {referencia(p)}</li>)}</ul>) },
          { clave: 'entrega', titulo: 'Entrega', render: x => `${x.tiempo_entrega_horas} h` },
          { clave: 'precio', titulo: 'Precio (Q)', num: true, render: x => x.precio.toFixed(2) }
        ]} />
      </Card>
      {puede('catalogos.editar') && <Card titulo="Agregar tipo de examen" descripcion="Puede elegir muestras y parámetros existentes o crearlos aquí mismo.">
        <form onSubmit={enviar} className="stack">
          {envio.error && <Alerta>{envio.error.message}</Alerta>}
          <div className="form-grid">
          <FormField label="Nombre del examen" required>{campo('nombre', { maxLength: 120, placeholder: 'Hematología completa' })}</FormField>
          <FormField label="Categoría" required>{campo('categoria', { maxLength: 60, placeholder: 'Hematología' })}</FormField>
          <FormField label="Descripción" full>{campo('descripcion', { maxLength: 255 })}</FormField>
          </div>
          <FormField label="Muestra que necesita" required>{a => (
            <select {...a} value={t.id_tipo_muestra} onChange={e => setT({ ...t, id_tipo_muestra: e.target.value })}>
              <option value="">Seleccione…</option>
              {muestras.map(m => <option key={m.id_tipo_muestra} value={m.id_tipo_muestra}>{m.nombre}</option>)}
              <option value={NUEVO}>+ Crear muestra nueva…</option>
            </select>)}</FormField>
          {t.id_tipo_muestra === NUEVO && <FormField label="Nombre de la muestra nueva" required>{campo('muestra_nueva', { maxLength: 60, placeholder: 'Sangre' })}</FormField>}
          <div className="form-grid">
            <FormField label="Entrega (horas)" required>{campo('tiempo_entrega_horas', { type: 'number', min: 1, max: 8760 })}</FormField>
            <FormField label="Precio (Q)" required>{campo('precio', { type: 'number', min: 0, step: '0.01' })}</FormField>
          </div>
          <fieldset className="fieldset-plain">
            <legend>Parámetros que se miden, en orden</legend>
            <div className="sub-list">
              {filas.map((f, i) => {
                const tipo = tipoDe(f);
                return <div className="sub-item stack" key={i}>
                  <FormField label={`Parámetro ${i + 1}`}>{a => (
                    <select {...a} value={f.id_parametro} onChange={e => cambiar(i, { id_parametro: e.target.value })}>
                      <option value="">Seleccione…</option>
                      {parametros.map(p => <option key={p.id_parametro} value={p.id_parametro}>{p.nombre}{p.unidad_medida ? ` (${p.unidad_medida})` : ''}</option>)}
                      <option value={NUEVO}>+ Crear parámetro nuevo…</option>
                    </select>)}</FormField>
                  {f.id_parametro === NUEVO && <div className="form-grid">
                    <FormField label="Nombre" required>{a => <input {...a} maxLength={80} value={f.nuevo.nombre} onChange={e => cambiar(i, { nuevo: { ...f.nuevo, nombre: e.target.value } })} />}</FormField>
                    <FormField label="Unidad">{a => <input {...a} maxLength={20} placeholder="g/dL" value={f.nuevo.unidad_medida} onChange={e => cambiar(i, { nuevo: { ...f.nuevo, unidad_medida: e.target.value } })} />}</FormField>
                    <FormField label="Se registra como">{a => (
                      <select {...a} value={f.nuevo.tipo_dato} onChange={e => cambiar(i, { nuevo: { ...f.nuevo, tipo_dato: e.target.value } })}>
                        <option value="Numerico">Número</option><option value="Texto">Texto</option>
                      </select>)}</FormField>
                  </div>}
                  {tipo === 'Texto' && <FormField label="Valor esperado (normal)" hint="Por ejemplo: Amarillo, Negativo">{a => <input {...a} maxLength={80} value={f.texto} onChange={e => cambiar(i, { texto: e.target.value })} />}</FormField>}
                  {tipo === 'Numerico' && <div className="form-grid">
                    <FormField label="Mínimo normal">{a => <input {...a} type="number" step="any" value={f.min} onChange={e => cambiar(i, { min: e.target.value })} />}</FormField>
                    <FormField label="Máximo normal">{a => <input {...a} type="number" step="any" value={f.max} onChange={e => cambiar(i, { max: e.target.value })} />}</FormField>
                  </div>}
                  {filas.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => setFilas(fs => fs.filter((_, j) => j !== i))}>Quitar parámetro</button>}
                </div>;
              })}
            </div>
            <button type="button" className="btn btn-sm mt-2" onClick={() => setFilas([...filas, filaVacia()])}>+ Otro parámetro</button>
          </fieldset>
          <BotonEnviar enviando={envio.enviando}>Agregar tipo de examen</BotonEnviar>
        </form>
      </Card>}
    </div>
  );
}

const ACCIONES = ['CREAR_PACIENTE', 'ARCHIVAR_HISTORIAL', 'CREAR_SOLICITUD', 'REGISTRAR_RESULTADO', 'VALIDAR_RESULTADO', 'LEER_HISTORIAL',
  'LEER_HISTORIAL_ARCHIVADO', 'LEER_DATOS_PACIENTE', 'LEER_SOLICITUD', 'LEER_RESULTADO', 'LISTAR_PACIENTES', 'LISTAR_ARCHIVADOS',
  'LISTAR_SOLICITUDES', 'LISTAR_RESULTADOS', 'LEER_PANEL', 'ACCESO_DENEGADO', 'CREAR_TIPO_EXAMEN', 'CREAR_PARAMETRO',
  'CREAR_TIPO_MUESTRA', 'CREAR_MEDICO', 'CREAR_PERSONAL'];

function Bitacora() {
  const { api } = useModulo();
  const [f, setF] = useState({ id_paciente: '', accion: '' });
  const [aplicado, setAplicado] = useState(f);
  const { datos, cargando, error, recargar } = useCarga(() => api.auditoria({
    id_paciente: aplicado.id_paciente.trim() || undefined, accion: aplicado.accion || undefined, limite: 200
  }), [api, aplicado]);

  return (
    <>
      <PageHeader titulo="Bitácora de acceso" descripcion="Últimos 200 eventos: lecturas, cambios, validaciones y accesos denegados." />
      <MetricStrip items={[
        { etiqueta: 'Eventos visibles', valor: datos?.length, icono: 'auditoria' },
        { etiqueta: 'Denegados en esta vista', valor: datos?.filter(e => e.resultado === 'DENEGADO').length, icono: 'llave' },
        { etiqueta: 'Acción seleccionada', valor: aplicado.accion || 'Todas', icono: 'buscar' }
      ]} />
      <Card titulo="Registro de operaciones" icono="auditoria">
        <FilterBar etiqueta="Filtrar bitácora" onSubmit={() => setAplicado({ ...f })} resumen={datos && <span role="status">{datos.length} {datos.length === 1 ? 'evento' : 'eventos'}</span>}>
          <FormField label="Expediente">{a => <input {...a} value={f.id_paciente} inputMode="numeric" pattern="[0-9]*" maxLength={18} onChange={e => setF({ ...f, id_paciente: e.target.value })} />}</FormField>
          <FormField label="Acción">{a => (
            <select {...a} value={f.accion} onChange={e => setF({ ...f, accion: e.target.value })}>
              <option value="">Todas</option>{ACCIONES.map(x => <option key={x}>{x}</option>)}
            </select>)}
          </FormField>
          <button type="submit" className="btn btn-primary">Filtrar</button>
        </FilterBar>
        {cargando ? <LoadingState /> : error ? <ErrorState error={error} onReintentar={recargar} /> : (
          <DataTable titulo="Bitácora" vacio="Sin eventos" filas={datos} claveFila={e => e.id_evento} resaltar={e => e.resultado === 'DENEGADO'} columnas={[
            { clave: 'fecha', titulo: 'Fecha y hora', principal: true, render: e => fechaHora(e.fecha_hora) },
            { clave: 'usuario', titulo: 'Usuario', render: e => <>{e.usuario}<div className="cell-sub">{e.rol || 'base de datos'}</div></> },
            { clave: 'accion', titulo: 'Acción', render: e => <code>{e.accion}</code> },
            { clave: 'paciente', titulo: 'Expediente', render: e => e.id_paciente || '—' },
            { clave: 'resultado', titulo: 'Resultado', render: e => <StatusBadge tono={e.resultado === 'DENEGADO' ? 'bad' : 'ok'}>{e.resultado}</StatusBadge> },
            { clave: 'detalle', titulo: 'Detalle', render: e => e.detalle || e.recurso || '—' }
          ]} />)}
      </Card>
    </>
  );
}
