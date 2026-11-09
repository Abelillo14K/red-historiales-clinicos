import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { q, tx } from '../db.js';
import { ah, ApiError } from '../errores.js';
import { permiso, puede } from '../seguridad.js';
import { NOMBRE_PACIENTE, entero, fecha, fechaOpc, idParam, num, paginacion, txt, txtReq, validar } from '../utilidades.js';
import { registrar } from '../bitacora.js';

export const pacientesRouter = Router();

const SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
// El frontend muestra "O−" con signo menos tipográfico: se normaliza
const sangre = z.preprocess(v => (typeof v === 'string' ? v.replace('−', '-').trim() || null : v), z.enum(SANGRE).nullish().transform(v => v || null));

const crearEsquema = z.object({
  primer_nombre: txtReq(60), segundo_nombre: txt(60), primer_apellido: txtReq(60), segundo_apellido: txt(60),
  fecha_nacimiento: fecha(), genero: z.enum(['Femenino', 'Masculino']),
  estado_civil: txt(20), documento_identidad: txt(20), tipo_sangre: sangre,
  direccion: txt(200), telefono: txt(15), correo: z.preprocess(v => (v === '' ? null : v), z.string().email().max(120).nullish().transform(v => v || null)),
  nacionalidad: txt(60),
  contactos: z.array(z.object({ nombre_contacto: txtReq(120), parentesco: txtReq(40), telefono: txtReq(15) })).min(1, 'Se requiere al menos un contacto de emergencia'),
  seguro: z.object({ id_seguro: entero(), numero_poliza: txtReq(40), fecha_inicio: fechaOpc(), fecha_fin: fechaOpc() }).nullish(),
  alergias: z.array(z.object({ id_alergia: entero(), severidad: z.enum(['Leve', 'Moderada', 'Severa']).default('Leve'), reaccion: txt(255) })).default([])
});

const actualizarEsquema = z.object({
  estado_civil: txt(20), direccion: txt(200), telefono: txt(15),
  correo: z.preprocess(v => (v === '' ? null : v), z.string().email().max(120).nullish().transform(v => v || null)),
  nacionalidad: txt(60), tipo_sangre: sangre
}).partial();

export async function obtenerPaciente(id, c) {
  const [p] = await q('SELECT * FROM paciente WHERE id_paciente = ?', [id], c);
  if (!p) throw new ApiError(404, 'NO_ENCONTRADO', 'Paciente no encontrado');
  return p;
}

// ---- Listado / búsqueda (también sirve a "Historiales archivados") ----
pacientesRouter.get('/pacientes', permiso('pacientes.listar'), ah(async (req, res) => {
  const { limite, desplazamiento } = paginacion(req.query);
  const estado = req.query.estado || 'Activo';
  if (!['Activo', 'Inactivo', 'Archivado', 'todos'].includes(estado)) throw new ApiError(400, 'VALIDACION', 'estado inválido');
  if (estado === 'Archivado' && !puede(req, 'historial.leer_archivados')) throw new ApiError(403, 'ROL_SIN_PERMISO', 'No puede ver historiales archivados');
  const f = [], p = [];
  if (estado !== 'todos') { f.push('p.estado = ?'); p.push(estado); }
  const texto = String(req.query.q || '').trim();
  if (texto) {
    const por = req.query.por || 'nombre', like = `%${texto}%`;
    if (por === 'dpi') { f.push('p.documento_identidad LIKE ?'); p.push(like); }
    else if (por === 'expediente') { f.push('p.numero_expediente LIKE ?'); p.push(like); }
    else { f.push(`${NOMBRE_PACIENTE} LIKE ?`); p.push(like); }
  }
  const where = f.length ? `WHERE ${f.join(' AND ')}` : '';
  const items = await q(
    `SELECT p.id_paciente AS id, p.id_paciente, p.numero_expediente AS codigo, ${NOMBRE_PACIENTE} AS paciente,
            p.documento_identidad AS dpi, p.estado,
            CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre) AS nombres, CONCAT_WS(' ', p.primer_apellido, p.segundo_apellido) AS apellidos,
            p.fecha_nacimiento, p.genero AS sexo, p.estado AS estado_historial,
            (SELECT MAX(c.fecha_hora_consulta) FROM consulta c WHERE c.id_paciente = p.id_paciente) AS ultima_atencion
       FROM paciente p ${where} ORDER BY p.primer_apellido, p.primer_nombre LIMIT ? OFFSET ?`, [...p, limite, desplazamiento]);
  const [{ total }] = await q(`SELECT COUNT(*) total FROM paciente p ${where}`, p);
  res.json({ items, total });
}));

