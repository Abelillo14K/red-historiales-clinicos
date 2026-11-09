import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, DataTable, ErrorState, FilterBar, FormField, LoadingState, MetricStrip, PageHeader, StatusBadge, Tabs, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';

// Una página para dos rutas del manifiesto: /catalogos y /bitacora.
export default function Administracion() {
  const { pathname } = useLocation();
  return pathname.endsWith('/bitacora') ? <Bitacora /> : <Catalogos />;
}

// Cada catálogo: para qué sirve, columnas y campos del alta. El colegiado y el código son el id del
// documento en Firestore, por eso no pueden repetirse ni cambiarse.
const CATALOGOS = {
  odontologos: {
    titulo: 'Odontólogos', clave: 'id_odontologo', aviso: 'Odontólogo agregado',
    descripcion: 'Quién atiende. Se elige al registrar una consulta y al programar una cita.',
    cargar: api => api.catalogos.odontologos(), crear: (api, d) => api.catalogos.crearOdontologo(d),
    columnas: [
      { clave: 'nombre', titulo: 'Odontólogo', principal: true, render: o => `${o.nombres} ${o.apellidos}` },
      { clave: 'colegiado', titulo: 'Colegiado', render: o => <code>{o.colegiado}</code> },
      { clave: 'especialidad', titulo: 'Especialidad', render: o => o.especialidad || '—' },
      { clave: 'activo', titulo: 'Estado', render: o => <StatusBadge tono={o.activo ? 'ok' : 'warn'}>{o.activo ? 'Activo' : 'Inactivo'}</StatusBadge> }
    ],
    campos: [['colegiado', 'Número de colegiado', { required: true, maxLength: 20, hint: 'Letras, números y guion; no se puede repetir' }],
      ['nombres', 'Nombres', { required: true, maxLength: 120 }], ['apellidos', 'Apellidos', { required: true, maxLength: 120 }],
      ['especialidad', 'Especialidad', { maxLength: 120, placeholder: 'General, Endodoncia, Ortodoncia…' }], ['telefono', 'Teléfono', { maxLength: 20 }]]
  },
  procedimientos: {
    titulo: 'Procedimientos', clave: 'id_procedimiento', aviso: 'Procedimiento agregado',
    descripcion: 'Tratamientos que ofrece la clínica. Se eligen al registrar el tratamiento de una pieza.',
    cargar: api => api.catalogos.procedimientos(), crear: (api, d) => api.catalogos.crearProcedimiento({ ...d, precio: Number(d.precio || 0) }),
    columnas: [
      { clave: 'codigo', titulo: 'Código', principal: true, render: p => <code>{p.codigo}</code> },
      { clave: 'nombre', titulo: 'Procedimiento' }, { clave: 'descripcion', titulo: 'Descripción', render: p => p.descripcion || '—' },
      { clave: 'precio', titulo: 'Precio (Q)', num: true, render: p => Number(p.precio).toFixed(2) }
    ],
    campos: [['codigo', 'Código', { required: true, maxLength: 20, hint: 'Por ejemplo, D-100; no se puede repetir' }],
      ['nombre', 'Nombre', { required: true, maxLength: 150, placeholder: 'Obturación con resina' }],
      ['descripcion', 'Descripción', { maxLength: 300 }], ['precio', 'Precio (Q)', { type: 'number', min: 0, step: '0.01', required: true }]]
  }
};

function Catalogos() {
  const [actual, setActual] = useState('odontologos');
  const def = CATALOGOS[actual];
  return (
    <>
      <PageHeader titulo="Catálogos" descripcion="Odontólogos y procedimientos de la clínica. Se usan en consultas, tratamientos y citas." />
      <Tabs etiqueta="Catálogos de la clínica" actual={actual} onCambiar={setActual}
        pestanas={Object.entries(CATALOGOS).map(([clave, c], i) => ({ clave, titulo: `${i + 1}. ${c.titulo}` }))} />
      <div role="tabpanel" aria-label={def.titulo}>
        <p className="meta mt-2">{def.descripcion}</p>
        <Catalogo key={actual} def={def} />
      </div>
    </>
  );
}

