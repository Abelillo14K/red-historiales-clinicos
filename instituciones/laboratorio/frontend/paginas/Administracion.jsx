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

// Cada catálogo: columnas del listado y campos del alta (solo con catalogos.editar).
const CATALOGOS = {
  muestras: {
    titulo: 'Tipos de muestra', cargar: api => api.catalogos.tiposMuestra(), crear: (api, d) => api.catalogos.crearTipoMuestra(d), clave: 'id_tipo_muestra',
    columnas: [['nombre', 'Nombre']], campos: [['nombre', 'Nombre', { required: true, maxLength: 60 }]]
  },
  parametros: {
    titulo: 'Parámetros', cargar: api => api.catalogos.parametros(), crear: (api, d) => api.catalogos.crearParametro(d), clave: 'id_parametro',
    columnas: [['nombre', 'Nombre'], ['unidad_medida', 'Unidad'], ['tipo_dato', 'Tipo de dato']],
    campos: [['nombre', 'Nombre', { required: true, maxLength: 80 }], ['unidad_medida', 'Unidad de medida', { maxLength: 20 }],
      ['tipo_dato', 'Tipo de dato', { required: true, opciones: [['Numerico', 'Numérico'], ['Texto', 'Texto']] }]]
  },
  medicos: {
    titulo: 'Médicos solicitantes', cargar: api => api.catalogos.medicos(), crear: (api, d) => api.catalogos.crearMedico(d), clave: 'id_medico',
    columnas: [['nombre_completo', 'Nombre'], ['numero_colegiado', 'Colegiado'], ['institucion_procedencia', 'Institución'], ['telefono_contacto', 'Teléfono']],
    campos: [['nombre_completo', 'Nombre completo', { required: true, maxLength: 150 }], ['numero_colegiado', 'Número de colegiado', { required: true, maxLength: 20 }],
      ['institucion_procedencia', 'Institución de procedencia', { maxLength: 150 }], ['telefono_contacto', 'Teléfono', { maxLength: 20 }]]
  },
  personal: {
    titulo: 'Personal del laboratorio', cargar: api => api.catalogos.personal(), crear: (api, d) => api.catalogos.crearPersonal(d), clave: 'id_personal',
    columnas: [['nombres', 'Nombres'], ['apellidos', 'Apellidos'], ['cargo', 'Cargo'], ['usuario', 'Usuario'], ['numero_colegiado', 'Colegiado']],
    campos: [['nombres', 'Nombres', { required: true, maxLength: 120 }], ['apellidos', 'Apellidos', { required: true, maxLength: 120 }],
      ['cargo', 'Cargo', { required: true, opciones: [['Tecnico', 'Técnico'], ['Bioquimico', 'Bioquímico'], ['Patologo', 'Patólogo']] }],
      ['usuario', 'Usuario (el mismo de su sesión)', { required: true, maxLength: 80 }], ['numero_colegiado', 'Número de colegiado', { maxLength: 20 }]],
    nota: 'Para validar resultados, el usuario de la sesión debe estar registrado aquí como personal activo.'
  }
};

function Catalogos() {
  const [actual, setActual] = useState('examenes');
  const pestanas = [{ clave: 'examenes', titulo: 'Tipos de examen' }, ...Object.entries(CATALOGOS).map(([clave, c]) => ({ clave, titulo: c.titulo }))];
  return (
    <>
      <PageHeader titulo="Catálogos" descripcion="Tipos de examen con sus parámetros y rangos de referencia, muestras, médicos y personal." />
      <Tabs etiqueta="Catálogos del laboratorio" actual={actual} pestanas={pestanas} onCambiar={setActual} />
      <div role="tabpanel" aria-label={pestanas.find(p => p.clave === actual).titulo}>
        {actual === 'examenes' ? <TiposExamen /> : <CatalogoSimple key={actual} def={CATALOGOS[actual]} />}
      </div>
    </>
  );
}

