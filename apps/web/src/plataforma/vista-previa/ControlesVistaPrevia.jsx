import { Icon } from '../ui/index.js';
import { TEMAS, useTema } from '../tema.js';

// Controles del encabezado en la vista previa: tema (misma preferencia local que el
// menú de usuario) y un enlace de regreso.
export default function ControlesVistaPrevia({ regreso }) {
  const [tema, setTema] = useTema();
  return (
    <div className="preview-tools">
      <div className="segmented" role="group" aria-label="Tema">
        {TEMAS.map(([k, t, icono]) => (
          <button key={k} type="button" aria-pressed={tema === k} onClick={() => setTema(k)} title={t} aria-label={`Tema ${t.toLowerCase()}`}>
            <Icon name={icono} size={15} /><span>{t === 'Según el sistema' ? 'Sistema' : t}</span>
          </button>
        ))}
      </div>
      {regreso}
    </div>
  );
}
