import { useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Alerta, BotonEnviar, Campo, Card, DataTable, Dialogo, KeyValue, StatusBadge, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import TutorCampos, { tutorParaApi, tutorVacio, validarTutor } from '../../componentes/TutorCampos.jsx';
import { edad, fecha, fechaHora, hoy } from '@plataforma/formato.js';

export default function Resumen({ paciente: p, recargar, editable }) {
  const { puede } = useSesion();
  const puedeEditar = editable && puede('pacientes.editar');
  const [editando, setEditando] = useState(false);
  const [tutor, setTutor] = useState(null); // {modo:'nuevo'|'editar', datos}
  const clinico = Array.isArray(p.consultas);
  const dosis = estado => (p.esquema_vacunacion || []).filter(d => d.estado === estado).length;
  const recetas = clinico ? p.consultas.reduce((n, c) => n + (c.prescripciones || []).length, 0) : 0;

  return (
    <>
      <div className={clinico ? 'grid grid-main' : 'grid'}>
        <Card titulo="Datos generales" descripcion="Información administrativa del historial."
          acciones={puedeEditar && <button type="button" className="btn btn-sm" onClick={() => setEditando(true)}>Editar datos</button>}>
          <KeyValue items={[
            ['Código', <code key="c">{p.id_paciente}</code>],
            ['Nombres', p.nombres],
            ['Apellidos', p.apellidos],
            ['Fecha de nacimiento', fecha(p.fecha_nacimiento)],
            ['Edad', edad(p.fecha_nacimiento)],
            ['Sexo', p.sexo === 'F' ? 'Femenino' : 'Masculino'],
            ['Estado', <StatusBadge key="e">{p.estado_historial}</StatusBadge>],
            ['Registrado', p.fecha_registro ? fechaHora(p.fecha_registro) : 'Antes de Fase II'],
            p.fecha_archivado && ['Archivado', fechaHora(p.fecha_archivado)]
          ]} />
        </Card>
        {clinico && (
          <Card titulo="Resumen clínico" descripcion="Totales de este historial; el detalle está en cada pestaña.">
            <KeyValue items={[
              ['Consultas', p.consultas.length],
              ['Prescripciones', recetas],
              ['Controles de crecimiento', p.controles_crecimiento.length],
              ['Dosis aplicadas', dosis('Aplicada')],
              ['Dosis pendientes', dosis('Pendiente')],
              ['Dosis canceladas', dosis('Cancelada')]
            ]} />
          </Card>
        )}
      </div>

      <Card titulo="Tutores / responsables" descripcion={puede('pacientes.editar') ? undefined : 'El DPI se muestra enmascarado: es un dato restringido que su rol no necesita.'}
        acciones={puedeEditar && <button type="button" className="btn btn-sm" onClick={() => setTutor({ modo: 'nuevo', datos: tutorVacio(false) })}>Agregar tutor</button>}>
        <DataTable titulo="Tutores" vacio="Sin tutores registrados" filas={p.tutores || []} claveFila={t => t.id_tutor} columnas={[
          { clave: 'nombre', titulo: 'Nombre', principal: true, render: t => <><b>{t.nombres} {t.apellidos}</b>{t.es_principal && <> <StatusBadge tono="info">Principal</StatusBadge></>}</> },
          { clave: 'parentesco', titulo: 'Parentesco' },
          { clave: 'dpi', titulo: 'DPI', render: t => <span className="tabular">{t.dpi}</span> },
          { clave: 'contacto', titulo: 'Contacto', render: t => <>{t.telefono || '—'}{t.correo && <div className="cell-sub">{t.correo}</div>}</> },
          { clave: 'direccion', titulo: 'Dirección', render: t => t.direccion || '—' },
          ...(puedeEditar ? [{ clave: 'acc', titulo: '', render: t => <button type="button" className="btn btn-sm" onClick={() => setTutor({ modo: 'editar', id: t.id_tutor, datos: { ...tutorVacio(), ...t } })} aria-label={`Editar tutor ${t.nombres} ${t.apellidos}`}>Editar</button> }] : [])
        ]} />
      </Card>

      <DialogoDatos abierto={editando} paciente={p} onCerrar={() => setEditando(false)} onHecho={() => { setEditando(false); recargar(); }} />
      <DialogoTutor estado={tutor} paciente={p} onCerrar={() => setTutor(null)} onHecho={() => { setTutor(null); recargar(); }} />
    </>
  );
}

function DialogoDatos({ abierto, paciente, onCerrar, onHecho }) {
  const { api } = useSesion();
  const notificar = useNotificar();
  const envio = useEnvio();
  const inicial = () => ({ nombres: paciente.nombres, apellidos: paciente.apellidos, fecha_nacimiento: String(paciente.fecha_nacimiento).slice(0, 10), sexo: paciente.sexo });
  const [f, setF] = useState(inicial);
  const [abiertoPrevio, setAbiertoPrevio] = useState(false);
  if (abierto !== abiertoPrevio) { setAbiertoPrevio(abierto); if (abierto) { setF(inicial()); envio.setError(null); } }

  async function enviar(e) {
    e.preventDefault();
    const cambios = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([k, v]) => v !== inicial()[k]));
    if (!Object.keys(cambios).length) return onCerrar();
    if (Object.values(cambios).some(v => !v)) return envio.setError(new Error('Los campos no pueden quedar vacíos'));
    const r = await envio.enviar(() => api.pacientes.actualizar(paciente.id_paciente, cambios));
    if (r) { notificar('Datos actualizados'); onHecho(); }
  }
  return (
    <Dialogo abierto={abierto} titulo="Editar datos generales" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        <div className="form-grid">
          <Campo label="Nombres" required>{a => <input {...a} value={f.nombres} onChange={e => setF({ ...f, nombres: e.target.value })} maxLength={255} />}</Campo>
          <Campo label="Apellidos" required>{a => <input {...a} value={f.apellidos} onChange={e => setF({ ...f, apellidos: e.target.value })} maxLength={255} />}</Campo>
          <Campo label="Fecha de nacimiento" required>{a => <input {...a} type="date" max={hoy()} value={f.fecha_nacimiento} onChange={e => setF({ ...f, fecha_nacimiento: e.target.value })} />}</Campo>
          <Campo label="Sexo" required>{a => <select {...a} value={f.sexo} onChange={e => setF({ ...f, sexo: e.target.value })}><option value="F">Femenino</option><option value="M">Masculino</option></select>}</Campo>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <BotonEnviar enviando={envio.enviando}>Guardar cambios</BotonEnviar>
        </div>
      </form>
    </Dialogo>
  );
}