function CatalogoSimple({ def }) {
  const { api, puede } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const lista = useCarga(() => def.cargar(api), [api, def]);
  const vacio = () => Object.fromEntries(def.campos.map(([k]) => [k, '']));
  const [d, setD] = useState(vacio);

  async function enviar(e) {
    e.preventDefault();
    const datos = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim() || null]));
    if (await envio.enviar(() => def.crear(api, datos))) { notificar(`${def.titulo}: registro agregado`); setD(vacio()); lista.recargar(); }
  }

  return (
    <div className="grid grid-main">
      <Card titulo={def.titulo}>
        <ErrorState error={lista.error} onReintentar={lista.recargar} />
        {lista.cargando ? <LoadingState compacto /> : lista.datos && (
          <DataTable titulo={def.titulo} vacio="Sin registros todavía" filas={lista.datos} claveFila={f => f[def.clave]}
            columnas={def.columnas.map(([clave, titulo], i) => ({ clave, titulo, principal: i === 0, render: f => f[clave] ?? '—' }))} />)}
      </Card>
      {puede('catalogos.editar') && <Card titulo="Agregar">
        {def.nota && <p className="meta">{def.nota}</p>}
        <form onSubmit={enviar} className="stack">
          {envio.error && <Alerta>{envio.error.message}</Alerta>}
          {def.campos.map(([k, etiqueta, { opciones, ...props }]) => (
            <FormField key={k} label={etiqueta} required={props.required}>{a => (opciones
              ? <select {...a} value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })}>
                <option value="">Seleccione…</option>{opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              : <input {...a} {...props} value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })} />)}
            </FormField>
          ))}
          <BotonEnviar enviando={envio.enviando}>Agregar</BotonEnviar>
        </form>
      </Card>}
    </div>
  );
}

