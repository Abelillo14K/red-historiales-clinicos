'use strict';
// Modelos de entrada de la API. Fase II: campos documentales de Fase I +
// diagnosticos, tratamiento y prescripciones exigidos por la Entrega II.
// Los identificadores son opcionales en altas: si se omiten, el servidor los genera.
const { z } = require('zod');
const str = z.string().trim().min(1).max(255);
const texto = z.string().trim().max(2000);
const opt = z.string().trim().max(1000).optional().nullable();
const id = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Identificador inválido (letras, números, - o _)');
const fechaHora = z.iso.datetime({ offset: true }).transform(value => new Date(value));
const fechaDia = z.iso.date().transform(value => new Date(`${value}T00:00:00.000Z`));
// Límites de captura para evitar errores de digitación; no son criterios clínicos.
const medida = max => z.number().positive().max(max);

const tutor = z.object({
  id_tutor: id.optional(),
  dpi: str,
  nombres: str,
  apellidos: str,
  telefono: opt,
  correo: z.email().max(255).optional().nullable(),
  direccion: opt,
  parentesco: str,
  es_principal: z.boolean()
}).strict();
const tutorActualizar = tutor.omit({ id_tutor: true }).partial().strict()
  .refine(x => Object.keys(x).length > 0, 'Debe enviar al menos un campo');
const tutores = z.object({ tutores: z.array(tutor).min(1).max(10) }).strict();

const patient = z.object({
  id_paciente: id.optional(),
  nombres: str,
  apellidos: str,
  fecha_nacimiento: fechaDia,
  sexo: z.enum(['M', 'F']),
  tutores: z.array(tutor).min(1).max(10)
}).strict();
const patientActualizar = patient.pick({ nombres: true, apellidos: true, fecha_nacimiento: true, sexo: true })
  .partial().strict().refine(x => Object.keys(x).length > 0, 'Debe enviar al menos un campo');

const medico = z.object({
  id_medico: id,
  colegiado: str,
  nombres: str,
  apellidos: str,
  especialidad: z.object({ id_especialidad: id, nombre: str }).strict()
}).strict();

const vacuna = z.object({
  id_vacuna: id,
  nombre: str,
  descripcion: opt
}).strict();

const diagnostico = z.object({ codigo: str.max(20), descripcion: str }).strict();
const tratamiento = z.object({
  descripcion: str,
  recomendaciones: opt
}).strict();
const medicamentoRecetado = z.object({
  id_medicamento: id.optional(),
  nombre: str,
  dosis: str,
  frecuencia: str,
  duracion: str,
  via_administracion: str
}).strict();
const prescripcion = z.object({
  id_prescripcion: id.optional(),
  fecha_emision: fechaHora.optional(),
  indicaciones_generales: opt,
  medicamentos: z.array(medicamentoRecetado).min(1).max(20)
}).strict();

const medicion = {
  peso_kg: medida(250),
  talla_cm: medida(250),
  // Fase I: se registra "si corresponde". Omitirlo requiere el validador de Fase II
  // instalado en MongoDB (ver capacidades en /api/sesion).
  perimetro_cefalico_cm: medida(100).optional().nullable()
};
const crecimiento = z.object({
  id_control: id.optional(),
  id_consulta: id,
  fecha: fechaHora.optional(),
  ...medicion
}).strict();

const consulta = z.object({
  id_consulta: id.optional(),
  id_medico: id,
  fecha_hora: fechaHora,
  motivo: str,
  observaciones: texto.optional().nullable(),
  diagnosticos: z.array(diagnostico).max(20).default([]),
  tratamiento: tratamiento.optional().nullable(),
  prescripciones: z.array(prescripcion).max(20).default([]),
  // Extensión Fase II: control de crecimiento registrado en la misma operación atómica.
  control_crecimiento: z.object({ id_control: id.optional(), ...medicion }).strict().optional().nullable()
}).strict();

const dosis = z.object({
  id_esquema: id.optional(),
  id_vacuna: id,
  numero_dosis: z.number().int().positive().max(20),
  fecha_programada: fechaHora,
  estado: z.enum(['Pendiente', 'Aplicada', 'Cancelada']).optional()
}).strict();

const aplicar = z.object({
  fecha_aplicacion: fechaHora,
  lote: str.max(60),
  id_medico: id
}).strict();

const cancelar = z.object({ motivo_cancelacion: str }).strict();
const archivar = z.object({ motivo_archivado: str }).strict();

const listarPacientes = z.object({
  q: z.string().trim().max(80).optional(),
  estado: z.enum(['Activo', 'Archivado', 'Todos']).default('Activo'),
  sexo: z.enum(['M', 'F']).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(25),
  pagina: z.coerce.number().int().min(1).max(10000).default(1)
}).strict();

// Historial de consultas en un rango de fechas (operación del catálogo de Fase I).
const rangoFechas = z.object({
  desde: fechaHora.optional(),
  hasta: fechaHora.optional()
}).strict().refine(r => !r.desde || !r.hasta || r.desde <= r.hasta, { message: '"desde" debe ser anterior o igual a "hasta"', path: ['desde'] });

const filtroAuditoria = z.object({
  id_paciente: id.optional(),
  accion: z.string().trim().regex(/^[A-Z_]{1,40}$/).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100)
}).strict();

const devLogin = z.object({
  usuario: id.default('USUARIO-DEMO'),
  rol: z.enum(['medico', 'secretaria', 'administrador'])
}).strict();

module.exports = {
  id, tutor, tutorActualizar, tutores, patient, patientActualizar, medico, vacuna, diagnostico,
  tratamiento, prescripcion, consulta, crecimiento, dosis, aplicar, cancelar, archivar,
  listarPacientes, rangoFechas, filtroAuditoria, devLogin
};
