// Formato común de error (GUIA_EQUIPO §4.1): { error, codigo, detalles? }
export class ApiError extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = status === 409 ? 'CONFLICTO' : codigo; // todo 409 usa el código estable de la tabla
    this.detalles = detalles;
  }
}

export const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function noEncontrada(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada', codigo: 'RUTA_NO_ENCONTRADA' });
}

const MOTOR = {
  ER_DUP_ENTRY: [409, 'CONFLICTO', 'Ya existe un registro con ese valor único (DPI, colegiado, usuario…)'],
  ER_ROW_IS_REFERENCED_2: [409, 'CONFLICTO', 'El registro está en uso y no puede eliminarse'],
  ER_NO_REFERENCED_ROW_2: [422, 'REFERENCIA_INVALIDA', 'Se hace referencia a un registro que no existe'],
  ER_CHECK_CONSTRAINT_VIOLATED: [422, 'VALIDACION_MOTOR', 'Un valor no cumple las reglas de la base de datos'],
  ER_DATA_TOO_LONG: [422, 'VALIDACION_MOTOR', 'Un valor excede la longitud permitida'],
  ER_TRUNCATED_WRONG_VALUE: [422, 'VALIDACION_MOTOR', 'Formato de fecha u otro valor incorrecto']
};
const CAIDO = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_CON_COUNT_ERROR', 'ENOTFOUND']);

export function manejador(err, req, res, _next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError)
    return res.status(err.status).json({ error: err.message, codigo: err.codigo, ...(err.detalles && { detalles: err.detalles }) });
  if (err.code && MOTOR[err.code]) {
    const [s, c, m] = MOTOR[err.code];
    return res.status(s).json({ error: m, codigo: c });
  }
  if (err.code && CAIDO.has(err.code))
    return res.status(503).json({ error: 'La base de datos del Hospital no está disponible', codigo: 'MOTOR_NO_DISPONIBLE' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido', codigo: 'VALIDACION' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande', codigo: 'SOLICITUD_DEMASIADO_GRANDE' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor', codigo: 'ERROR_INTERNO' });
}
