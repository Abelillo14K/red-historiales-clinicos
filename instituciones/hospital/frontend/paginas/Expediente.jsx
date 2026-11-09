import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Alerta, Card, DataTable, EmptyState, ErrorState, Icon, KeyValue, LoadingState, StatusBadge, Tabs, useCarga, useConfirmar, useEnvio, useNotificar } from '@plataforma/ui/index.js';
import EncabezadoExpediente from '../componentes/EncabezadoExpediente.jsx';
import { fecha, fechaHora, fechaLocal } from '@plataforma/formato.js';

const PESTANAS = [
  { clave: 'resumen', titulo: 'Datos generales' },
  { clave: 'consultas', titulo: 'Consultas', permiso: 'historial.leer' },
  { clave: 'diagnosticos', titulo: 'Diagnósticos', permiso: 'historial.leer' },
  { clave: 'tratamientos', titulo: 'Tratamientos', permiso: 'historial.leer' },
  { clave: 'prescripciones', titulo: 'Medicamentos', permiso: 'historial.leer' },
  { clave: 'examenes', titulo: 'Exámenes', permiso: 'historial.leer' },
  { clave: 'hospitalizaciones', titulo: 'Hospitalizaciones', permiso: 'historial.leer' },
  { clave: 'antecedentes', titulo: 'Antecedentes', permiso: 'historial.leer' }
];

const SECCIONES = {
  resumen: 'Datos generales del paciente, contacto, seguro y alergias.',
  consultas: 'Atenciones registradas del paciente, de la más reciente a la más antigua.',
  diagnosticos: 'Diagnósticos registrados en todas las consultas.',
  tratamientos: 'Tratamiento indicado en cada consulta.',
  prescripciones: 'Medicamentos recetados en las consultas.',
  examenes: 'Órdenes de examen y sus resultados.',
  hospitalizaciones: 'Ingresos y egresos hospitalarios del paciente.',
  antecedentes: 'Antecedentes personales y familiares.'
};

