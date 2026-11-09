// Utilidades de presentación propias de la clínica odontológica (sin React).

export const TONO_CITA = { Programada: 'info', Atendida: 'ok', Cancelada: 'bad', 'No asistió': 'warn' };
export const TONO_PIEZA = {
  Sana: 'ok', Caries: 'bad', Obturada: 'info', Endodoncia: 'info', Corona: 'info',
  Ausente: 'warn', 'Extracción indicada': 'bad', Implante: 'info'
};
export const ESTADOS_PIEZA = Object.keys(TONO_PIEZA);

// Odontograma FDI en el orden en que se mira la boca: derecha del paciente a la izquierda de la pantalla.
export const ARCADAS = {
  permanentes: [
    { titulo: 'Arcada superior', piezas: ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'] },
    { titulo: 'Arcada inferior', piezas: ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'] }
  ],
  temporales: [
    { titulo: 'Arcada superior', piezas: ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'] },
    { titulo: 'Arcada inferior', piezas: ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'] }
  ]
};

export const sexo = s => (s === 'F' ? 'Femenino' : 'Masculino');

// Diagnósticos, tratamientos y recetas de todas las consultas, con su consulta de origen.
export const deConsultas = (consultas, campo) => (consultas || [])
  .flatMap(c => (c[campo] || []).map(x => ({ ...x, consulta: c })))
  .sort((a, b) => new Date(b.consulta.fecha_hora) - new Date(a.consulta.fecha_hora))
  .map((x, i) => ({ ...x, _fila: i }));