function DialogoTutor({ estado, paciente, onCerrar, onHecho }) {
  const { api } = useSesion();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [t, setT] = useState(tutorVacio());
  const [errores, setErrores] = useState({});
  const [previo, setPrevio] = useState(null);
  if (estado !== previo) { setPrevio(estado); if (estado) { setT(estado.datos); setErrores({}); envio.setError(null); } }

  async function enviar(e) {
    e.preventDefault();
    const err = validarTutor(t);
    setErrores(err);
    if (Object.keys(err).length) return;
    const datos = tutorParaApi(t);
    const r = await envio.enviar(() => (estado.modo === 'nuevo'
      ? api.pacientes.agregarTutor(paciente.id_paciente, datos)
      : api.pacientes.actualizarTutor(paciente.id_paciente, estado.id, {
        ...datos, telefono: datos.telefono ?? null, correo: datos.correo ?? null, direccion: datos.direccion ?? null
      })));
    if (r) { notificar(estado.modo === 'nuevo' ? 'Tutor agregado' : 'Tutor actualizado'); onHecho(); }
  }
  return (
    <Dialogo abierto={!!estado} ancho titulo={estado?.modo === 'nuevo' ? 'Agregar tutor' : 'Editar tutor'} onCerrar={onCerrar}>
      <form onSubmit={enviar} noValidate>
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        <p className="meta mb-3">Si marca este tutor como responsable principal, el principal anterior dejará de serlo.</p>
        <TutorCampos valor={t} errores={errores} onChange={setT} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <BotonEnviar enviando={envio.enviando}>Guardar</BotonEnviar>
        </div>
      </form>
    </Dialogo>
  );
}