function Catalogo({ def }) {
  const { api, puede } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const lista = useCarga(() => def.cargar(api), [api, def]);
  const vacio = () => Object.fromEntries(def.campos.map(([k]) => [k, '']));
  const [d, setD] = useState(vacio);

  async function enviar(e) {
    e.preventDefault();
    const datos = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim() || null]));
    if (await envio.enviar(() => def.crear(api, datos))) { notificar(def.aviso); setD(vacio()); lista.recargar(); }
  }

  return (
    <div className="grid grid-main">
      <Card titulo={def.titulo}>
        <ErrorState error={lista.error} onReintentar={lista.recargar} />
        {lista.cargando ? <LoadingState compacto /> : lista.datos && <DataTable titulo={def.titulo} vacio="Sin registros todavía" filas={lista.datos} claveFila={f => f[def.clave]} columnas={def.columnas} />}
      </Card>
      {puede('catalogos.editar') && <Card titulo="Agregar">
        <form onSubmit={enviar} className="stack">
          {envio.error && <Alerta>{envio.error.message}</Alerta>}
          {def.campos.map(([k, etiqueta, { hint, ...props }]) => (
            <FormField key={k} label={etiqueta} required={props.required} hint={hint}>{a => <input {...a} {...props} value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })} />}</FormField>
          ))}
          <BotonEnviar enviando={envio.enviando}>Agregar</BotonEnviar>
        </form>
      </Card>}
    </div>
  );
}

const ACCIONES = ['CREAR_PACIENTE', 'ARCHIVAR_HISTORIAL', 'REGISTRAR_CONSULTA', 'AGREGAR_DIAGNOSTICO', 'AGREGAR_TRATAMIENTO', 'REGISTRAR_PRESCRIPCION',
  'ACTUALIZAR_PIEZA', 'PROGRAMAR_CITA', 'CAMBIAR_ESTADO_CITA', 'LEER_HISTORIAL', 'LEER_HISTORIAL_ARCHIVADO', 'LEER_DATOS_PACIENTE', 'LEER_CONSULTAS',
  'LEER_PRESCRIPCIONES', 'LISTAR_PACIENTES', 'LISTAR_ARCHIVADOS', 'LISTAR_CITAS', 'LEER_PANEL', 'ACCESO_DENEGADO', 'CREAR_ODONTOLOGO', 'CREAR_PROCEDIMIENTO'];

function Bitacora() {
  const { api } = useModulo();
  const [f, setF] = useState({ id_paciente: '', accion: '' });
  const [aplicado, setAplicado] = useState(f);
  const { datos, cargando, error, recargar } = useCarga(() => api.auditoria({
    id_paciente: aplicado.id_paciente.trim().toUpperCase() || undefined, accion: aplicado.accion || undefined, limite: 200
  }), [api, aplicado]);

  return (
    <>
      <PageHeader titulo="Bitácora de acceso" descripcion="Últimos 200 eventos: lecturas, cambios y accesos denegados." />
      <MetricStrip items={[
        { etiqueta: 'Eventos visibles', valor: datos?.length, icono: 'auditoria' },
        { etiqueta: 'Denegados en esta vista', valor: datos?.filter(e => e.resultado === 'DENEGADO').length, icono: 'llave' },
        { etiqueta: 'Acción seleccionada', valor: aplicado.accion || 'Todas', icono: 'buscar' }
      ]} />
      <Card titulo="Registro de operaciones" icono="auditoria">
        <FilterBar etiqueta="Filtrar bitácora" onSubmit={() => setAplicado({ ...f })} resumen={datos && <span role="status">{datos.length} {datos.length === 1 ? 'evento' : 'eventos'}</span>}>
          <FormField label="Expediente">{a => <input {...a} value={f.id_paciente} maxLength={20} placeholder="OD000001" onChange={e => setF({ ...f, id_paciente: e.target.value })} />}</FormField>
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
            { clave: 'usuario', titulo: 'Usuario', render: e => <>{e.usuario}<div className="cell-sub">{e.rol}</div></> },
            { clave: 'accion', titulo: 'Acción', render: e => <code>{e.accion}</code> },
            { clave: 'paciente', titulo: 'Expediente', render: e => e.id_paciente || '—' },
            { clave: 'resultado', titulo: 'Resultado', render: e => <StatusBadge tono={e.resultado === 'DENEGADO' ? 'bad' : 'ok'}>{e.resultado}</StatusBadge> },
            { clave: 'detalle', titulo: 'Detalle', render: e => e.detalle || e.recurso || '—' }
          ]} />)}
      </Card>
    </>
  );
}