// Un tipo de examen define su estructura de resultado: parámetros, orden y referencia de cada uno.
function TiposExamen() {
  const { api, puede } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const datos = useCarga(() => Promise.all([api.catalogos.tiposExamen(), api.catalogos.parametros(), api.catalogos.tiposMuestra()]), [api]);
  const [elegido, setElegido] = useState(null);
  const detalle = useCarga(() => (elegido ? api.catalogos.tipoExamen(elegido) : Promise.resolve(null)), [api, elegido]);
  const VACIO = { nombre: '', categoria: '', descripcion: '', id_tipo_muestra: '', tiempo_entrega_horas: '24', precio: '0' };
  const [t, setT] = useState(VACIO);
  const [params, setParams] = useState([]);

  if (datos.cargando) return <LoadingState />;
  if (datos.error) return <ErrorState error={datos.error} onReintentar={datos.recargar} />;
  const [tipos, parametros, muestras] = datos.datos;
  const porId = new Map(parametros.map(p => [p.id_parametro, p]));
  const numero = v => (v === '' ? null : Number(v));

  async function enviar(e) {
    e.preventDefault();
    const r = await envio.enviar(() => api.catalogos.crearTipoExamen({
      nombre: t.nombre.trim(), categoria: t.categoria.trim(), descripcion: t.descripcion.trim() || null, id_tipo_muestra: t.id_tipo_muestra,
      tiempo_entrega_horas: Number(t.tiempo_entrega_horas), precio: Number(t.precio),
      parametros: params.map((p, i) => porId.get(p.id_parametro)?.tipo_dato === 'Texto'
        ? { id_parametro: p.id_parametro, valor_ref_texto: p.texto.trim() || null, orden_presentacion: i + 1 }
        : { id_parametro: p.id_parametro, valor_ref_min: numero(p.min), valor_ref_max: numero(p.max), orden_presentacion: i + 1 })
    }));
    if (r) { notificar('Tipo de examen agregado'); setT(VACIO); setParams([]); datos.recargar(); }
  }

  const campo = (k, props = {}) => a => <input {...a} {...props} value={t[k]} onChange={e => setT({ ...t, [k]: e.target.value })} />;
  const cambiar = (i, k, v) => setParams(ps => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  return (
    <div className="grid grid-main">
      <div className="stack">
        <Card titulo="Tipos de examen">
          <DataTable titulo="Tipos de examen" vacio="Sin tipos de examen todavía" filas={tipos} claveFila={x => x.id_tipo_examen} columnas={[
            { clave: 'nombre', titulo: 'Examen', principal: true, render: x => <button type="button" className="btn btn-sm" onClick={() => setElegido(x.id_tipo_examen)}>{x.nombre}</button> },
            { clave: 'categoria', titulo: 'Categoría' }, { clave: 'tipo_muestra', titulo: 'Muestra' },
            { clave: 'tiempo', titulo: 'Entrega', render: x => `${x.tiempo_entrega_horas} h` },
            { clave: 'precio', titulo: 'Precio (Q)', num: true, render: x => x.precio.toFixed(2) },
            { clave: 'activo', titulo: 'Estado', render: x => <StatusBadge tono={x.activo ? 'ok' : 'warn'}>{x.activo ? 'Activo' : 'Inactivo'}</StatusBadge> }
          ]} />
        </Card>
        {elegido && <Card titulo={detalle.datos ? `Parámetros de ${detalle.datos.nombre}` : 'Parámetros'}>
          {detalle.cargando ? <LoadingState compacto /> : detalle.datos && <DataTable titulo="Parámetros del examen" filas={detalle.datos.parametros} claveFila={p => p.id_parametro} columnas={[
            { clave: 'orden', titulo: 'Orden', num: true, render: p => p.orden_presentacion },
            { clave: 'nombre', titulo: 'Parámetro', principal: true }, { clave: 'tipo_dato', titulo: 'Tipo' },
            { clave: 'ref', titulo: 'Referencia', render: p => referencia(p) }
          ]} />}
        </Card>}
      </div>
      {puede('catalogos.editar') && <Card titulo="Agregar tipo de examen">
        {(!parametros.length || !muestras.length) && <p className="meta">Primero registre al menos un tipo de muestra y un parámetro.</p>}
        <form onSubmit={enviar} className="stack">
          {envio.error && <Alerta>{envio.error.message}</Alerta>}
          <FormField label="Nombre" required>{campo('nombre', { maxLength: 120 })}</FormField>
          <FormField label="Categoría" required>{campo('categoria', { maxLength: 60 })}</FormField>
          <FormField label="Descripción">{campo('descripcion', { maxLength: 255 })}</FormField>
          <FormField label="Tipo de muestra" required>{a => (
            <select {...a} value={t.id_tipo_muestra} onChange={e => setT({ ...t, id_tipo_muestra: e.target.value })}>
              <option value="">Seleccione…</option>{muestras.map(m => <option key={m.id_tipo_muestra} value={m.id_tipo_muestra}>{m.nombre}</option>)}
            </select>)}</FormField>
          <FormField label="Tiempo de entrega (horas)" required>{campo('tiempo_entrega_horas', { type: 'number', min: 1, max: 8760 })}</FormField>
          <FormField label="Precio (Q)" required>{campo('precio', { type: 'number', min: 0, step: '0.01' })}</FormField>
          <fieldset className="fieldset-plain">
            <legend>Parámetros, en orden de presentación</legend>
            <div className="sub-list">
              {params.map((p, i) => {
                const def = porId.get(p.id_parametro);
                return <div className="sub-item" key={i}>
                  <FormField label={`Parámetro ${i + 1}`}>{a => (
                    <select {...a} value={p.id_parametro} onChange={e => cambiar(i, 'id_parametro', e.target.value)}>
                      <option value="">Seleccione…</option>
                      {parametros.map(x => <option key={x.id_parametro} value={x.id_parametro}>{x.nombre}{x.unidad_medida ? ` (${x.unidad_medida})` : ''}</option>)}
                    </select>)}</FormField>
                  {def?.tipo_dato === 'Texto'
                    ? <FormField label="Referencia de texto">{a => <input {...a} maxLength={80} value={p.texto} onChange={e => cambiar(i, 'texto', e.target.value)} />}</FormField>
                    : def && <div className="form-grid">
                      <FormField label="Mínimo de referencia">{a => <input {...a} type="number" step="any" value={p.min} onChange={e => cambiar(i, 'min', e.target.value)} />}</FormField>
                      <FormField label="Máximo de referencia">{a => <input {...a} type="number" step="any" value={p.max} onChange={e => cambiar(i, 'max', e.target.value)} />}</FormField>
                    </div>}
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setParams(ps => ps.filter((_, j) => j !== i))}>Quitar</button>
                </div>;
              })}
            </div>
            <button type="button" className="btn btn-sm mt-2" disabled={!parametros.length} onClick={() => setParams([...params, { id_parametro: '', min: '', max: '', texto: '' }])}>Agregar parámetro</button>
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
