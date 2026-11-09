import { Router } from 'express';
import { z } from 'zod';
import { q, tx } from '../db.js';
import { ah, ApiError } from '../errores.js';
import { permiso } from '../seguridad.js';
import { NOMBRE_MEDICO, NOMBRE_PACIENTE, entero, idParam, paginacion, txt, txtReq, validar } from '../utilidades.js';
import { registrar } from '../bitacora.js';

export const hospitalizacionRouter = Router();

// Disponibilidad de camas por departamento
hospitalizacionRouter.get('/camas/disponibilidad', permiso('hospital.hospitalizacion.ver'), ah(async (req, res) => {
  const items = await q(
    `SELECT d.id_departamento, d.nombre_departamento, COUNT(cm.id_cama) AS camas_total,
            SUM(cm.estado = 'Disponible') AS camas_disponibles
       FROM departamento d LEFT JOIN habitacion h ON h.id_departamento = d.id_departamento LEFT JOIN cama cm ON cm.id_habitacion = h.id_habitacion
      GROUP BY d.id_departamento, d.nombre_departamento ORDER BY d.nombre_departamento`);
  res.json({ items });
}));

hospitalizacionRouter.get('/camas', permiso('hospital.hospitalizacion.ver'), ah(async (req, res) => {
  const f = [], p = [];
  if (req.query.id_departamento) { f.push('h.id_departamento = ?'); p.push(Number(req.query.id_departamento)); }
  if (req.query.estado) { f.push('cm.estado = ?'); p.push(req.query.estado); }
  const items = await q(
    `SELECT cm.id_cama, cm.numero_cama, cm.estado, h.id_habitacion, h.numero_habitacion, h.tipo, d.id_departamento, d.nombre_departamento
       FROM cama cm JOIN habitacion h USING (id_habitacion) JOIN departamento d ON d.id_departamento = h.id_departamento
       ${f.length ? `WHERE ${f.join(' AND ')}` : ''} ORDER BY d.nombre_departamento, h.numero_habitacion, cm.numero_cama`, p);
  res.json({ items });
}));

hospitalizacionRouter.get('/hospitalizaciones', permiso('hospital.hospitalizacion.ver'), ah(async (req, res) => {
  const { limite, desplazamiento } = paginacion(req.query);
  const where = req.query.estado === 'todas' ? '' : 'WHERE hs.fecha_egreso IS NULL';
  const items = await q(
    `SELECT hs.id_hospitalizacion, hs.id_paciente, ${NOMBRE_PACIENTE} AS paciente, hs.fecha_ingreso AS ingreso, hs.fecha_egreso AS egreso,
            d.nombre_departamento AS servicio, CONCAT(h.numero_habitacion, '-', cm.numero_cama) AS cama,
            IF(hs.fecha_egreso IS NULL, 'Activa', 'Egresado') AS estado, ${NOMBRE_MEDICO()} AS medico_tratante
       FROM hospitalizacion hs JOIN paciente p ON p.id_paciente = hs.id_paciente JOIN cama cm ON cm.id_cama = hs.id_cama
       JOIN habitacion h ON h.id_habitacion = cm.id_habitacion JOIN departamento d ON d.id_departamento = h.id_departamento
       JOIN medico m ON m.id_medico = hs.id_medico_tratante
       ${where} ORDER BY hs.fecha_ingreso DESC LIMIT ? OFFSET ?`, [limite, desplazamiento]);
  const [{ total }] = await q(`SELECT COUNT(*) total FROM hospitalizacion hs ${where}`);
  // Es dato RESTRINGIDO (tabla hospitalizacion): se audita la consulta del listado.
  await registrar(req, { tabla: 'hospitalizacion', accion: 'LEER' });
  res.json({ items, total });
}));

const ingresoEsq = z.object({
  id_paciente: entero(), id_cama: entero(), id_medico_tratante: entero(),
  motivo_ingreso: txtReq(20000), diagnostico_ingreso: txt(255)
});

hospitalizacionRouter.post('/hospitalizaciones', permiso('hospital.hospitalizacion.gestionar'), ah(async (req, res) => {
  const d = validar(ingresoEsq, req.body);
  const id = await tx(async c => {
    const [p] = await q('SELECT estado FROM paciente WHERE id_paciente = ? FOR UPDATE', [d.id_paciente], c);
    if (!p) throw new ApiError(404, 'NO_ENCONTRADO', 'Paciente no encontrado');
    if (p.estado !== 'Activo') throw new ApiError(409, 'PACIENTE_NO_ACTIVO', 'El paciente no está activo');
    const [ya] = await q('SELECT id_hospitalizacion FROM hospitalizacion WHERE id_paciente = ? AND fecha_egreso IS NULL', [d.id_paciente], c);
    if (ya) throw new ApiError(409, 'YA_HOSPITALIZADO', 'El paciente ya tiene un ingreso activo');
    const [cm] = await q('SELECT estado FROM cama WHERE id_cama = ? FOR UPDATE', [d.id_cama], c);
    if (!cm) throw new ApiError(404, 'NO_ENCONTRADO', 'Cama no encontrada');
    if (cm.estado !== 'Disponible') throw new ApiError(409, 'CAMA_NO_DISPONIBLE', `La cama está ${cm.estado}`);
    const [m] = await q('SELECT estado FROM medico WHERE id_medico = ?', [d.id_medico_tratante], c);
    if (!m || m.estado !== 'Activo') throw new ApiError(422, 'REFERENCIA_INVALIDA', 'Médico inexistente o inactivo');
    const r = await q(
      'INSERT INTO hospitalizacion (id_paciente, id_cama, id_medico_tratante, motivo_ingreso, diagnostico_ingreso) VALUES (?,?,?,?,?)',
      [d.id_paciente, d.id_cama, d.id_medico_tratante, d.motivo_ingreso, d.diagnostico_ingreso], c);
    await q(`UPDATE cama SET estado = 'Ocupada' WHERE id_cama = ?`, [d.id_cama], c);
    await registrar(req, { id_paciente: d.id_paciente, tabla: 'hospitalizacion', accion: 'CREAR' }, c);
    return r.insertId;
  });
  res.status(201).json({ id_hospitalizacion: id });
}));

hospitalizacionRouter.patch('/hospitalizaciones/:id/egreso', permiso('hospital.hospitalizacion.gestionar'), ah(async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(z.object({ condicion_egreso: z.enum(['Alta', 'Referencia', 'Fallecimiento']), diagnostico_egreso: txt(255) }), req.body);
  await tx(async c => {
    const [h] = await q('SELECT * FROM hospitalizacion WHERE id_hospitalizacion = ? FOR UPDATE', [id], c);
    if (!h) throw new ApiError(404, 'NO_ENCONTRADO', 'Hospitalización no encontrada');
    if (h.fecha_egreso) throw new ApiError(409, 'YA_EGRESADO', 'El paciente ya fue egresado');
    await q('UPDATE hospitalizacion SET fecha_egreso = NOW(), condicion_egreso = ?, diagnostico_egreso = ? WHERE id_hospitalizacion = ?',
      [d.condicion_egreso, d.diagnostico_egreso, id], c);
    await q(`UPDATE cama SET estado = 'Disponible' WHERE id_cama = ?`, [h.id_cama], c);
    await registrar(req, { id_paciente: h.id_paciente, tabla: 'hospitalizacion', accion: 'MODIFICAR' }, c);
  });
  res.json({ ok: true });
}));
