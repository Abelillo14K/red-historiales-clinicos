import { Router } from 'express';
import { q } from '../db.js';
import { ah, ApiError } from '../errores.js';
import { permiso } from '../seguridad.js';
import { paginacion } from '../utilidades.js';

export const auditoriaRouter = Router();

const ACCIONES = ['LEER', 'CREAR', 'MODIFICAR', 'ARCHIVAR', 'REACTIVAR'];
const fechaValida = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v));

auditoriaRouter.get('/auditoria', permiso('auditoria.leer'), ah(async (req, res) => {
  const { limite, desplazamiento } = paginacion(req.query, 200);
  const f = [], p = [];
  const paciente = String(req.query.id_paciente || '').trim();
  if (paciente) {
    if (/^\d+$/.test(paciente)) { f.push('b.id_paciente = ?'); p.push(Number(paciente)); }
    else { f.push('p.numero_expediente = ?'); p.push(paciente); }
  }
  if (req.query.id_usuario) {
    const idUsuario = Number(req.query.id_usuario);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) throw new ApiError(400, 'VALIDACION', 'id_usuario inválido');
    f.push('b.id_usuario = ?'); p.push(idUsuario);
  }
  const accion = String(req.query.accion || '').trim().toUpperCase();
  if (accion) {
    if (!ACCIONES.includes(accion)) throw new ApiError(400, 'VALIDACION', 'Acción inválida');
    f.push('b.accion = ?'); p.push(accion);
  }
  for (const [campo, nombre] of [['desde', '>= ?'], ['hasta', '<= ?']]) {
    const valor = String(req.query[campo] || '').trim();
    if (!valor) continue;
    if (!fechaValida(valor)) throw new ApiError(400, 'VALIDACION', `Fecha ${campo} inválida`);
    f.push(`b.fecha_hora ${nombre}`); p.push(`${valor} ${campo === 'desde' ? '00:00:00' : '23:59:59'}`);
  }
  const where = f.length ? `WHERE ${f.join(' AND ')}` : '';
  const base = 'FROM bitacora_acceso b JOIN usuario u ON u.id_usuario = b.id_usuario LEFT JOIN paciente p ON p.id_paciente = b.id_paciente';
  const items = await q(
    `SELECT b.id_bitacora, b.fecha_hora AS fecha, u.nombre_usuario AS actor, b.accion, b.tabla_afectada,
            b.id_paciente, p.numero_expediente, b.direccion_ip
       ${base} ${where} ORDER BY b.fecha_hora DESC, b.id_bitacora DESC LIMIT ? OFFSET ?`,
    [...p, limite, desplazamiento]);
  const [{ total }] = await q(`SELECT COUNT(*) total ${base} ${where}`, p);
  res.json({ items, total });
}));
