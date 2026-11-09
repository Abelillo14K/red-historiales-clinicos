import { Router } from 'express';
import { q } from '../db.js';
import { ah, ApiError } from '../errores.js';
import { permiso } from '../seguridad.js';
import { idParam, paginacion } from '../utilidades.js';

export const catalogosRouter = Router();

// Catálogos del documento. `campos` = columnas editables; `req` = obligatorias; `buscar` = columnas para ?q=
// Nota: salvo `medico`, las tablas de catálogo del documento no tienen columna de estado, por lo que no se "desactivan".
const CAT = {
  departamentos: { t: 'departamento', pk: 'id_departamento', campos: ['nombre_departamento', 'ubicacion', 'extension_telefono'], req: ['nombre_departamento'], buscar: ['nombre_departamento'] },
  especialidades: { t: 'especialidad', pk: 'id_especialidad', campos: ['nombre_especialidad', 'descripcion'], req: ['nombre_especialidad'], buscar: ['nombre_especialidad'] },
  seguros: { t: 'seguro', pk: 'id_seguro', campos: ['nombre_aseguradora', 'telefono_contacto', 'direccion'], req: ['nombre_aseguradora'], buscar: ['nombre_aseguradora'] },
  diagnosticos: { t: 'diagnostico', pk: 'id_diagnostico', campos: ['codigo_cie10', 'nombre_diagnostico', 'descripcion'], req: ['codigo_cie10', 'nombre_diagnostico'], buscar: ['codigo_cie10', 'nombre_diagnostico'] },
  medicamentos: { t: 'medicamento', pk: 'id_medicamento', campos: ['nombre_generico', 'nombre_comercial', 'presentacion', 'concentracion', 'via_administracion'], req: ['nombre_generico'], buscar: ['nombre_generico', 'nombre_comercial'] },
  examenes: { t: 'examen', pk: 'id_examen', campos: ['nombre_examen', 'tipo_examen', 'unidad_medida', 'valor_referencia'], req: ['nombre_examen'], buscar: ['nombre_examen'] },
  alergias: { t: 'alergia', pk: 'id_alergia', campos: ['nombre_alergia', 'tipo'], req: ['nombre_alergia'], buscar: ['nombre_alergia'] },
  profesionales: { t: 'medico', pk: 'id_medico',
    campos: ['colegiado', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'id_especialidad', 'id_departamento', 'telefono', 'correo', 'estado'],
    req: ['colegiado', 'primer_nombre', 'primer_apellido', 'id_especialidad', 'id_departamento'], buscar: ['colegiado', 'primer_nombre', 'primer_apellido'] }
};
const cat = n => CAT[n] || (() => { throw new ApiError(404, 'NO_ENCONTRADO', `Catálogo desconocido: ${n}`); })();

function limpiar(c, body, parcial) {
  const out = {};
  for (const k of c.campos) {
    if (body[k] === undefined) continue;
    const v = typeof body[k] === 'string' ? body[k].trim() : body[k];
    out[k] = v === '' ? null : v;
  }
  if (!parcial) for (const k of c.req) if (out[k] == null) throw new ApiError(400, 'VALIDACION', `Campo requerido: ${k}`);
  if (parcial && Object.keys(out).length === 0) throw new ApiError(400, 'VALIDACION', 'Nada que actualizar');
  for (const k of c.req) if (k in out && out[k] == null) throw new ApiError(400, 'VALIDACION', `Campo requerido: ${k}`);
  if (out.estado && !['Activo', 'Inactivo'].includes(out.estado)) throw new ApiError(400, 'VALIDACION', 'estado inválido');
  return out;
}

catalogosRouter.get('/catalogos', permiso('catalogos.ver'), (req, res) => res.json({ catalogos: Object.keys(CAT) }));

catalogosRouter.get('/catalogos/:nombre', permiso('catalogos.ver'), ah(async (req, res) => {
  const c = cat(req.params.nombre);
  const { limite, desplazamiento } = paginacion(req.query, 500);
  const texto = String(req.query.q || '').trim();
  const where = texto ? `WHERE ${c.buscar.map(b => `${b} LIKE ?`).join(' OR ')}` : '';
  const p = texto ? c.buscar.map(() => `%${texto}%`) : [];
  const items = await q(`SELECT * FROM ${c.t} ${where} ORDER BY ${c.pk} LIMIT ? OFFSET ?`, [...p, limite, desplazamiento]);
  const [{ total }] = await q(`SELECT COUNT(*) total FROM ${c.t} ${where}`, p);
  res.json({ items, total });
}));

catalogosRouter.post('/catalogos/:nombre', permiso('catalogos.editar'), ah(async (req, res) => {
  const c = cat(req.params.nombre);
  const d = limpiar(c, req.body || {}, false);
  const k = Object.keys(d);
  const r = await q(`INSERT INTO ${c.t} (${k.join(', ')}) VALUES (${k.map(() => '?').join(', ')})`, k.map(x => d[x]));
  res.status(201).json({ [c.pk]: r.insertId });
}));

catalogosRouter.put('/catalogos/:nombre/:id', permiso('catalogos.editar'), ah(async (req, res) => {
  const c = cat(req.params.nombre);
  const id = idParam(req.params.id);
  const d = limpiar(c, req.body || {}, true);
  const k = Object.keys(d);
  const r = await q(`UPDATE ${c.t} SET ${k.map(x => `${x} = ?`).join(', ')} WHERE ${c.pk} = ?`, [...k.map(x => d[x]), id]);
  if (!r.affectedRows) throw new ApiError(404, 'NO_ENCONTRADO', 'Registro no encontrado');
  res.json({ ok: true });
}));
