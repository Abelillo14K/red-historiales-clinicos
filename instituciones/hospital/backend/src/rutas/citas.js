import { Router } from 'express';
import { z } from 'zod';
import { q, tx } from '../db.js';
import { ah, ApiError } from '../errores.js';
import { permiso } from '../seguridad.js';
import { NOMBRE_MEDICO, NOMBRE_PACIENTE, entero, fechaHora, idParam, paginacion, txt, validar } from '../utilidades.js';
import { registrar } from '../bitacora.js';

export const citasRouter = Router();

// Agenda (dato confidencial, no restringido): no se audita como acceso clínico.
citasRouter.get('/citas', permiso('hospital.citas.ver'), ah(async (req, res) => {
  const { limite, desplazamiento } = paginacion(req.query, 200);
  const f = [], p = [];
  if (req.query.fecha) { f.push('DATE(ci.fecha_hora_cita) = ?'); p.push(req.query.fecha); }
  if (req.query.id_medico) { f.push('ci.id_medico = ?'); p.push(Number(req.query.id_medico)); }
  if (req.query.id_paciente) { f.push('ci.id_paciente = ?'); p.push(Number(req.query.id_paciente)); }
  if (req.query.estado) { f.push('ci.estado_cita = ?'); p.push(req.query.estado); }
  const where = f.length ? `WHERE ${f.join(' AND ')}` : '';
  const items = await q(
    `SELECT ci.id_cita, ci.fecha_hora_cita, ci.motivo, ci.estado_cita, ci.id_paciente, ${NOMBRE_PACIENTE} AS paciente,
            p.numero_expediente, ci.id_medico, ${NOMBRE_MEDICO()} AS medico
       FROM cita ci JOIN paciente p ON p.id_paciente = ci.id_paciente JOIN medico m ON m.id_medico = ci.id_medico
       ${where} ORDER BY ci.fecha_hora_cita LIMIT ? OFFSET ?`, [...p, limite, desplazamiento]);
  const [{ total }] = await q(`SELECT COUNT(*) total FROM cita ci ${where}`, p);
  res.json({ items, total });
}));

async function hayChoque(idMedico, fh, excluirCita, c) {
  const [x] = await q(
    `SELECT id_cita FROM cita WHERE id_medico = ? AND fecha_hora_cita = ? AND estado_cita IN ('Programada','Confirmada') AND id_cita <> ?`,
    [idMedico, fh, excluirCita || 0], c);
  return !!x;
}

const crearEsq = z.object({ id_paciente: entero(), id_medico: entero(), fecha_hora: z.string().min(10), motivo: txt(255) });

citasRouter.post('/citas', permiso('hospital.citas.gestionar'), ah(async (req, res) => {
  const d = validar(crearEsq, req.body);
  const fh = fechaHora(d.fecha_hora);
  if (new Date(fh.replace(' ', 'T')) < new Date()) throw new ApiError(400, 'VALIDACION', 'La cita debe ser en una fecha futura');
  const id = await tx(async c => {
    const [p] = await q('SELECT estado FROM paciente WHERE id_paciente = ? FOR UPDATE', [d.id_paciente], c);
    if (!p) throw new ApiError(404, 'NO_ENCONTRADO', 'Paciente no encontrado');
    if (p.estado !== 'Activo') throw new ApiError(409, 'PACIENTE_NO_ACTIVO', 'El paciente no está activo');
    const [m] = await q('SELECT estado FROM medico WHERE id_medico = ? FOR UPDATE', [d.id_medico], c);
    if (!m || m.estado !== 'Activo') throw new ApiError(422, 'REFERENCIA_INVALIDA', 'Médico inexistente o inactivo');
    if (await hayChoque(d.id_medico, fh, 0, c)) throw new ApiError(409, 'MEDICO_OCUPADO', 'El médico ya tiene una cita a esa hora');
    const r = await q('INSERT INTO cita (id_paciente, id_medico, fecha_hora_cita, motivo) VALUES (?,?,?,?)', [d.id_paciente, d.id_medico, fh, d.motivo], c);
    return r.insertId;
  });
  res.status(201).json({ id_cita: id });
}));

// Reprogramar (fecha_hora) y/o cambiar estado (Confirmada | Cancelada | No asistió)
const cambiarEsq = z.object({
  fecha_hora: z.string().min(10).optional(),
  estado_cita: z.enum(['Programada', 'Confirmada', 'Cancelada', 'No asistió']).optional()
}).refine(d => d.fecha_hora || d.estado_cita, 'Indique fecha_hora o estado_cita');

citasRouter.patch('/citas/:id', permiso('hospital.citas.gestionar'), ah(async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(cambiarEsq, req.body);
  await tx(async c => {
    const [ci] = await q('SELECT * FROM cita WHERE id_cita = ? FOR UPDATE', [id], c);
    if (!ci) throw new ApiError(404, 'NO_ENCONTRADO', 'Cita no encontrada');
    if (['Atendida', 'Cancelada'].includes(ci.estado_cita)) throw new ApiError(409, 'CITA_CERRADA', `La cita ya está ${ci.estado_cita}`);
    const sets = [], vals = [];
    if (d.fecha_hora) {
      const fh = fechaHora(d.fecha_hora);
      if (await hayChoque(ci.id_medico, fh, id, c)) throw new ApiError(409, 'MEDICO_OCUPADO', 'El médico ya tiene una cita a esa hora');
      sets.push('fecha_hora_cita = ?'); vals.push(fh);
    }
    if (d.estado_cita) { sets.push('estado_cita = ?'); vals.push(d.estado_cita); }
    await q(`UPDATE cita SET ${sets.join(', ')} WHERE id_cita = ?`, [...vals, id], c);
  });
  res.json({ ok: true });
}));
