import { Icon } from '@plataforma/ui/index.js';

// PUNTO DE EXTENSIÓN de la Clínica Odontológica: información de piezas dentales y
// tratamientos por pieza. No se construye un odontograma mientras no exista el
// contrato de datos que defina el compañero responsable (numeración de piezas,
// superficies, estados, tratamientos por pieza…).
//
// Cuando exista, implementar aquí el componente (o un Odontograma.jsx en esta misma
// carpeta) y conservar su uso en paginas/Expediente.jsx. No requiere cambiar la
// plataforma compartida: es un componente más del módulo.
export default function PiezasDentales() {
  return (
    <div className="reserved-slot">
      <span className="state-icon" aria-hidden="true"><Icon name="diente" size={22} /></span>
      <div>
        <b>Espacio reservado para piezas dentales</b>
        <p>Aquí se incorporará la información de piezas dentales y los tratamientos por pieza cuando el backend de la clínica defina su contrato de datos. No se muestra un odontograma provisional para no presentar una estructura clínica que todavía no existe.</p>
        <ul className="lista">
          <li>Componente del módulo: <code>frontend/componentes/PiezasDentales.jsx</code></li>
          <li>Datos: operación de <code>api.js</code> definida por el backend de la clínica</li>
        </ul>
      </div>
    </div>
  );
}
