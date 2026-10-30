import { useState } from 'react';
import { CamposVistaPrevia, FormularioVistaPrevia, Icon, MetricStrip } from '@plataforma/ui/index.js';

// Plantilla visual: las posiciones son lugares del diseño, no identificadores
// clínicos ni estados de piezas de un paciente. Seleccionar solo cambia el foco visual.
export default function PiezasDentales() {
  const [posicion, setPosicion] = useState(null);
  return <>
    <MetricStrip items={[
      { etiqueta: 'Evaluación dental', valor: 'Sin datos', icono: 'diente' },
      { etiqueta: 'Tratamientos por pieza', valor: '—', icono: 'consulta' }
    ]} />
    <div className="dental-map" aria-label="Plantilla visual del mapa dental">
      {['Arcada superior', 'Arcada inferior'].map((arcada, fila) => <div key={arcada}>
        {fila > 0 && <hr className="dental-divider" />}
        <p className="section-label">{arcada}</p>
        <div className="dental-arch">{Array.from({ length: 8 }, (_, i) => {
          const n = fila * 8 + i + 1;
          return <button type="button" key={n} className="dental-piece" aria-label={`Ver posición visual ${n}`}
            aria-pressed={posicion === n} onClick={() => setPosicion(n)}>
            <Icon name="diente" size={30} /><small>Sin datos</small>
          </button>;
        })}</div>
      </div>)}
    </div>
    <p className="dental-legend">Plantilla de distribución. La numeración y los estados clínicos se definirán al integrar el modelo odontológico.</p>
    <div className="dental-selection record-empty"><Icon name="diente" size={24} /><div>
      <h3>{posicion ? `Posición visual ${posicion}` : 'Selecciona una posición del diseño'}</h3>
      <p>El detalle de la pieza, sus superficies y tratamientos aparecerá aquí con los datos del expediente.</p>
    </div></div>
    <div className="mt-4"><FormularioVistaPrevia titulo="Información por pieza" etiquetaEnvio="Guardar detalle de pieza">
      <CamposVistaPrevia campos={[
        { label: 'Identificador de pieza' }, { label: 'Superficie', opciones: [] }, { label: 'Estado registrado', opciones: [] },
        { label: 'Procedimiento', opciones: [] }, { label: 'Observaciones por pieza', tipo: 'textarea', full: true }
      ]} />
    </FormularioVistaPrevia></div>
  </>;
}
