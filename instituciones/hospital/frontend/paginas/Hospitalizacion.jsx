import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, BotonEnviar, Card, DataTable, Dialogo, ErrorState, FormField, LoadingState, MetricStrip, PageHeader, StatusBadge, useCarga, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import BuscadorPaciente from '../componentes/BuscadorPaciente.jsx';

const nombreMedico = m => [m.primer_nombre, m.segundo_nombre, m.primer_apellido, m.segundo_apellido].filter(Boolean).join(' ');

export default function Hospitalizacion() {
  const { api, puede } = useSesion();
  const { enlace } = useModulo();
  const notificar = useNotificar();
  const envio = useEnvio();
  const gestionar = puede('hospital.hospitalizacion.gestionar');
  const datos = useCarga(() => Promise.all([
    api.hospitalizacion.listar({ estado: 'todas', limite: 100 }),
    api.hospitalizacion.disponibilidad(),
    api.hospitalizacion.camas({ estado: 'Disponible' }),
    api.catalogos.listar('profesionales', { limite: 500 })
  ]), [api]);
  const [nuevo, setNuevo] = useState({ id_paciente: '', id_cama: '', id_medico_tratante: '', motivo_ingreso: '', diagnostico_ingreso: '' });
  const [errores, setErrores] = useState({});
  const [egreso, setEgreso] = useState(null);

  if (datos.cargando) return <LoadingState texto="Cargando hospitalización…" />;
  if (datos.error) return <ErrorState error={datos.error} onReintentar={datos.recargar} />;

  const [lista, disponibilidad, camas, profesionales] = datos.datos;
  const medicos = profesionales.items.filter(m => m.estado === 'Activo');
  const activas = lista.items.filter(h => h.estado === 'Activa');
  const disponibles = camas.items.length;

  function validar() {
    const e = {};
    if (!nuevo.id_paciente) e.id_paciente = 'Seleccione el paciente';
    if (!nuevo.id_cama) e.id_cama = 'Seleccione una cama disponible';
    if (!nuevo.id_medico_tratante) e.id_medico_tratante = 'Seleccione el médico tratante';
    if (!nuevo.motivo_ingreso.trim()) e.motivo_ingreso = 'Indique el motivo de ingreso';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function ingresar(ev) {
    ev.preventDefault();
    if (!validar()) return;
    const r = await envio.enviar(() => api.hospitalizacion.ingresar({
      id_paciente: Number(nuevo.id_paciente),
      id_cama: Number(nuevo.id_cama),
      id_medico_tratante: Number(nuevo.id_medico_tratante),
      motivo_ingreso: nuevo.motivo_ingreso.trim(),
      diagnostico_ingreso: nuevo.diagnostico_ingreso.trim()
    }));
    if (r) {
      notificar(`Ingreso ${r.id_hospitalizacion} registrado`);
      setNuevo({ id_paciente: '', id_cama: '', id_medico_tratante: '', motivo_ingreso: '', diagnostico_ingreso: '' });
      datos.recargar();
    }
  }

  const columnas = [
    { clave: 'paciente', titulo: 'Paciente', principal: true, render: h => <Link className="row-link" to={enlace(`/pacientes/${h.id_paciente}`)}>{h.paciente}</Link> },
    { clave: 'ingreso', titulo: 'Ingreso', render: h => fechaHora(h.ingreso) },
    { clave: 'servicio', titulo: 'Servicio' },
    { clave: 'cama', titulo: 'Cama' },
    { clave: 'medico_tratante', titulo: 'Médico tratante' },
    { clave: 'estado', titulo: 'Estado', render: h => <StatusBadge tono={h.estado === 'Activa' ? 'info' : 'ok'}>{h.estado}</StatusBadge> }
  ];
  if (gestionar) columnas.push({ clave: 'accion', titulo: 'Acción', render: h => h.estado === 'Activa'
    ? <button type="button" className="btn btn-sm btn-primary" onClick={() => setEgreso(h)}>Registrar egreso</button>
    : <span className="meta">{h.egreso ? fechaHora(h.egreso) : '—'}</span> });

  return (
    <>
      <PageHeader titulo="Hospitalización" descripcion="Ingresos, estancias, disponibilidad de camas y egresos." />
      <MetricStrip items={[
        { etiqueta: 'Ingresos activos', valor: activas.length, icono: 'hospital' },
        { etiqueta: 'Camas disponibles', valor: disponibles, icono: 'ok' },
        { etiqueta: 'Egresos registrados', valor: lista.items.filter(h => h.estado === 'Egresado').length, icono: 'archivo' }
      ]} />
      <Card titulo="Disponibilidad por servicio" icono="hospital">
        <DataTable titulo="Disponibilidad de camas" vacio="Sin camas registradas" claveFila={d => d.id_departamento}
          filas={disponibilidad.items} columnas={[
            { clave: 'nombre_departamento', titulo: 'Servicio', principal: true },
            { clave: 'camas_total', titulo: 'Camas', num: true },
            { clave: 'camas_disponibles', titulo: 'Disponibles', num: true, render: d => <StatusBadge tono={d.camas_disponibles > 0 ? 'ok' : 'warn'} sinPunto>{d.camas_disponibles}</StatusBadge> }
          ]} />
      </Card>
      <Card titulo="Estancias hospitalarias" icono="hospital" descripcion="Ingresos activos y egresos registrados.">
        <DataTable titulo="Hospitalizaciones" columnas={columnas} filas={lista.items} claveFila={h => h.id_hospitalizacion} vacio="Sin hospitalizaciones registradas" />
      </Card>
      {gestionar && (
        <Card titulo="Registrar ingreso" icono="mas">
          <form onSubmit={ingresar} noValidate>
            {envio.error && <Alerta titulo="No se pudo registrar el ingreso">{envio.error.message}</Alerta>}
            {Object.keys(errores).length > 0 && <Alerta>Revise los campos marcados.</Alerta>}
            <div className="form-grid">
              <BuscadorPaciente value={nuevo.id_paciente} onChange={v => setNuevo({ ...nuevo, id_paciente: v })} />
              <FormField label="Cama disponible" error={errores.id_cama} required>{a => (
                <select {...a} value={nuevo.id_cama} onChange={e => setNuevo({ ...nuevo, id_cama: e.target.value })}>
                  <option value="">Seleccione…</option>
                  {camas.items.map(c => <option key={c.id_cama} value={c.id_cama}>{c.nombre_departamento} · Hab. {c.numero_habitacion}-{c.numero_cama}</option>)}
                </select>)}</FormField>
              <FormField label="Médico tratante" error={errores.id_medico_tratante} required>{a => (
                <select {...a} value={nuevo.id_medico_tratante} onChange={e => setNuevo({ ...nuevo, id_medico_tratante: e.target.value })}>
                  <option value="">Seleccione…</option>
                  {medicos.map(m => <option key={m.id_medico} value={m.id_medico}>{nombreMedico(m)} · {m.colegiado}</option>)}
                </select>)}</FormField>
              <FormField label="Diagnóstico de ingreso">{a => <input {...a} value={nuevo.diagnostico_ingreso} onChange={e => setNuevo({ ...nuevo, diagnostico_ingreso: e.target.value })} maxLength={255} />}</FormField>
              <FormField label="Motivo de ingreso" error={errores.motivo_ingreso} required full>{a => <textarea {...a} rows={3} value={nuevo.motivo_ingreso} onChange={e => setNuevo({ ...nuevo, motivo_ingreso: e.target.value })} maxLength={20000} />}</FormField>
              {errores.id_paciente && <div className="field full"><span className="error">{errores.id_paciente}</span></div>}
            </div>
            <div className="form-actions">
              <BotonEnviar enviando={envio.enviando} className="btn btn-primary">Registrar ingreso</BotonEnviar>
            </div>
          </form>
        </Card>
      )}
      {egreso && <DialogoEgreso hospitalizacion={egreso} onCerrar={() => setEgreso(null)} onHecho={() => { setEgreso(null); datos.recargar(); }} />}
    </>
  );
}

function DialogoEgreso({ hospitalizacion, onCerrar, onHecho }) {
  const { api } = useSesion();
  const notificar = useNotificar();
  const envio = useEnvio();
  const [f, setF] = useState({ condicion_egreso: 'Alta', diagnostico_egreso: '' });

  async function enviar(ev) {
    ev.preventDefault();
    if (!f.diagnostico_egreso.trim()) return envio.setError(new Error('Indique el diagnóstico de egreso'));
    const r = await envio.enviar(() => api.hospitalizacion.egresar(hospitalizacion.id_hospitalizacion, {
      condicion_egreso: f.condicion_egreso,
      diagnostico_egreso: f.diagnostico_egreso.trim()
    }));
    if (r) { notificar('Egreso registrado'); onHecho(); }
  }

  return (
    <Dialogo abierto titulo="Registrar egreso" descripcion={`Paciente: ${hospitalizacion.paciente}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="stack" noValidate>
        {envio.error && <Alerta>{envio.error.message}</Alerta>}
        <FormField label="Condición de egreso" required>{a => (
          <select {...a} value={f.condicion_egreso} onChange={e => setF({ ...f, condicion_egreso: e.target.value })}>
            <option>Alta</option><option>Referencia</option><option>Fallecimiento</option>
          </select>)}</FormField>
        <FormField label="Diagnóstico de egreso" required>{a => <textarea {...a} rows={3} value={f.diagnostico_egreso} onChange={e => setF({ ...f, diagnostico_egreso: e.target.value })} maxLength={255} />}</FormField>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <BotonEnviar enviando={envio.enviando} className="btn btn-primary">Registrar egreso</BotonEnviar>
        </div>
      </form>
    </Dialogo>
  );
}
