import { Router } from 'express';
import { z } from 'zod';
import { q, tx } from '../db.js';
import { ah, ApiError } from '../errores.js';
import { permiso } from '../seguridad.js';
import { NOMBRE_MEDICO, entero, fecha, fechaHora, idParam, num, txt, txtReq, validar } from '../utilidades.js';
import { registrar } from '../bitacora.js';
import { obtenerPaciente } from './pacientes.js';

export const clinicoRouter = Router();
const base = '/pacientes/:id';

// Todas las rutas de este archivo son información RESTRINGIDA: historial.leer / clinico.escribir + bitácora.
async function paraLeer(req, tabla) {
  const id = idParam(req.params.id);
  const p = await obtenerPaciente(id);
  if (p.estado === 'Archivado' && !req.permisos.has('historial.leer_archivados'))
    throw new ApiError(403, 'PROHIBIDO', 'Historial archivado');
  await registrar(req, { id_paciente: id, tabla, accion: 'LEER' });
  return id;
}
async function paraEscribir(req) {
  const id = idParam(req.params.id);
  const p = await obtenerPaciente(id);
  if (p.estado !== 'Activo') throw new ApiError(409, 'SOLO_LECTURA', 'El historial no está activo (solo lectura)');
  return id;
}
async function consultaDe(idPaciente, idConsulta, c) {
  const [x] = await q('SELECT * FROM consulta WHERE id_consulta = ? AND id_paciente = ?', [idConsulta, idPaciente], c);
  if (!x) throw new ApiError(404, 'NO_ENCONTRADO', 'Consulta no encontrada para este paciente');
  return x;
}

// ---------- Lecturas ----------
clinicoRouter.get(`${base}/consultas`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'consulta');
  const f = ['c.id_paciente = ?'], p = [id];
  if (req.query.desde) { f.push('c.fecha_hora_consulta >= ?'); p.push(`${req.query.desde} 00:00:00`); }
  if (req.query.hasta) { f.push('c.fecha_hora_consulta <= ?'); p.push(`${req.query.hasta} 23:59:59`); }
  const items = await q(
    `SELECT c.id_consulta, c.fecha_hora_consulta AS fecha_hora, c.tipo_consulta, ${NOMBRE_MEDICO()} AS medico,
            COALESCE(ci.motivo, c.observaciones) AS motivo, c.observaciones, c.anamnesis, c.examen_fisico, c.plan_tratamiento
       FROM consulta c JOIN medico m ON m.id_medico = c.id_medico LEFT JOIN cita ci ON ci.id_cita = c.id_cita
      WHERE ${f.join(' AND ')} ORDER BY c.fecha_hora_consulta DESC`, p);
  res.json({ items, total: items.length });
}));

clinicoRouter.get(`${base}/consultas/:c`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'consulta');
  const cons = await consultaDe(id, idParam(req.params.c, 'consulta'));
  const [signos] = await q('SELECT * FROM signos_vitales WHERE id_consulta = ?', [cons.id_consulta]);
  res.json({
    consulta: cons, signos_vitales: signos || null,
    diagnosticos: await q(`SELECT cd.*, d.codigo_cie10, d.nombre_diagnostico FROM consulta_diagnostico cd JOIN diagnostico d USING (id_diagnostico) WHERE cd.id_consulta = ?`, [cons.id_consulta]),
    prescripcion: (await q('SELECT * FROM prescripcion WHERE id_consulta = ?', [cons.id_consulta]))[0] || null
  });
}));

clinicoRouter.get(`${base}/diagnosticos`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'consulta_diagnostico');
  const items = await q(
    `SELECT d.codigo_cie10 AS codigo, d.nombre_diagnostico AS descripcion, cd.tipo, cd.observaciones, c.id_consulta, c.fecha_hora_consulta AS fecha
       FROM consulta_diagnostico cd JOIN consulta c USING (id_consulta) JOIN diagnostico d USING (id_diagnostico)
      WHERE c.id_paciente = ? ORDER BY c.fecha_hora_consulta DESC`, [id]);
  res.json({ items, total: items.length });
}));

