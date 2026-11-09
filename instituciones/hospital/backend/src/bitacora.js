import { q } from './db.js';
import { ApiError } from './errores.js';

// Todo acceso/modificación a tablas RESTRINGIDAS se registra (documento Fase I §4).
// accion: LEER | CREAR | MODIFICAR | ARCHIVAR | REACTIVAR (≤ 15 caracteres)
// Si no se puede auditar, la operación falla (503 AUDITORIA_NO_DISPONIBLE).
export async function registrar(req, { id_paciente = null, tabla, accion }, c) {
  try {
    await q(
      'INSERT INTO bitacora_acceso (id_usuario, id_paciente, tabla_afectada, accion, direccion_ip) VALUES (?,?,?,?,?)',
      [req.usuario.id_usuario, id_paciente, tabla, accion, (req.ip || '').replace('::ffff:', '').slice(0, 45)], c);
  } catch (e) {
    console.error('Bitácora:', e.code || e.message);
    throw new ApiError(503, 'AUDITORIA_NO_DISPONIBLE', 'No se pudo registrar el acceso');
  }
}
