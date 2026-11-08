'use strict';
// Modelos de entrada de la API de la clínica odontológica. Todo campo desconocido se rechaza (.strict()).
// Los textos opcionales vacíos se guardan como null.
const { z } = require('zod');
const R = require('./domain/reglas');

const str = max => z.string().trim().min(1).max(max);
const opt = max => z.string().trim().max(max).optional().nullable().transform(v => v || null);
const id = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Identificador inválido');
// Colegiado y código de procedimiento son el id del documento en Firestore.
const clave = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,20}$/, 'Solo letras, números y guion');
const fechaHora = z.iso.datetime({ offset: true }).transform(v => new Date(v));
const fechaDia = z.iso.date().transform(v => new Date(`${v}T00:00:00.000Z`));
const pieza = z.string().trim().refine(p => R.PIEZAS.includes(p), 'Pieza inexistente en la numeración FDI').optional().nullable();
const paginacion = {
  limite: z.coerce.number().int().min(1).max(100).default(25),
  pagina: z.coerce.number().int().min(1).max(10000).default(1)
};

const paciente = z.object({
  nombres: str(120),
  apellidos: str(120),
  documento_identidad: z.string().trim().max(20).regex(/^[A-Za-z0-9 -]*$/, 'Solo letras, números, espacios y guion').optional().nullable().transform(v => v || null),
  fecha_nacimiento: fechaDia,
  sexo: z.enum(['M', 'F']),
  contacto: z.object({
    telefono: opt(20), correo: z.email().max(120).optional().nullable().transform(v => v || null), direccion: opt(200),
    contacto_emergencia: opt(120), telefono_emergencia: opt(20)
  }).strict().default({}),
  antecedentes: z.object({ medicos: opt(1000), alergias: opt(500), medicamentos: opt(500) }).strict().default({}),
  atencion_inicial: z.object({ motivo: opt(300), ultima_atencion: z.iso.date().optional().nullable().transform(v => v || null), observaciones: opt(1000) }).strict().default({})
}).strict();

const listarPacientes = z.object({
  q: z.string().trim().max(80).optional(),
  estado: z.enum(['Activo', 'Archivado', 'Todos']).default('Activo'),
  ...paginacion
}).strict();

const archivar = z.object({ motivo_archivado: str(300) }).strict();
const estadoPieza = z.object({ estado: z.enum(R.ESTADOS_PIEZA), observaciones: opt(300) }).strict();

const diagnostico = z.object({ codigo: str(20), descripcion: str(300), pieza }).strict();
const tratamiento = z.object({
  pieza, id_procedimiento: clave.optional().nullable(), procedimiento: opt(150),
  descripcion: opt(1000), recomendaciones: opt(1000)
}).strict().refine(t => t.id_procedimiento || t.procedimiento, { message: 'Elija un procedimiento del catálogo o escriba uno', path: ['procedimiento'] });
const medicamento = z.object({ nombre: str(150), dosis: str(80), frecuencia: str(80), duracion: str(80), via_administracion: str(40) }).strict();
const prescripcion = z.object({ indicaciones_generales: opt(1000), medicamentos: z.array(medicamento).min(1).max(20) }).strict();

const consulta = z.object({
  id_odontologo: clave,
  fecha_hora: fechaHora,
  motivo: str(300),
  id_cita: id.optional().nullable(),
  evaluacion: z.object({ antecedentes: opt(1000), examen_bucal: opt(1000), hallazgos: opt(1000) }).strict().default({}),
  diagnosticos: z.array(diagnostico).max(R.MAX_ELEMENTOS_CONSULTA).default([]),
  tratamientos: z.array(tratamiento).max(R.MAX_ELEMENTOS_CONSULTA).default([]),
  prescripcion: prescripcion.optional().nullable()
}).strict();

const cita = z.object({
  id_paciente: id,
  id_odontologo: clave,
  fecha_hora: fechaHora,
  duracion_min: z.number().int().min(10).max(480).default(30),
  motivo: str(300)
}).strict();
const listarCitas = z.object({
  desde: fechaHora.optional(), hasta: fechaHora.optional(),
  estado: z.enum(R.ESTADOS_CITA).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(200)
}).strict().refine(f => !f.desde || !f.hasta || f.desde <= f.hasta, { message: '"desde" debe ser anterior o igual a "hasta"', path: ['desde'] });
const estadoCita = z.object({ estado: z.enum(R.ESTADOS_CITA.filter(e => e !== 'Programada')) }).strict();

const odontologo = z.object({
  colegiado: clave, nombres: str(120), apellidos: str(120), especialidad: opt(120), telefono: opt(20)
}).strict();
const procedimiento = z.object({
  codigo: clave, nombre: str(150), descripcion: opt(300), precio: z.number().min(0).max(99999999)
}).strict();

const filtroAuditoria = z.object({
  id_paciente: id.optional(),
  accion: z.string().trim().regex(/^[A-Z_]{1,40}$/).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100)
}).strict();

module.exports = {
  id, paciente, listarPacientes, archivar, estadoPieza, diagnostico, tratamiento, prescripcion, consulta,
  cita, listarCitas, estadoCita, odontologo, procedimiento, filtroAuditoria
};