clinicoRouter.get(`${base}/tratamientos`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'consulta');
  const items = await q(
    `SELECT c.id_consulta, c.plan_tratamiento AS descripcion, pr.indicaciones_generales AS recomendaciones, c.fecha_hora_consulta AS fecha
       FROM consulta c LEFT JOIN prescripcion pr ON pr.id_consulta = c.id_consulta
      WHERE c.id_paciente = ? AND c.plan_tratamiento IS NOT NULL ORDER BY c.fecha_hora_consulta DESC`, [id]);
  res.json({ items, total: items.length });
}));

clinicoRouter.get(`${base}/prescripciones`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'prescripcion');
  const items = await q(
    `SELECT pd.id_prescripcion_detalle, m.nombre_generico AS medicamento, m.nombre_comercial, pd.dosis, pd.frecuencia, pd.duracion,
            COALESCE(pd.via_administracion, m.via_administracion) AS via_administracion, pr.fecha_emision, c.id_consulta
       FROM prescripcion_detalle pd JOIN prescripcion pr USING (id_prescripcion) JOIN consulta c ON c.id_consulta = pr.id_consulta
       JOIN medicamento m ON m.id_medicamento = pd.id_medicamento
      WHERE c.id_paciente = ? ORDER BY pr.fecha_emision DESC, pd.id_prescripcion_detalle`, [id]);
  res.json({ items, total: items.length });
}));

clinicoRouter.get(`${base}/examenes`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'orden_examen');
  const soloPendientes = req.query.estado === 'pendientes';
  const items = await q(
    `SELECT od.id_orden_detalle, e.nombre_examen AS examen, o.fecha_orden AS fecha, o.estado,
            r.valor_resultado AS resultado, r.unidad, r.interpretacion, r.fecha_resultado
       FROM orden_examen_detalle od JOIN orden_examen o USING (id_orden) JOIN consulta c ON c.id_consulta = o.id_consulta
       JOIN examen e ON e.id_examen = od.id_examen LEFT JOIN resultado_examen r ON r.id_orden_detalle = od.id_orden_detalle
      WHERE c.id_paciente = ? ${soloPendientes ? 'AND r.id_resultado IS NULL' : ''} ORDER BY o.fecha_orden DESC`, [id]);
  res.json({ items, total: items.length });
}));

clinicoRouter.get(`${base}/hospitalizaciones`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'hospitalizacion');
  const items = await q(
    `SELECT h.id_hospitalizacion, h.fecha_ingreso AS ingreso, h.fecha_egreso AS egreso, d.nombre_departamento AS servicio,
            CONCAT(hb.numero_habitacion, '-', cm.numero_cama) AS cama, h.motivo_ingreso, h.condicion_egreso,
            IF(h.fecha_egreso IS NULL, 'Activa', 'Egresado') AS estado
       FROM hospitalizacion h JOIN cama cm USING (id_cama) JOIN habitacion hb USING (id_habitacion)
       JOIN departamento d ON d.id_departamento = hb.id_departamento
      WHERE h.id_paciente = ? ORDER BY h.fecha_ingreso DESC`, [id]);
  res.json({ items, total: items.length });
}));

clinicoRouter.get(`${base}/antecedentes`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'antecedente_personal');
  await registrar(req, { id_paciente: id, tabla: 'antecedente_familiar', accion: 'LEER' });
  const items = await q(
    `SELECT 'Personal' AS tipo, tipo AS detalle_tipo, descripcion, fecha_registro FROM antecedente_personal WHERE id_paciente = ?
     UNION ALL
     SELECT 'Familiar', parentesco, CONCAT(condicion, IF(observaciones IS NULL, '', CONCAT(' — ', observaciones))), NULL
       FROM antecedente_familiar WHERE id_paciente = ?
     ORDER BY fecha_registro DESC`, [id, id]);
  res.json({ items, total: items.length });
}));

