import { useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, Card, DataTable, ErrorState, FilterBar, FormField, LoadingState, PageHeader, SearchBar, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';

const DEFS = {
  departamentos: {
    titulo: 'Departamentos',
    columnas: [['id_departamento', 'ID'], ['nombre_departamento', 'Nombre'], ['ubicacion', 'Ubicación'], ['extension_telefono', 'Extensión']],
    campos: [{ k: 'nombre_departamento', label: 'Nombre', req: true }, { k: 'ubicacion', label: 'Ubicación' }, { k: 'extension_telefono', label: 'Extensión' }]
  },
  especialidades: {
    titulo: 'Especialidades',
    columnas: [['id_especialidad', 'ID'], ['nombre_especialidad', 'Nombre'], ['descripcion', 'Descripción']],
    campos: [{ k: 'nombre_especialidad', label: 'Nombre', req: true }, { k: 'descripcion', label: 'Descripción', full: true }]
  },
  seguros: {
    titulo: 'Aseguradoras',
    columnas: [['id_seguro', 'ID'], ['nombre_aseguradora', 'Aseguradora'], ['telefono_contacto', 'Teléfono'], ['direccion', 'Dirección']],
    campos: [{ k: 'nombre_aseguradora', label: 'Aseguradora', req: true }, { k: 'telefono_contacto', label: 'Teléfono' }, { k: 'direccion', label: 'Dirección', full: true }]
  },
  diagnosticos: {
    titulo: 'Diagnósticos CIE-10',
    columnas: [['codigo_cie10', 'Código'], ['nombre_diagnostico', 'Diagnóstico'], ['descripcion', 'Descripción']],
    campos: [{ k: 'codigo_cie10', label: 'Código CIE-10', req: true }, { k: 'nombre_diagnostico', label: 'Nombre', req: true }, { k: 'descripcion', label: 'Descripción', full: true }]
  },
  medicamentos: {
    titulo: 'Medicamentos',
    columnas: [['id_medicamento', 'ID'], ['nombre_generico', 'Genérico'], ['nombre_comercial', 'Comercial'], ['presentacion', 'Presentación'], ['concentracion', 'Concentración'], ['via_administracion', 'Vía']],
    campos: [{ k: 'nombre_generico', label: 'Nombre genérico', req: true }, { k: 'nombre_comercial', label: 'Nombre comercial' }, { k: 'presentacion', label: 'Presentación' }, { k: 'concentracion', label: 'Concentración' }, { k: 'via_administracion', label: 'Vía de administración' }]
  },
  examenes: {
    titulo: 'Exámenes',
    columnas: [['id_examen', 'ID'], ['nombre_examen', 'Examen'], ['tipo_examen', 'Tipo'], ['unidad_medida', 'Unidad'], ['valor_referencia', 'Referencia']],
    campos: [{ k: 'nombre_examen', label: 'Nombre', req: true }, { k: 'tipo_examen', label: 'Tipo' }, { k: 'unidad_medida', label: 'Unidad' }, { k: 'valor_referencia', label: 'Valor de referencia' }]
  },
  alergias: {
    titulo: 'Alergias',
    columnas: [['id_alergia', 'ID'], ['nombre_alergia', 'Alergia'], ['tipo', 'Tipo']],
    campos: [{ k: 'nombre_alergia', label: 'Nombre', req: true }, { k: 'tipo', label: 'Tipo' }]
  },
  profesionales: {
    titulo: 'Profesionales',
    columnas: [['id_medico', 'ID'], ['colegiado', 'Colegiado'], ['primer_nombre', 'Primer nombre'], ['primer_apellido', 'Primer apellido'], ['id_especialidad', 'Especialidad'], ['id_departamento', 'Departamento'], ['estado', 'Estado']],
    campos: [
      { k: 'colegiado', label: 'Colegiado', req: true },
      { k: 'primer_nombre', label: 'Primer nombre', req: true },
      { k: 'segundo_nombre', label: 'Segundo nombre' },
      { k: 'primer_apellido', label: 'Primer apellido', req: true },
      { k: 'segundo_apellido', label: 'Segundo apellido' },
      { k: 'id_especialidad', label: 'Especialidad', req: true, catalogo: 'especialidades' },
      { k: 'id_departamento', label: 'Departamento', req: true, catalogo: 'departamentos' },
      { k: 'telefono', label: 'Teléfono' },
      { k: 'correo', label: 'Correo electrónico' },
      { k: 'estado', label: 'Estado', opciones: ['Activo', 'Inactivo'] }
    ]
  }
};

const PK = {
  departamentos: 'id_departamento', especialidades: 'id_especialidad', seguros: 'id_seguro',
  diagnosticos: 'id_diagnostico', medicamentos: 'id_medicamento', examenes: 'id_examen',
  alergias: 'id_alergia', profesionales: 'id_medico'
};
const CLAVES = { especialidades: 'id_especialidad', departamentos: 'id_departamento' };
const ETIQUETAS = { especialidades: 'nombre_especialidad', departamentos: 'nombre_departamento' };

export default function Catalogos() {
  const { api, puede } = useSesion();
  const editar = puede('catalogos.editar');
  const notificar = useNotificar();
  const envio = useEnvio();
  const nombres = useCarga(() => api.catalogos.nombres(), [api]);
  const aux = useCarga(() => Promise.all([api.catalogos.listar('especialidades', { limite: 500 }), api.catalogos.listar('departamentos', { limite: 500 })]), [api]);
  const [nombre, setNombre] = useState('diagnosticos');
  const [texto, setTexto] = useState('');
  const [aplicado, setAplicado] = useState('');
  const lista = useCarga(() => api.catalogos.listar(nombre, { q: aplicado || undefined, limite: 500 }), [api, nombre, aplicado]);
  const [form, setForm] = useState({});
  const [editando, setEditando] = useState(null);
  const [errores, setErrores] = useState({});
  const def = DEFS[nombre];

  function cambiarNombre(n) {
    setNombre(n); setTexto(''); setAplicado(''); setForm({}); setEditando(null); setErrores({});
  }

  function nuevo() {
    const vacio = {};
    for (const c of def.campos) vacio[c.k] = c.k === 'estado' ? 'Activo' : '';
    setForm(vacio); setEditando(null); setErrores({});
  }

  function editarFila(fila) {
    const valores = {};
    for (const c of def.campos) valores[c.k] = fila[c.k] == null ? '' : String(fila[c.k]);
    setForm(valores); setEditando(fila[PK[nombre]] ?? null); setErrores({});
  }

  function validar() {
    const e = {};
    for (const c of def.campos) if (c.req && !String(form[c.k] ?? '').trim()) e[c.k] = 'Obligatorio';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const cuerpo = {};
    for (const c of def.campos) {
      const v = form[c.k] ?? '';
      cuerpo[c.k] = typeof v === 'string' ? v.trim() : v;
    }
    const r = await envio.enviar(() => editando
      ? api.catalogos.actualizar(nombre, editando, cuerpo)
      : api.catalogos.crear(nombre, cuerpo));
    if (r) {
      notificar(editando ? 'Registro actualizado' : 'Registro creado');
      setForm({}); setEditando(null); lista.recargar();
    }
  }

  const opciones = c => c.opciones
    ? c.opciones.map(x => ({ value: x, label: x }))
    : (aux.datos?.[c.catalogo === 'especialidades' ? 0 : 1]?.items || []).map(x => ({ value: x[CLAVES[c.catalogo]], label: x[ETIQUETAS[c.catalogo]] }));

  return (
    <>
      <PageHeader titulo="Catálogos" descripcion="Datos de referencia para el registro y la atención del paciente." />
      <ErrorState error={nombres.error || aux.error || lista.error} onReintentar={() => { nombres.recargar(); aux.recargar(); lista.recargar(); }} />
      {nombres.cargando ? <LoadingState /> : (
        <>
          <Card titulo="Catálogo" icono="consulta">
            <div className="filter-bar">
              <div className="filter-fields">
                <FormField label="Catálogo">{a => (
                  <select {...a} value={nombre} onChange={e => cambiarNombre(e.target.value)}>
                    {(nombres.datos?.catalogos || Object.keys(DEFS)).map(n => <option key={n} value={n}>{DEFS[n]?.titulo || n}</option>)}
                  </select>)}</FormField>
              </div>
            </div>
            <FilterBar etiqueta="Buscar en catálogo" onSubmit={() => setAplicado(texto)}
              resumen={lista.datos && <span role="status">{lista.datos.total} registro(s)</span>}>
              <SearchBar label="Buscar" value={texto} onChange={setTexto} placeholder="Código o nombre" />
              <button type="submit" className="btn btn-primary">Buscar</button>
              {editar && <button type="button" className="btn" onClick={nuevo}>Nuevo registro</button>}
            </FilterBar>
            {lista.cargando ? <LoadingState /> : (
              <DataTable titulo={def.titulo} vacio="Sin registros" claveFila={f => f[PK[nombre]] ?? f.codigo_cie10}
                filas={lista.datos?.items || []} columnas={[
                  ...def.columnas.map(([clave, titulo]) => ({ clave, titulo })),
                  ...(editar ? [{ clave: 'acciones', titulo: 'Acciones', render: f => <button type="button" className="btn btn-sm" onClick={() => editarFila(f)}>Editar</button> }] : [])
                ]} />
            )}
          </Card>
          {editar && (
            <Card titulo={editando ? 'Editar registro' : 'Nuevo registro'} icono="mas">
              <form onSubmit={guardar} noValidate>
                {envio.error && <Alerta titulo="No se pudo guardar">{envio.error.message}</Alerta>}
                {Object.keys(errores).length > 0 && <Alerta>Revise los campos marcados.</Alerta>}
                <div className="form-grid">
                  {def.campos.map(c => (
                    <FormField key={c.k} label={c.label} error={errores[c.k]} required={c.req} full={c.full}>
                      {a => c.opciones || c.catalogo
                        ? <select {...a} value={form[c.k] ?? ''} onChange={e => setForm({ ...form, [c.k]: e.target.value })}>
                            <option value="">Seleccione…</option>
                            {opciones(c).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        : c.full
                          ? <textarea {...a} rows={3} value={form[c.k] ?? ''} onChange={e => setForm({ ...form, [c.k]: e.target.value })} />
                          : <input {...a} value={form[c.k] ?? ''} onChange={e => setForm({ ...form, [c.k]: e.target.value })} />}
                    </FormField>
                  ))}
                </div>
                <div className="form-actions">
                  <BotonEnviar enviando={envio.enviando} className="btn btn-primary">{editando ? 'Guardar cambios' : 'Crear registro'}</BotonEnviar>
                  {editando && <button type="button" className="btn" onClick={nuevo}>Cancelar edición</button>}
                </div>
              </form>
            </Card>
          )}
        </>
      )}
    </>
  );
}
