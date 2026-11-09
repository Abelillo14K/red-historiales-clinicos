import { useEffect, useState } from 'react';
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { FormField, SearchBar, useCarga } from '@plataforma/ui/index.js';

export default function BuscadorPaciente({ value, onChange, label = 'Paciente' }) {
  const { api } = useSesion();
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setConsulta(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  const { datos, cargando } = useCarga(
    () => consulta.length >= 2 ? api.pacientes.listar({ q: consulta, por: 'nombre', limite: 20 }) : Promise.resolve({ items: [] }),
    [api, consulta]
  );

  const items = datos?.items || [];
  const seleccionado = value && !items.some(p => String(p.id_paciente) === String(value));

  return (
    <>
      <SearchBar label="Buscar paciente" value={texto} onChange={setTexto} placeholder="Escriba nombre o apellido" />
      <FormField label={label} required>
        {a => (
          <select {...a} value={value} onChange={e => onChange(e.target.value)}>
            <option value="">{cargando ? 'Buscando…' : consulta.length < 2 ? 'Escriba al menos dos letras' : items.length ? 'Seleccione…' : 'Sin resultados'}</option>
            {seleccionado && <option value={value}>Paciente #{value}</option>}
            {items.map(p => (
              <option key={p.id_paciente} value={p.id_paciente}>
                {p.paciente} · {p.codigo}
              </option>
            ))}
          </select>
        )}
      </FormField>
    </>
  );
}