// ---------- Alertas de alergia ----------
// El documento NO relaciona medicamento con alergia: se compara por nombre (genérico/comercial vs. nombre de la alergia).
async function alertasAlergia(idPaciente, idsMedicamento, c) {
  if (!idsMedicamento.length) return [];
  return q(
    `SELECT m.id_medicamento, m.nombre_generico AS medicamento, a.nombre_alergia AS alergia, pa.severidad
       FROM medicamento m
       JOIN paciente_alergia pa ON pa.id_paciente = ?
       JOIN alergia a ON a.id_alergia = pa.id_alergia
      WHERE m.id_medicamento IN (?)
        AND (LOWER(m.nombre_generico) LIKE CONCAT('%', LOWER(a.nombre_alergia), '%')
          OR LOWER(a.nombre_alergia) LIKE CONCAT('%', LOWER(m.nombre_generico), '%')
          OR (m.nombre_comercial IS NOT NULL AND LOWER(a.nombre_alergia) LIKE CONCAT('%', LOWER(m.nombre_comercial), '%')))`,
    [idPaciente, idsMedicamento], c);
}

clinicoRouter.post(`${base}/alertas-medicamento`, permiso('historial.leer'), ah(async (req, res) => {
  const id = await paraLeer(req, 'paciente_alergia');
  const { medicamentos } = validar(z.object({ medicamentos: z.array(entero()).min(1) }), req.body);
  res.json({ alertas: await alertasAlergia(id, medicamentos) });
}));

// ---------- Escrituras ----------
const medicamentoEsq = z.object({
  id_medicamento: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().positive().optional()),
  nombre: txt(150), dosis: txtReq(60), frecuencia: txtReq(60), duracion: txt(60), via_administracion: txt(50), observaciones: txt(255)
}).refine(m => m.id_medicamento || m.nombre, 'Indique id_medicamento o nombre');
const prescripcionEsq = z.object({ indicaciones_generales: txt(20000), medicamentos: z.array(medicamentoEsq).min(1) });
const diagEsq = z.object({
  id_diagnostico: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().positive().optional()),
  codigo: txt(10), tipo: z.enum(['Principal', 'Secundario']).default('Principal'), observaciones: txt(255)
}).refine(d => d.id_diagnostico || d.codigo, 'Indique id_diagnostico o codigo CIE-10');

const signosEsq = z.object({
  presion_sistolica: num(), presion_diastolica: num(), frecuencia_cardiaca: num(), frecuencia_respiratoria: num(),
  temperatura: num(), saturacion_oxigeno: num(), peso: num(), talla: num()
});
const consultaEsq = z.object({
  id_cita: z.preprocess(v => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()).default(null),
  tipo_consulta: z.enum(['Programada', 'Directa', 'Emergencia']).optional(),
  id_medico: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().positive().optional()),
  fecha_hora: z.string().min(10),
  motivo: txt(255), anamnesis: txt(20000), examen_fisico: txt(20000), plan_tratamiento: txt(20000), observaciones: txt(20000),
  signos_vitales: signosEsq.nullish(),
  diagnosticos: z.array(diagEsq).default([]),
  prescripcion: prescripcionEsq.nullish(),
  examenes: z.array(entero()).default([])
});

