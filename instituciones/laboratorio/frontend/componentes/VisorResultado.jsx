import { Icon, KeyValue } from '@plataforma/ui/index.js';

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
      <div className="reserved-slot">
        <span className="state-icon" aria-hidden="true"><Icon name="resultado" size={22} /></span>
        <div>
          <b>Visor de resultados</b>
          <p>Mostrará cada resultado según su tipo de examen. No se define todavía un esquema de resultados: los campos, unidades, rangos y formatos los integrará el backend del laboratorio.</p>
        </div>
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