// ---- Registrar paciente nuevo ----
pacientesRouter.post('/pacientes', permiso('pacientes.registrar'), ah(async (req, res) => {
  const d = validar(crearEsquema, req.body);
  if (d.alergias.length && !puede(req, 'clinico.escribir'))
    throw new ApiError(403, 'ROL_SIN_PERMISO', 'Las alergias son información restringida: su rol no puede registrarlas');
  const id = await tx(async c => {
    const r = await q(
      `INSERT INTO paciente (numero_expediente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento,
         genero, estado_civil, documento_identidad, tipo_sangre, direccion, telefono, correo, nacionalidad)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`TMP-${randomUUID().slice(0, 12)}`, d.primer_nombre, d.segundo_nombre, d.primer_apellido, d.segundo_apellido, d.fecha_nacimiento,
        d.genero, d.estado_civil, d.documento_identidad, d.tipo_sangre, d.direccion, d.telefono, d.correo, d.nacionalidad], c);
    const idp = r.insertId;
    await q('UPDATE paciente SET numero_expediente = ? WHERE id_paciente = ?', [`HG-${String(idp).padStart(6, '0')}`, idp], c);
    for (const k of d.contactos)
      await q('INSERT INTO paciente_contacto (id_paciente, nombre_contacto, parentesco, telefono) VALUES (?,?,?,?)', [idp, k.nombre_contacto, k.parentesco, k.telefono], c);
    if (d.seguro)
      await q('INSERT INTO paciente_seguro (id_paciente, id_seguro, numero_poliza, fecha_inicio, fecha_fin) VALUES (?,?,?,?,?)',
        [idp, d.seguro.id_seguro, d.seguro.numero_poliza, d.seguro.fecha_inicio, d.seguro.fecha_fin], c);
    for (const a of d.alergias)
      await q('INSERT INTO paciente_alergia (id_paciente, id_alergia, severidad, reaccion, fecha_diagnostico) VALUES (?,?,?,?,CURDATE())',
        [idp, a.id_alergia, a.severidad, a.reaccion], c);
    await registrar(req, { id_paciente: idp, tabla: 'paciente', accion: 'CREAR' }, c);
    if (d.alergias.length) await registrar(req, { id_paciente: idp, tabla: 'paciente_alergia', accion: 'CREAR' }, c);
    return idp;
  });
  res.status(201).json({ id_paciente: id, numero_expediente: `HG-${String(id).padStart(6, '0')}` });
}));

// ---- Expediente (datos generales; lo clínico solo con historial.leer) ----
pacientesRouter.get('/pacientes/:id', permiso('pacientes.ver_administrativo'), ah(async (req, res) => {
  const id = idParam(req.params.id);
  const p = await obtenerPaciente(id);
  if (p.estado === 'Archivado' && !puede(req, 'historial.leer_archivados')) throw new ApiError(403, 'PROHIBIDO', 'Historial archivado');
  const out = {
    paciente: p,
    contactos: await q('SELECT * FROM paciente_contacto WHERE id_paciente = ?', [id]),
    seguros: await q(
      `SELECT ps.*, s.nombre_aseguradora FROM paciente_seguro ps JOIN seguro s ON s.id_seguro = ps.id_seguro WHERE ps.id_paciente = ?`, [id]),
    proxima_cita: (await q(
      `SELECT id_cita, fecha_hora_cita FROM cita WHERE id_paciente = ? AND fecha_hora_cita >= NOW() AND estado_cita IN ('Programada','Confirmada')
        ORDER BY fecha_hora_cita LIMIT 1`, [id]))[0] || null
  };
  if (puede(req, 'historial.leer')) {
    out.alergias = await q(
      `SELECT pa.*, a.nombre_alergia, a.tipo FROM paciente_alergia pa JOIN alergia a ON a.id_alergia = pa.id_alergia WHERE pa.id_paciente = ?`, [id]);
    await registrar(req, { id_paciente: id, tabla: 'paciente_alergia', accion: 'LEER' });
  }
  await registrar(req, { id_paciente: id, tabla: 'paciente', accion: 'LEER' });
  res.json(out);
}));

// ---- Actualizar contacto / datos administrativos ----
pacientesRouter.patch('/pacientes/:id', permiso('pacientes.editar'), ah(async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(actualizarEsquema, req.body);
  const p = await obtenerPaciente(id);
  if (p.estado === 'Archivado') throw new ApiError(409, 'SOLO_LECTURA', 'El historial archivado es de solo lectura');
  const campos = Object.keys(d);
  if (!campos.length) throw new ApiError(400, 'VALIDACION', 'Nada que actualizar');
  await q(`UPDATE paciente SET ${campos.map(k => `${k} = ?`).join(', ')} WHERE id_paciente = ?`, [...campos.map(k => d[k]), id]);
  await registrar(req, { id_paciente: id, tabla: 'paciente', accion: 'MODIFICAR' });
  res.json({ ok: true });
}));

// ---- Archivar (baja sin eliminar) ----
const archivarEsquema = z.object({
  motivo_archivado: z.enum(['Traslado', 'Fallecimiento', 'Causa administrativa']),
  fecha_traslado: fechaOpc(), institucion_destino: txt(150), numero_certificado_defuncion: txt(40), observaciones: txt(255),
  cancelar_citas: z.boolean().default(false)
});

pacientesRouter.get('/pacientes/:id/archivar/impacto', permiso('historial.archivar'), ah(async (req, res) => {
  const id = idParam(req.params.id);
  await obtenerPaciente(id);
  const citas = await q(
    `SELECT id_cita, fecha_hora_cita, id_medico FROM cita WHERE id_paciente = ? AND fecha_hora_cita >= NOW() AND estado_cita IN ('Programada','Confirmada')`, [id]);
  const [h] = await q('SELECT COUNT(*) n FROM hospitalizacion WHERE id_paciente = ? AND fecha_egreso IS NULL', [id]);
  res.json({ citas_futuras: citas, hospitalizacion_activa: h.n > 0 });
}));

pacientesRouter.patch('/pacientes/:id/archivar', permiso('historial.archivar'), ah(async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(archivarEsquema, req.body);
  if (d.motivo_archivado === 'Fallecimiento' && !d.numero_certificado_defuncion)
    throw new ApiError(400, 'VALIDACION', 'El fallecimiento requiere número de certificado de defunción');
  if (d.motivo_archivado === 'Traslado' && !d.institucion_destino)
    throw new ApiError(400, 'VALIDACION', 'El traslado requiere institución de destino');
  await tx(async c => {
    const [p] = await q('SELECT estado FROM paciente WHERE id_paciente = ? FOR UPDATE', [id], c);
    if (!p) throw new ApiError(404, 'NO_ENCONTRADO', 'Paciente no encontrado');
    if (p.estado === 'Archivado') throw new ApiError(409, 'YA_ARCHIVADO', 'El historial ya está archivado');
    const [h] = await q('SELECT COUNT(*) n FROM hospitalizacion WHERE id_paciente = ? AND fecha_egreso IS NULL', [id], c);
    if (h.n) throw new ApiError(409, 'HOSPITALIZACION_ACTIVA', 'Registre primero el egreso del paciente');
    const citas = await q(
      `SELECT id_cita FROM cita WHERE id_paciente = ? AND fecha_hora_cita >= NOW() AND estado_cita IN ('Programada','Confirmada')`, [id], c);
    if (citas.length && !d.cancelar_citas)
      throw new ApiError(409, 'CITAS_PENDIENTES', 'El paciente tiene citas futuras', { citas: citas.map(x => x.id_cita) });
    if (citas.length) await q(`UPDATE cita SET estado_cita = 'Cancelada' WHERE id_cita IN (?)`, [citas.map(x => x.id_cita)], c);
    await q(`UPDATE paciente SET estado = 'Archivado' WHERE id_paciente = ?`, [id], c);
    await registrar(req, { id_paciente: id, tabla: 'paciente', accion: 'ARCHIVAR' }, c);
  });
  // NOTA: el esquema del documento no tiene columnas para guardar el motivo (ver ALTER opcional en 01_esquema.sql).
  res.json({ ok: true, estado: 'Archivado' });
}));

pacientesRouter.patch('/pacientes/:id/reactivar', permiso('historial.archivar'), ah(async (req, res) => {
  const id = idParam(req.params.id);
  const p = await obtenerPaciente(id);
  if (p.estado !== 'Archivado') throw new ApiError(409, 'NO_ARCHIVADO', 'El historial no está archivado');
  await q(`UPDATE paciente SET estado = 'Activo' WHERE id_paciente = ?`, [id]);
  await registrar(req, { id_paciente: id, tabla: 'paciente', accion: 'REACTIVAR' });
  res.json({ ok: true, estado: 'Activo' });
}));