async function resolverDiagnostico(d, c) {
  if (d.id_diagnostico) return d.id_diagnostico;
  const [x] = await q('SELECT id_diagnostico FROM diagnostico WHERE codigo_cie10 = ?', [d.codigo], c);
  if (!x) throw new ApiError(422, 'REFERENCIA_INVALIDA', `Código CIE-10 no existe en el catálogo: ${d.codigo}`);
  return x.id_diagnostico;
}
async function resolverMedicamento(m, c) {
  if (m.id_medicamento) return m.id_medicamento;
  const [x] = await q('SELECT id_medicamento FROM medicamento WHERE LOWER(nombre_generico) = LOWER(?) OR LOWER(nombre_comercial) = LOWER(?) LIMIT 1', [m.nombre, m.nombre], c);
  if (!x) throw new ApiError(422, 'REFERENCIA_INVALIDA', `Medicamento no existe en el catálogo: ${m.nombre}`);
  return x.id_medicamento;
}
async function insertarPrescripcion(idConsulta, pr, c) {
  const r = await q('INSERT INTO prescripcion (id_consulta, fecha_emision, indicaciones_generales) VALUES (?, CURDATE(), ?)', [idConsulta, pr.indicaciones_generales], c);
  const ids = [];
  for (const m of pr.medicamentos) {
    const idm = await resolverMedicamento(m, c);
    ids.push(idm);
    await q('INSERT INTO prescripcion_detalle (id_prescripcion, id_medicamento, dosis, frecuencia, duracion, via_administracion, observaciones) VALUES (?,?,?,?,?,?,?)',
      [r.insertId, idm, m.dosis, m.frecuencia, m.duracion, m.via_administracion, m.observaciones], c);
  }
  return { id: r.insertId, ids };
}

// Registra la consulta completa (atención + signos + diagnósticos + receta + órdenes de examen) en UNA transacción.
clinicoRouter.post(`${base}/consultas`, permiso('clinico.escribir'), ah(async (req, res) => {
  const idPaciente = await paraEscribir(req);
  const d = validar(consultaEsq, req.body);
  const idMedico = d.id_medico ?? req.usuario.id_medico;
  if (!idMedico) throw new ApiError(400, 'VALIDACION', 'Indique el médico responsable');
  const fh = fechaHora(d.fecha_hora);

  const out = await tx(async c => {
    const [m] = await q(`SELECT estado FROM medico WHERE id_medico = ?`, [idMedico], c);
    if (!m || m.estado !== 'Activo') throw new ApiError(422, 'REFERENCIA_INVALIDA', 'Médico inexistente o inactivo');
    let tipo = d.tipo_consulta || 'Directa';
    if (d.id_cita) {
      const [ci] = await q('SELECT * FROM cita WHERE id_cita = ? AND id_paciente = ? FOR UPDATE', [d.id_cita, idPaciente], c);
      if (!ci) throw new ApiError(404, 'NO_ENCONTRADO', 'La cita no existe para este paciente');
      if (!['Programada', 'Confirmada'].includes(ci.estado_cita)) throw new ApiError(409, 'CITA_NO_VIGENTE', `La cita está ${ci.estado_cita}`);
      tipo = 'Programada';
    } else if (tipo === 'Programada') tipo = 'Directa';

    const r = await q(
      `INSERT INTO consulta (id_cita, id_paciente, id_medico, fecha_hora_consulta, tipo_consulta, anamnesis, examen_fisico, plan_tratamiento, observaciones)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [d.id_cita, idPaciente, idMedico, fh, tipo, d.anamnesis, d.examen_fisico, d.plan_tratamiento,
        // sin cita no hay dónde guardar el motivo: se conserva en observaciones
        d.id_cita ? d.observaciones : [d.motivo && `Motivo: ${d.motivo}`, d.observaciones].filter(Boolean).join('\n') || null], c);
    const idc = r.insertId;
    if (d.id_cita) await q(`UPDATE cita SET estado_cita = 'Atendida' WHERE id_cita = ?`, [d.id_cita], c);

    const s = d.signos_vitales;
    if (s && Object.values(s).some(v => v != null)) {
      const imc = s.peso && s.talla ? Math.round((s.peso / (s.talla * s.talla)) * 100) / 100 : null;
      await q(
        `INSERT INTO signos_vitales (id_consulta, presion_sistolica, presion_diastolica, frecuencia_cardiaca, frecuencia_respiratoria,
           temperatura, saturacion_oxigeno, peso, talla, imc) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [idc, s.presion_sistolica, s.presion_diastolica, s.frecuencia_cardiaca, s.frecuencia_respiratoria, s.temperatura, s.saturacion_oxigeno, s.peso, s.talla, imc], c);
    }
    for (const dg of d.diagnosticos)
      await q('INSERT INTO consulta_diagnostico (id_consulta, id_diagnostico, tipo, observaciones) VALUES (?,?,?,?)',
        [idc, await resolverDiagnostico(dg, c), dg.tipo, dg.observaciones], c);
    let alertas = [];
    if (d.prescripcion) {
      const pr = await insertarPrescripcion(idc, d.prescripcion, c);
      alertas = await alertasAlergia(idPaciente, pr.ids, c);
    }
    if (d.examenes.length) {
      const o = await q('INSERT INTO orden_examen (id_consulta, id_medico) VALUES (?,?)', [idc, idMedico], c);
      for (const e of [...new Set(d.examenes)])
        await q('INSERT INTO orden_examen_detalle (id_orden, id_examen) VALUES (?,?)', [o.insertId, e], c);
    }
    await registrar(req, { id_paciente: idPaciente, tabla: 'consulta', accion: 'CREAR' }, c);
    return { id_consulta: idc, alertas };
  });
  res.status(201).json(out);
}));

