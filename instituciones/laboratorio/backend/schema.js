'use strict';
// Modelos de entrada de la API del laboratorio. Todo campo desconocido se rechaza (.strict()).
// Los textos opcionales vacíos se guardan como null.
const { z } = require('zod');
const R = require('./domain/reglas');

const str = max => z.string().trim().min(1).max(max);
const opt = max => z.string().trim().max(max).optional().nullable().transform(v => v || null);
// Identificador de un registro del laboratorio (BIGINT), como texto o número.
const idRef = z.coerce.string().regex(/^[1-9]\d{0,17}$/, 'Identificador inválido');
const fechaHora = z.iso.datetime({ offset: true }).transform(v => new Date(v));
const fechaDia = z.iso.date().transform(v => new Date(`${v}T00:00:00.000Z`));
const paginacion = {
  limite: z.coerce.number().int().min(1).max(100).default(25),
  pagina: z.coerce.number().int().min(1).max(10000).default(1)
};

const paciente = z.object({
  nombres: str(120),
  apellidos: str(120),
  documento_identidad: opt(20),
  fecha_nacimiento: fechaDia,
  sexo: z.enum(['M', 'F']),
  telefono: opt(20),
  correo: z.email().max(120).optional().nullable(),
  direccion: opt(200),
  contacto_emergencia: opt(120),
  telefono_emergencia: opt(20),
  observaciones: opt(500)
}).strict();

const listarPacientes = z.object({
  q: z.string().trim().max(80).optional(),
  estado: z.enum(['Activo', 'Archivado', 'Todos']).default('Activo'),
  ...paginacion
}).strict();

const archivar = z.object({ motivo_archivado: str(300) }).strict();

const examenSolicitado = z.object({
  id_tipo_examen: idRef,
  codigo_muestra: opt(30),
  fecha_toma_muestra: fechaHora.optional().nullable()
}).strict();

const solicitud = z.object({
  id_medico: idRef.optional().nullable(),
  institucion_remitente: opt(150),
  fecha_solicitud: fechaHora.optional(),
  prioridad: z.enum(R.PRIORIDADES).default('Rutina'),
  motivo: opt(500),
  indicaciones: opt(500),
  observaciones: opt(500),
  examenes: z.array(examenSolicitado).min(1).max(20)
}).strict();

const listarSolicitudes = z.object({ estado: z.enum(R.ESTADOS_SOLICITUD).optional(), ...paginacion }).strict();

const resultado = z.object({
  fecha_analisis: fechaHora.optional(),
  observaciones: opt(500),
  valores: z.array(z.object({
    id_parametro: idRef,
    valor: z.union([z.number(), z.string().trim().max(80)])
  }).strict()).min(1).max(100)
}).strict();

const listarResultados = z.object({ estado: z.enum(R.ESTADOS_RESULTADO).optional(), ...paginacion }).strict();

const tipoMuestra = z.object({ nombre: str(60) }).strict();

const parametro = z.object({
  nombre: str(80),
  unidad_medida: opt(20),
  tipo_dato: z.enum(['Numerico', 'Texto'])
}).strict();

const referencia = z.number().min(-99999999).max(99999999).optional().nullable();
const tipoExamen = z.object({
  nombre: str(120),
  categoria: str(60),
  descripcion: opt(255),
  id_tipo_muestra: idRef,
  tiempo_entrega_horas: z.number().int().positive().max(8760),
  precio: z.number().min(0).max(99999999),
  parametros: z.array(z.object({
    id_parametro: idRef,
    valor_ref_min: referencia,
    valor_ref_max: referencia,
    valor_ref_texto: opt(80),
    orden_presentacion: z.number().int().positive().max(500)
  }).strict().refine(p => p.valor_ref_min == null || p.valor_ref_max == null || p.valor_ref_min <= p.valor_ref_max,
    { message: 'El mínimo debe ser menor o igual que el máximo', path: ['valor_ref_min'] })).min(1).max(50)
}).strict();

const medico = z.object({
  nombre_completo: str(150),
  numero_colegiado: str(20),
  institucion_procedencia: opt(150),
  telefono_contacto: opt(20)
}).strict();

const personal = z.object({
  nombres: str(120),
  apellidos: str(120),
  cargo: z.enum(['Tecnico', 'Bioquimico', 'Patologo']),
  numero_colegiado: opt(20),
  usuario: z.string().trim().regex(/^[A-Za-z0-9._@-]{1,80}$/, 'Usuario inválido')
}).strict();

const filtroAuditoria = z.object({
  id_paciente: idRef.optional(),
  accion: z.string().trim().regex(/^[A-Z_]{1,40}$/).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100)
}).strict();

module.exports = {
  idRef, paciente, listarPacientes, archivar, solicitud, listarSolicitudes, resultado, listarResultados,
  tipoMuestra, parametro, tipoExamen, medico, personal, filtroAuditoria
};
