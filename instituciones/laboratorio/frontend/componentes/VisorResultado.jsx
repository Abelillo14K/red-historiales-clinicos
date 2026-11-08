import { DataTable, KeyValue, StatusBadge } from '@plataforma/ui/index.js';
import { fechaHora } from '@plataforma/formato.js';
import { TONO_ESTADO, referencia, valorDe } from './formato.js';

// PUNTO DE EXTENSIÓN: presentación de resultados por tipo de examen.
// La estructura de cada resultado la definen los parámetros de su tipo en el catálogo, así que
// la vista genérica sirve para todos. Un tipo puede registrar una presentación propia por su nombre:
//   export const RENDERIZADORES = { 'Hematología completa': HematologiaResultado };
export const RENDERIZADORES = {};

// resultado: respuesta de GET /api/resultados/:id (parámetros del tipo + valores registrados).
export default function VisorResultado({ resultado }) {
  const Propio = RENDERIZADORES[resultado.tipo_examen.nombre];
  return Propio ? <Propio resultado={resultado} /> : <ResultadoGenerico resultado={resultado} />;
}

function ResultadoGenerico({ resultado: r }) {
  const valores = new Map(r.detalles.map(d => [d.id_parametro, d]));
  const filas = r.parametros.map(p => ({ ...p, detalle: valores.get(p.id_parametro) }));
  return (
    <div className="report-preview">
      <div className="report-identity">
        <div><b>Informe de laboratorio · {r.tipo_examen.nombre}</b><small>{r.paciente} · expediente {r.id_paciente}</small></div>
        <StatusBadge tono={TONO_ESTADO[r.estado]}>{r.estado}</StatusBadge>
      </div>
      <KeyValue items={[
        ['Solicitud', r.id_solicitud], ['Código de muestra', r.codigo_muestra],
        ['Fecha de análisis', fechaHora(r.fecha_analisis)], ['Fecha de emisión', r.fecha_emision ? fechaHora(r.fecha_emision) : 'Sin emitir']
      ]} />
      <DataTable titulo="Parámetros del informe" filas={filas} claveFila={f => f.id_parametro} resaltar={f => f.detalle?.fuera_de_rango} columnas={[
        { clave: 'parametro', titulo: 'Parámetro', principal: true, render: f => f.nombre },
        { clave: 'valor', titulo: 'Resultado', render: f => (f.detalle ? valorDe(f.detalle) : <span className="meta">Pendiente</span>) },
        { clave: 'unidad', titulo: 'Unidad', render: f => f.unidad_medida || '—' },
        { clave: 'referencia', titulo: 'Referencia', render: f => referencia(f) },
        { clave: 'marca', titulo: 'Fuera de rango', render: f => (f.detalle?.fuera_de_rango ? <StatusBadge tono="warn" sinPunto>Sí</StatusBadge> : f.detalle ? 'No' : '—') }
      ]} />
      {r.observaciones && <p><b>Observaciones:</b> {r.observaciones}</p>}
      <p className="meta">«Fuera de rango» compara con la referencia del catálogo; no es una interpretación clínica.</p>
      <div className="report-signature">
        <div><span className="meta">Validado por</span><b>{r.validado_por || '—'}</b></div>
        <div><span className="meta">Estado</span><b>{r.estado}</b></div>
      </div>
    </div>
  );
}