// Operaciones sueltas (api.js: agregarDiagnostico, establecerTratamiento, agregarPrescripcion)
clinicoRouter.post(`${base}/consultas/:c/diagnosticos`, permiso('clinico.escribir'), ah(async (req, res) => {
  const idp = await paraEscribir(req);
  const d = validar(diagEsq, req.body);
  await tx(async c => {
    const cons = await consultaDe(idp, idParam(req.params.c, 'consulta'), c);
    await q('INSERT INTO consulta_diagnostico (id_consulta, id_diagnostico, tipo, observaciones) VALUES (?,?,?,?)',
      [cons.id_consulta, await resolverDiagnostico(d, c), d.tipo, d.observaciones], c);
    await registrar(req, { id_paciente: idp, tabla: 'consulta_diagnostico', accion: 'CREAR' }, c);
  });
  res.status(201).json({ ok: true });
}));

clinicoRouter.put(`${base}/consultas/:c/tratamiento`, permiso('clinico.escribir'), ah(async (req, res) => {
  const idp = await paraEscribir(req);
  const d = validar(z.object({ descripcion: txtReq(20000), recomendaciones: txt(20000) }), req.body);
  await tx(async c => {
    const cons = await consultaDe(idp, idParam(req.params.c, 'consulta'), c);
    await q('UPDATE consulta SET plan_tratamiento = ? WHERE id_consulta = ?', [d.descripcion, cons.id_consulta], c);
    if (d.recomendaciones) {
      const [pr] = await q('SELECT id_prescripcion FROM prescripcion WHERE id_consulta = ?', [cons.id_consulta], c);
      if (pr) await q('UPDATE prescripcion SET indicaciones_generales = ? WHERE id_prescripcion = ?', [d.recomendaciones, pr.id_prescripcion], c);
      else await q('INSERT INTO prescripcion (id_consulta, fecha_emision, indicaciones_generales) VALUES (?, CURDATE(), ?)', [cons.id_consulta, d.recomendaciones], c);
    }
    await registrar(req, { id_paciente: idp, tabla: 'consulta', accion: 'MODIFICAR' }, c);
  });
  res.json({ ok: true });
}));

clinicoRouter.post(`${base}/consultas/:c/prescripciones`, permiso('clinico.escribir'), ah(async (req, res) => {
  const idp = await paraEscribir(req);
  const d = validar(prescripcionEsq, req.body);
  const out = await tx(async c => {
    const cons = await consultaDe(idp, idParam(req.params.c, 'consulta'), c);
    const [ya] = await q('SELECT id_prescripcion FROM prescripcion WHERE id_consulta = ?', [cons.id_consulta], c);
    if (ya) throw new ApiError(409, 'DUPLICADO', 'La consulta ya tiene una receta');
    const pr = await insertarPrescripcion(cons.id_consulta, d, c);
    await registrar(req, { id_paciente: idp, tabla: 'prescripcion', accion: 'CREAR' }, c);
    return { id_prescripcion: pr.id, alertas: await alertasAlergia(idp, pr.ids, c) };
  });
  res.status(201).json(out);
}));

