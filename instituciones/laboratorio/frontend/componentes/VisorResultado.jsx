import { Icon, KeyValue, StatusBadge, TablaPendiente } from '@plataforma/ui/index.js';

// PUNTO DE EXTENSIÓN del Laboratorio Clínico: presentación de resultados.
// Los resultados tienen estructuras DISTINTAS según el tipo de examen, por eso aquí no
// se fija un esquema. El compañero responsable registra un componente por tipo de
// examen cuando defina sus campos, validaciones y formatos:
//
//   import HematologiaResultado from './resultados/Hematologia.jsx';
//   export const RENDERIZADORES = { hematologia: HematologiaResultado };
//
// Un tipo sin componente propio se presenta de forma genérica (pares campo–valor).
export const RENDERIZADORES = {};

export default function VisorResultado({ tipo, resultado }) {
  if (!resultado) {
    return (
      <div className="report-preview">
        <div className="report-identity">
          <div><b>Informe de laboratorio</b><small>Sin resultado seleccionado</small></div>
          <span className="state-icon" aria-hidden="true"><Icon name="matraz" size={24} /></span>
        </div>
        <KeyValue items={[
          ['Paciente', '—'], ['Expediente', '—'], ['Examen', '—'], ['Muestra', '—'], ['Fecha de análisis', '—'], ['Fecha de emisión', '—']
        ]} />
        <StatusBadge tono="info">Pendiente de integración</StatusBadge>
        <TablaPendiente titulo="Parámetros del informe" columnas={['Parámetro', 'Resultado', 'Unidad', 'Referencia'].map(t => ({ clave: t, titulo: t }))}
          mensaje="Los parámetros, unidades y referencias se mostrarán según el tipo de examen definido por el laboratorio." />
        <div className="record-empty"><Icon name="consulta" /><div><h3>Observaciones del informe</h3><p>Sin datos de un resultado. Esta plantilla no contiene valores ni interpretaciones clínicas.</p></div></div>
        <div className="report-signature"><div><span className="meta">Profesional responsable</span><b>—</b></div><div><span className="meta">Validación y emisión</span><b>—</b></div></div>
      </div>
    );
  }
  const Propio = RENDERIZADORES[tipo];
  return Propio ? <Propio resultado={resultado} /> : <ResultadoGenerico resultado={resultado} />;
}

// Presentación sin esquema: cada campo del objeto como par campo–valor.
function ResultadoGenerico({ resultado }) {
  const texto = v => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return <KeyValue items={Object.entries(resultado).map(([k, v]) => [k, texto(v)])} />;
}
