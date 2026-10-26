import { useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, DataTable, EmptyState, ErrorState, FilterBar, LoadingState, SearchBar, useCarga } from '@plataforma/ui/index.js';
import { DialogoPrescripcion } from './Consultas.jsx';
import { fechaHora, fechaLocal } from '@plataforma/formato.js';

// Historial de medicamentos recetados en todas las consultas del paciente.
export default function Prescripciones({ paciente, editable, recargar: recargarPaciente }) {
  const { api, puede } = useSesion();
  const { datos, cargando, error, recargar } = useCarga(() => api.consultas.prescripciones(paciente.id_paciente), [api, paciente]);
  const [filtro, setFiltro] = useState('');
  const [abierto, setAbierto] = useState(false);
  const consultas = [...(paciente.consultas || [])].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  const puedeRecetar = editable && puede('clinico.escribir');

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState error={error} onReintentar={recargar} />;
  const t = filtro.trim().toLowerCase();
  const filas = datos.flatMap(rx => rx.medicamentos.map((m, i) => ({ rx, m, k: `${rx.id_prescripcion}-${m.id_medicamento || i}` })))
    .filter(({ m }) => !t || m.nombre.toLowerCase().includes(t));

  return (
    <Card titulo="Medicamentos recetados" descripcion="Historial de todas las prescripciones, de la más reciente a la más antigua. El sistema no sugiere medicamentos ni dosis."
      acciones={puedeRecetar && consultas.length > 0 && <button type="button" className="btn btn-primary btn-sm" onClick={() => setAbierto(true)}>Nueva prescripción</button>}>
      {puedeRecetar && consultas.length === 0 && <p className="meta mb-3">Para recetar primero registre una consulta.</p>}
      {datos.length === 0 ? <EmptyState icono="receta" titulo="Sin prescripciones registradas" /> : <>
        <FilterBar etiqueta="Filtrar medicamentos" resumen={<span role="status">{filas.length} {filas.length === 1 ? 'medicamento' : 'medicamentos'} · {datos.length} {datos.length === 1 ? 'receta' : 'recetas'}</span>}>
          <SearchBar label="Filtrar por medicamento" value={filtro} onChange={setFiltro} placeholder="Nombre del medicamento" />
        </FilterBar>
        {filas.length === 0 ? <EmptyState icono="buscar" titulo="Sin coincidencias" /> : (
          <DataTable titulo="Medicamentos recetados" filas={filas} claveFila={f => f.k} columnas={[
            { clave: 'med', titulo: 'Medicamento', principal: true, render: ({ m }) => <><b>{m.nombre}</b><div className="cell-sub">Vía: {m.via_administracion}</div></> },
            { clave: 'dosis', titulo: 'Dosis', render: ({ m }) => m.dosis },
            { clave: 'frec', titulo: 'Frecuencia', render: ({ m }) => m.frecuencia },
            { clave: 'dur', titulo: 'Duración', render: ({ m }) => m.duracion },
            { clave: 'emision', titulo: 'Receta', render: ({ rx }) => <>{fechaHora(rx.fecha_emision)}<div className="cell-sub"><code>{rx.id_prescripcion}</code></div></> },
            { clave: 'consulta', titulo: 'Consulta de origen', render: ({ rx }) => <>
              {rx.motivo_consulta}
              <div className="cell-sub">{fechaLocal(rx.fecha_consulta)} · {rx.medico ? `${rx.medico.nombres} ${rx.medico.apellidos}` : rx.id_medico}</div>
            </> }
          ]} />
        )}
      </>}
      <DialogoPrescripcion abierto={abierto} consultas={consultas} paciente={paciente} onCerrar={() => setAbierto(false)}
        onHecho={() => { setAbierto(false); recargarPaciente(); }} />
    </Card>
  );
}