clinicoRouter.post(`${base}/alergias`, permiso('clinico.escribir'), ah(async (req, res) => {
  const idp = await paraEscribir(req);
  const d = validar(z.object({ id_alergia: entero(), severidad: z.enum(['Leve', 'Moderada', 'Severa']), reaccion: txt(255) }), req.body);
  await q(
    `INSERT INTO paciente_alergia (id_paciente, id_alergia, severidad, reaccion, fecha_diagnostico) VALUES (?,?,?,?,CURDATE())
     ON DUPLICATE KEY UPDATE severidad = VALUES(severidad), reaccion = VALUES(reaccion)`, [idp, d.id_alergia, d.severidad, d.reaccion]);
  await registrar(req, { id_paciente: idp, tabla: 'paciente_alergia', accion: 'CREAR' });
  res.status(201).json({ ok: true });
}));

clinicoRouter.post(`${base}/antecedentes`, permiso('clinico.escribir'), ah(async (req, res) => {
  const idp = await paraEscribir(req);
  const d = validar(z.discriminatedUnion('clase', [
    z.object({ clase: z.literal('personal'), tipo: txtReq(30), descripcion: txtReq(20000) }),
    z.object({ clase: z.literal('familiar'), parentesco: txtReq(40), condicion: txtReq(150), observaciones: txt(20000) })
  ]), req.body);
  if (d.clase === 'personal') {
    await q('INSERT INTO antecedente_personal (id_paciente, tipo, descripcion, fecha_registro) VALUES (?,?,?,CURDATE())', [idp, d.tipo, d.descripcion]);
    await registrar(req, { id_paciente: idp, tabla: 'antecedente_personal', accion: 'CREAR' });
  } else {
    await q('INSERT INTO antecedente_familiar (id_paciente, parentesco, condicion, observaciones) VALUES (?,?,?,?)', [idp, d.parentesco, d.condicion, d.observaciones]);
    await registrar(req, { id_paciente: idp, tabla: 'antecedente_familiar', accion: 'CREAR' });
  }
  res.status(201).json({ ok: true });
}));

// Registrar resultado de un examen ordenado (1 a 1 con orden_examen_detalle)
clinicoRouter.post(`${base}/examenes/:detalle/resultado`, permiso('clinico.escribir'), ah(async (req, res) => {
  const idp = await paraEscribir(req);
  const d = validar(z.object({ valor_resultado: txtReq(150), unidad: txt(30), interpretacion: txt(255), archivo_adjunto: txt(255) }), req.body);
  await tx(async c => {
    const [od] = await q(
      `SELECT od.id_orden_detalle, od.id_orden FROM orden_examen_detalle od JOIN orden_examen o USING (id_orden) JOIN consulta cs ON cs.id_consulta = o.id_consulta
        WHERE od.id_orden_detalle = ? AND cs.id_paciente = ?`, [idParam(req.params.detalle, 'detalle'), idp], c);
    if (!od) throw new ApiError(404, 'NO_ENCONTRADO', 'Examen ordenado no encontrado para este paciente');
    await q('INSERT INTO resultado_examen (id_orden_detalle, valor_resultado, unidad, interpretacion, archivo_adjunto, id_medico_valida) VALUES (?,?,?,?,?,?)',
      [od.id_orden_detalle, d.valor_resultado, d.unidad, d.interpretacion, d.archivo_adjunto, req.usuario.id_medico], c);
    const [{ falta }] = await q(
      `SELECT COUNT(*) falta FROM orden_examen_detalle x LEFT JOIN resultado_examen r ON r.id_orden_detalle = x.id_orden_detalle
        WHERE x.id_orden = ? AND r.id_resultado IS NULL`, [od.id_orden], c);
    await q('UPDATE orden_examen SET estado = ? WHERE id_orden = ?', [falta ? 'En proceso' : 'Completada', od.id_orden], c);
    await registrar(req, { id_paciente: idp, tabla: 'resultado_examen', accion: 'CREAR' }, c);
  });
  res.status(201).json({ ok: true });
}));
