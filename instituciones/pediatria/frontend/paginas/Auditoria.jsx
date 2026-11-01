import { useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, ErrorState, FilterBar, FormField, LoadingState, MetricStrip, PageHeader, useCarga } from '@plataforma/ui/index.js';
import { TablaAuditoria } from './expediente/AuditoriaPaciente.jsx';

const GRUPOS = {
  'Escrituras clínicas y administrativas': ['CREAR_PACIENTE', 'ACTUALIZAR_PACIENTE', 'AGREGAR_TUTOR', 'ACTUALIZAR_TUTOR', 'REGISTRAR_CONSULTA', 'AGREGAR_DIAGNOSTICO',
    'AGREGAR_TRATAMIENTO', 'ACTUALIZAR_TRATAMIENTO', 'REGISTRAR_PRESCRIPCION', 'REGISTRAR_CRECIMIENTO', 'PROGRAMAR_VACUNA', 'APLICAR_VACUNA',
    'CANCELAR_VACUNA', 'ARCHIVAR_HISTORIAL', 'CREAR_MEDICO', 'CREAR_VACUNA'],
  Lecturas: ['LEER_HISTORIAL', 'LEER_HISTORIAL_ARCHIVADO', 'LEER_ADMINISTRATIVO', 'LEER_CONSULTAS', 'LEER_DIAGNOSTICOS', 'LEER_PRESCRIPCIONES',
    'LEER_CRECIMIENTO', 'LEER_VACUNACION', 'LISTAR_ARCHIVADOS', 'LISTAR_PACIENTES', 'LEER_PANEL', 'LEER_VACUNACION_PENDIENTE'],
  'Seguridad y sesión': ['ACCESO_DENEGADO', 'INICIO_SESION_DESARROLLO']
};

export default function Auditoria() {
  const { api } = useSesion();
  const [f, setF] = useState({ id_paciente: '', accion: '' });
  const [aplicado, setAplicado] = useState(f);
  const { datos, cargando, error, recargar } = useCarga(() => api.auditoria({
    id_paciente: aplicado.id_paciente.trim() || undefined, accion: aplicado.accion || undefined, limite: 200
  }), [api, aplicado]);

  return (
    <>
      <PageHeader titulo="Auditoría" descripcion="Últimos 200 eventos de la bitácora de operaciones sensibles: lecturas, cambios y accesos denegados." />
      <MetricStrip items={[
        { etiqueta: 'Eventos visibles', valor: datos?.length, icono: 'auditoria' },
        { etiqueta: 'Denegados en esta vista', valor: datos?.filter(e => e.resultado === 'DENEGADO').length, icono: 'llave' },
        { etiqueta: 'Acción seleccionada', valor: aplicado.accion || 'Todas', icono: 'buscar' }
      ]} />
      <Card titulo="Registro de operaciones" icono="auditoria">
        <FilterBar etiqueta="Filtrar auditoría" onSubmit={() => setAplicado({ ...f })} resumen={datos && <span role="status">{datos.length} {datos.length === 1 ? 'evento' : 'eventos'}</span>}>
          <FormField label="Código de paciente">{a => <input {...a} value={f.id_paciente} onChange={e => setF({ ...f, id_paciente: e.target.value })} maxLength={40} pattern="[A-Za-z0-9_\-]*" placeholder="P001" />}</FormField>
          <FormField label="Acción">{a => (
            <select {...a} value={f.accion} onChange={e => setF({ ...f, accion: e.target.value })}>
              <option value="">Todas</option>
              {Object.entries(GRUPOS).map(([g, xs]) => <optgroup key={g} label={g}>{xs.map(x => <option key={x}>{x}</option>)}</optgroup>)}
            </select>)}
          </FormField>
          <button type="submit" className="btn btn-primary">Filtrar</button>
        </FilterBar>
        {cargando ? <LoadingState /> : error ? <ErrorState error={error} onReintentar={recargar} /> : <TablaAuditoria eventos={datos} conPaciente />}
      </Card>
    </>
  );
}