export default function Expediente() {
  const { id, seccion = 'resumen' } = useParams();
  const { api, puede } = useSesion();
  const { enlace } = useModulo();
  const navegar = useNavigate();
  const confirmar = useConfirmar();
  const notificar = useNotificar();
  const envio = useEnvio();
  const pac = useCarga(() => api.pacientes.obtener(id), [api, id]);

  if (pac.cargando && !pac.datos) return <LoadingState texto="Cargando expediente…" />;
  if (pac.error) {
    return <>
      <ErrorState error={pac.error} onReintentar={pac.recargar} />
      <Link className="btn" to={enlace('/pacientes')}>Volver a pacientes</Link>
    </>;
  }

  const datos = pac.datos;
  const p = datos.paciente;
  const activo = p.estado === 'Activo';
  const clinico = puede('historial.leer');
  const pestanas = PESTANAS.filter(t => !t.permiso || puede(t.permiso));
  const actual = pestanas.some(t => t.clave === seccion) ? seccion : 'resumen';

  async function reactivar() {
    const ok = await confirmar({
      titulo: 'Reactivar historial',
      confirmar: 'Reactivar',
      mensaje: `El historial de ${p.primer_nombre} ${p.primer_apellido} volverá a estado Activo y admitirá nuevas atenciones.`
    });
    if (!ok) return;
    const r = await envio.enviar(() => api.pacientes.reactivar(id));
    if (r) { notificar('Historial reactivado'); pac.recargar(); }
  }

  const acciones = <>
    {activo && puede('clinico.escribir') && <Link className="btn btn-primary" to={enlace(`/pacientes/${id}/consultas/nueva`)}><Icon name="mas" size={16} />Nueva consulta</Link>}
    {activo && puede('historial.archivar') && <Link className="btn btn-danger" to={enlace(`/pacientes/${id}/archivar`)}><Icon name="archivo" size={16} />Archivar historial</Link>}
    {!activo && puede('historial.archivar') && <button type="button" className="btn btn-primary" onClick={reactivar} disabled={envio.enviando}><Icon name="ok" size={16} />Reactivar historial</button>}
  </>;

  return (
    <>
      <EncabezadoExpediente datos={datos} acciones={acciones} />
      {envio.error && <Alerta titulo="No se pudo reactivar">{envio.error.message}</Alerta>}
      {!activo && (
        <div className="archived-banner" role="status">
          <Icon name="archivo" />
          <span>Historial archivado{p.fecha_archivado ? ` el ${fechaHora(p.fecha_archivado)}` : ''}. Se conserva completo en modo de solo lectura.</span>
        </div>
      )}
      {pestanas.length > 1 && (
        <Tabs etiqueta="Secciones del expediente" actual={actual} pestanas={pestanas}
          onCambiar={k => navegar(enlace(k === 'resumen' ? `/pacientes/${id}` : `/pacientes/${id}/${k}`))} />
      )}
      <div role="tabpanel" aria-label={pestanas.find(t => t.clave === actual)?.titulo}>
        {actual === 'resumen' && <Resumen datos={datos} clinico={clinico} />}
        {actual === 'consultas' && <SeccionTabla titulo="Consultas" cargar={() => api.consultas.listar(id)} deps={[api, id]}
          columnas={[
            { clave: 'fecha_hora', titulo: 'Fecha y hora', render: c => fechaHora(c.fecha_hora) },
            { clave: 'medico', titulo: 'Médico' },
            { clave: 'tipo_consulta', titulo: 'Tipo', render: c => <StatusBadge tono="info" sinPunto>{c.tipo_consulta}</StatusBadge> },
            { clave: 'motivo', titulo: 'Motivo', principal: true }
          ]} vacio="Sin consultas registradas" claveFila={c => c.id_consulta} />}
        {actual === 'diagnosticos' && <SeccionTabla titulo="Diagnósticos" cargar={() => api.consultas.diagnosticos(id)} deps={[api, id]}
          columnas={[
            { clave: 'codigo', titulo: 'Código' },
            { clave: 'descripcion', titulo: 'Descripción', principal: true },
            { clave: 'tipo', titulo: 'Tipo' },
            { clave: 'id_consulta', titulo: 'Consulta' },
            { clave: 'fecha', titulo: 'Fecha', render: c => fechaHora(c.fecha) }
          ]} vacio="Sin diagnósticos registrados" claveFila={c => `${c.id_consulta}-${c.codigo}`} />}
        {actual === 'tratamientos' && <SeccionTabla titulo="Tratamientos" cargar={() => api.consultas.tratamientos(id)} deps={[api, id]}
          columnas={[
            { clave: 'descripcion', titulo: 'Descripción', principal: true },
            { clave: 'recomendaciones', titulo: 'Recomendaciones' },
            { clave: 'id_consulta', titulo: 'Consulta' },
            { clave: 'fecha', titulo: 'Fecha', render: c => fechaHora(c.fecha) }
          ]} vacio="Sin tratamientos registrados" claveFila={c => c.id_consulta} />}
        {actual === 'prescripciones' && <SeccionTabla titulo="Medicamentos y prescripciones" cargar={() => api.consultas.prescripciones(id)} deps={[api, id]}
          columnas={[
            { clave: 'medicamento', titulo: 'Medicamento', principal: true },
            { clave: 'dosis', titulo: 'Dosis' },
            { clave: 'frecuencia', titulo: 'Frecuencia' },
            { clave: 'duracion', titulo: 'Duración' },
            { clave: 'via_administracion', titulo: 'Vía' },
            { clave: 'fecha_emision', titulo: 'Emitida', render: c => fecha(c.fecha_emision) }
          ]} vacio="Sin medicamentos recetados" claveFila={c => c.id_prescripcion_detalle} />}
        {actual === 'examenes' && <SeccionTabla titulo="Exámenes" cargar={() => api.examenes.listar(id)} deps={[api, id]}
          columnas={[
            { clave: 'examen', titulo: 'Examen', principal: true },
            { clave: 'fecha', titulo: 'Ordenado', render: c => fechaHora(c.fecha) },
            { clave: 'estado', titulo: 'Estado', render: c => <StatusBadge tono={c.estado === 'Completada' ? 'ok' : 'info'} sinPunto>{c.estado}</StatusBadge> },
            { clave: 'resultado', titulo: 'Resultado', render: c => c.resultado || 'Pendiente' }
          ]} vacio="Sin exámenes registrados" claveFila={c => c.id_orden_detalle} />}
        {actual === 'hospitalizaciones' && <SeccionTabla titulo="Hospitalizaciones" cargar={() => api.expediente.hospitalizaciones(id)} deps={[api, id]}
          columnas={[
            { clave: 'ingreso', titulo: 'Ingreso', render: c => fechaHora(c.ingreso) },
            { clave: 'egreso', titulo: 'Egreso', render: c => c.egreso ? fechaHora(c.egreso) : 'Activo' },
            { clave: 'servicio', titulo: 'Servicio' },
            { clave: 'cama', titulo: 'Cama' },
            { clave: 'estado', titulo: 'Estado', render: c => <StatusBadge tono={c.estado === 'Activa' ? 'info' : 'ok'}>{c.estado}</StatusBadge> }
          ]} vacio="Sin hospitalizaciones registradas" claveFila={c => c.id_hospitalizacion} />}
        {actual === 'antecedentes' && <SeccionTabla titulo="Antecedentes" cargar={() => api.expediente.antecedentes(id)} deps={[api, id]}
          columnas={[
            { clave: 'tipo', titulo: 'Tipo' },
            { clave: 'detalle_tipo', titulo: 'Clase' },
            { clave: 'descripcion', titulo: 'Descripción', principal: true },
            { clave: 'fecha_registro', titulo: 'Registro', render: c => c.fecha_registro ? fechaLocal(c.fecha_registro) : '—' }
          ]} vacio="Sin antecedentes registrados" claveFila={c => `${c.tipo}-${c.detalle_tipo}-${c.descripcion}`} />}
      </div>
    </>
  );
}

function Resumen({ datos, clinico }) {
  const p = datos.paciente;
  const contactos = datos.contactos || [];
  const seguros = datos.seguros || [];
  const alergias = datos.alergias;
  return (
    <>
      <div className="grid grid-2">
        <Card titulo="Datos generales" icono="usuario">
          <KeyValue items={[
            ['Nombres', `${p.primer_nombre} ${p.segundo_nombre || ''}`.trim()],
            ['Apellidos', `${p.primer_apellido} ${p.segundo_apellido || ''}`.trim()],
            ['Fecha de nacimiento', fecha(p.fecha_nacimiento)],
            ['Género', p.genero],
            ['DPI', p.documento_identidad],
            ['Estado civil', p.estado_civil],
            ['Nacionalidad', p.nacionalidad],
            ['Estado del historial', <StatusBadge key="e">{p.estado}</StatusBadge>]
          ]} />
        </Card>
        <Card titulo="Contacto y seguro médico" icono="hospital">
          <KeyValue items={[
            ['Teléfono', p.telefono],
            ['Correo electrónico', p.correo],
            ['Dirección', p.direccion],
            ['Aseguradora', seguros[0]?.nombre_aseguradora],
            ['Número de póliza', seguros[0]?.numero_poliza],
            ['Vigencia', seguros[0] ? `${seguros[0].fecha_inicio ? fecha(seguros[0].fecha_inicio) : '—'} a ${seguros[0].fecha_fin ? fecha(seguros[0].fecha_fin) : '—'}` : null]
          ]} />
        </Card>
      </div>
      <div className="grid grid-2 mt-4">
        <Card titulo="Contactos de emergencia" icono="pacientes" descripcion="Personas a contactar en caso de emergencia.">
          <DataTable titulo="Contactos de emergencia" vacio="Sin contactos registrados" claveFila={c => c.id_contacto}
            filas={contactos} columnas={[
              { clave: 'nombre_contacto', titulo: 'Nombre', principal: true },
              { clave: 'parentesco', titulo: 'Parentesco' },
              { clave: 'telefono', titulo: 'Teléfono' }
            ]} />
        </Card>
        {clinico && (
          <Card titulo="Alergias" icono="diagnostico" descripcion="Información restringida al personal clínico.">
            <DataTable titulo="Alergias" vacio="Sin alergias registradas" claveFila={a => a.id_paciente_alergia}
              filas={alergias || []} columnas={[
                { clave: 'nombre_alergia', titulo: 'Alergia', principal: true },
                { clave: 'tipo', titulo: 'Tipo' },
                { clave: 'severidad', titulo: 'Severidad', render: a => <StatusBadge tono={a.severidad === 'Severa' ? 'bad' : a.severidad === 'Moderada' ? 'warn' : 'info'}>{a.severidad}</StatusBadge> },
                { clave: 'reaccion', titulo: 'Reacción' }
              ]} />
          </Card>
        )}
      </div>
    </>
  );
}

function SeccionTabla({ titulo, cargar, deps, columnas, vacio, claveFila }) {
  const { datos, cargando, error, recargar } = useCarga(cargar, deps);
  return (
    <Card titulo={titulo} icono="consulta" descripcion={SECCIONES[titulo] || undefined}>
      <ErrorState error={error} onReintentar={recargar} />
      {cargando ? <LoadingState /> : datos && (datos.items?.length
        ? <DataTable titulo={titulo} columnas={columnas} filas={datos.items} claveFila={claveFila} vacio={vacio} />
        : <EmptyState icono="consulta" titulo={vacio} />)}
    </Card>
  );
}
