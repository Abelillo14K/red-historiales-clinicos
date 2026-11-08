'use strict';
// Repositorios PostgreSQL del laboratorio. Reciben una función de consulta: la del pool o la de
// un cliente dentro de una transacción (unidad de trabajo), así el mismo código sirve para ambos.
// Los BIGINT llegan como texto (identificadores) y los NUMERIC se convierten a número.
const E = require('../../domain/errors');

// Un id que no es un BIGINT positivo no existe (evita el error 22P02 de PostgreSQL).
const idValido = id => /^[1-9]\d{0,17}$/.test(String(id ?? ''));
const num = v => (v == null ? null : Number(v));
// DATE se envía como texto ISO para no depender de la zona horaria del servidor.
const fecha = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
const bloqueo = opciones => (opciones?.bloquear ? ' FOR UPDATE' : '');
const likeSeguro = t => `%${t.replace(/[\\%_]/g, c => `\\${c}`)}%`;
const pagina = rows => ({ items: rows.map(({ total, ...r }) => r), total: rows[0]?.total ?? 0 });

const COLUMNAS_PACIENTE = `id_paciente::text, nombres, apellidos, documento_identidad, fecha_nacimiento::text, sexo,
  telefono, correo, direccion, contacto_emergencia, telefono_emergencia, observaciones,
  fecha_registro, estado_historial, fecha_archivado, motivo_archivado`;

const COLUMNAS_PARAMETRO_TIPO = `p.id_parametro::text, p.nombre, p.unidad_medida, p.tipo_dato,
  tp.valor_ref_min, tp.valor_ref_max, tp.valor_ref_texto, tp.orden_presentacion`;
const parametroTipo = r => ({ ...r, valor_ref_min: num(r.valor_ref_min), valor_ref_max: num(r.valor_ref_max) });
const detalle = r => ({ ...r, valor_numerico: num(r.valor_numerico) });

function crearRepositorios(q) {
  const filas = async (sql, params) => (await q(sql, params)).rows;
  const fila = async (sql, params) => (await q(sql, params)).rows[0] ?? null;
  const insertar = async (sql, params) => {
    const r = await fila(sql, params);
    return r && Object.values(r)[0];
  };

  const parametrosDe = idTipo => filas(
    `SELECT ${COLUMNAS_PARAMETRO_TIPO} FROM laboratorio.tipo_examen_parametro tp
       JOIN laboratorio.parametro p ON p.id_parametro = tp.id_parametro
      WHERE tp.id_tipo_examen = $1 ORDER BY tp.orden_presentacion`, [idTipo]).then(r => r.map(parametroTipo));

  const detallesDe = idsResultado => (idsResultado.length ? filas(
    `SELECT d.id_resultado::text, d.id_parametro::text, p.nombre AS parametro, p.unidad_medida,
            d.valor_numerico, d.valor_texto, d.fuera_de_rango
       FROM laboratorio.resultado_detalle d JOIN laboratorio.parametro p ON p.id_parametro = d.id_parametro
      WHERE d.id_resultado = ANY($1::bigint[])`, [idsResultado]).then(r => r.map(detalle)) : Promise.resolve([]));

  // Exámenes de varias solicitudes con su resultado y valores, en dos consultas.
  async function examenesDe(idsSolicitud) {
    if (!idsSolicitud.length) return [];
    const examenes = await filas(
      `SELECT e.id_examen::text, e.id_solicitud::text, e.id_tipo_examen::text, t.nombre AS tipo_examen,
              e.codigo_muestra, e.fecha_toma_muestra, e.estado,
              r.id_resultado::text, r.estado AS estado_resultado, r.fecha_analisis, r.observaciones AS observaciones_resultado,
              r.fecha_emision, r.id_personal_valida::text
         FROM laboratorio.examen e
         JOIN laboratorio.tipo_examen t ON t.id_tipo_examen = e.id_tipo_examen
         LEFT JOIN laboratorio.resultado r ON r.id_examen = e.id_examen
        WHERE e.id_solicitud = ANY($1::bigint[]) ORDER BY e.id_examen`, [idsSolicitud]);
    const detalles = await detallesDe(examenes.filter(e => e.id_resultado).map(e => e.id_resultado));
    return examenes.map(({ id_resultado, estado_resultado, fecha_analisis, observaciones_resultado, fecha_emision, id_personal_valida, ...e }) => ({
      ...e,
      resultado: id_resultado ? {
        id_resultado, estado: estado_resultado, fecha_analisis, observaciones: observaciones_resultado, fecha_emision, id_personal_valida,
        detalles: detalles.filter(d => d.id_resultado === id_resultado).map(({ id_resultado: _, ...d }) => d)
      } : null
    }));
  }

  const COLUMNAS_SOLICITUD = `s.id_solicitud::text, s.id_paciente::text, pa.nombres || ' ' || pa.apellidos AS paciente,
    s.id_medico::text, m.nombre_completo AS medico, s.institucion_remitente, s.fecha_solicitud, s.prioridad,
    s.motivo, s.indicaciones, s.observaciones, s.estado, s.registrado_por`;
  const DESDE_SOLICITUD = `FROM laboratorio.solicitud s
    JOIN laboratorio.paciente pa ON pa.id_paciente = s.id_paciente
    LEFT JOIN laboratorio.medico_solicitante m ON m.id_medico = s.id_medico`;

  async function conExamenes(solicitudes) {
    const examenes = await examenesDe(solicitudes.map(s => s.id_solicitud));
    return solicitudes.map(s => ({ ...s, examenes: examenes.filter(e => e.id_solicitud === s.id_solicitud) }));
  }

  const pacientes = {
    crear: d => insertar(
      `INSERT INTO laboratorio.paciente (nombres, apellidos, documento_identidad, fecha_nacimiento, sexo, telefono, correo,
         direccion, contacto_emergencia, telefono_emergencia, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id_paciente::text`,
      [d.nombres, d.apellidos, d.documento_identidad ?? null, fecha(d.fecha_nacimiento), d.sexo, d.telefono ?? null, d.correo ?? null,
        d.direccion ?? null, d.contacto_emergencia ?? null, d.telefono_emergencia ?? null, d.observaciones ?? null]),

    obtener: (id, opciones) => (idValido(id)
      ? fila(`SELECT ${COLUMNAS_PACIENTE} FROM laboratorio.paciente WHERE id_paciente = $1${bloqueo(opciones)}`, [id])
      : Promise.resolve(null)),

    async listar({ texto, estado, limite, saltar }) {
      const t = (texto || '').trim();
      return pagina(await filas(
        `SELECT ${COLUMNAS_PACIENTE}, count(*) OVER ()::int AS total FROM laboratorio.paciente
          WHERE ($1::text IS NULL OR estado_historial = $1)
            AND ($2 = '' OR nombres || ' ' || apellidos ILIKE $3 OR documento_identidad = $2)
          ORDER BY apellidos, nombres, id_paciente LIMIT $4 OFFSET $5`,
        [estado && estado !== 'Todos' ? estado : null, t, likeSeguro(t), limite, saltar]));
    },

    async archivar(id, { motivo_archivado, fecha_archivado }) {
      const r = await q(
        `UPDATE laboratorio.paciente SET estado_historial = 'Archivado', motivo_archivado = $2, fecha_archivado = $3
          WHERE id_paciente = $1 AND estado_historial = 'Activo'`, [id, motivo_archivado, fecha_archivado]);
      return r.rowCount === 1;
    },

    resumen: () => fila(
      `SELECT count(*) FILTER (WHERE estado_historial = 'Activo')::int AS pacientes_activos,
              count(*) FILTER (WHERE estado_historial = 'Archivado')::int AS pacientes_archivados
         FROM laboratorio.paciente`)
  };

  const solicitudes = {
    async crear(s, examenes) {
      const id = await insertar(
        `INSERT INTO laboratorio.solicitud (id_paciente, id_medico, institucion_remitente, fecha_solicitud, prioridad, motivo,
           indicaciones, observaciones, estado, registrado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id_solicitud::text`,
        [s.id_paciente, s.id_medico, s.institucion_remitente, s.fecha_solicitud, s.prioridad, s.motivo, s.indicaciones,
          s.observaciones, s.estado, s.registrado_por]);
      for (const e of examenes) {
        await q(`INSERT INTO laboratorio.examen (id_solicitud, id_tipo_examen, codigo_muestra, fecha_toma_muestra, estado)
                 VALUES ($1,$2,$3,$4,$5)`, [id, e.id_tipo_examen, e.codigo_muestra || null, e.fecha_toma_muestra || null, e.estado]);
      }
      return id;
    },

    async obtener(id) {
      if (!idValido(id)) return null;
      const s = await fila(`SELECT ${COLUMNAS_SOLICITUD} ${DESDE_SOLICITUD} WHERE s.id_solicitud = $1`, [id]);
      return s ? (await conExamenes([s]))[0] : null;
    },

    async listar({ estado, limite, saltar }) {
      return pagina(await filas(
        `SELECT ${COLUMNAS_SOLICITUD}, count(*) OVER ()::int AS total ${DESDE_SOLICITUD}
          WHERE ($1::text IS NULL OR s.estado = $1) ORDER BY s.fecha_solicitud DESC, s.id_solicitud DESC LIMIT $2 OFFSET $3`,
        [estado || null, limite, saltar]));
    },

    async dePaciente(idPaciente) {
      if (!idValido(idPaciente)) return [];
      return conExamenes(await filas(
        `SELECT ${COLUMNAS_SOLICITUD} ${DESDE_SOLICITUD} WHERE s.id_paciente = $1
          ORDER BY s.fecha_solicitud DESC, s.id_solicitud DESC`, [idPaciente]));
    },

    async cambiarEstadoExamen(idExamen, estado) {
      const r = await filas(
        `WITH actualizado AS (
           UPDATE laboratorio.examen SET estado = $2 WHERE id_examen = $1 RETURNING id_examen, id_solicitud, estado)
         SELECT a.estado FROM actualizado a
         UNION ALL
         SELECT e.estado FROM laboratorio.examen e JOIN actualizado a ON a.id_solicitud = e.id_solicitud AND e.id_examen <> a.id_examen`,
        [idExamen, estado]);
      return r.map(x => x.estado);
    },

    async cambiarEstado(idSolicitud, estado) {
      await q('UPDATE laboratorio.solicitud SET estado = $2 WHERE id_solicitud = $1', [idSolicitud, estado]);
    },

    resumen: () => fila(
      `SELECT count(*) FILTER (WHERE estado = 'Pendiente')::int AS pendientes,
              count(*) FILTER (WHERE estado = 'En proceso')::int AS en_proceso,
              count(*) FILTER (WHERE estado = 'Completada')::int AS completadas
         FROM laboratorio.solicitud`)
  };

  const resultados = {
    // Bloquea el examen (y su resultado) para escribir, y comparte el paciente para que no se archive a la vez.
    async contexto(filtro, opciones) {
      const porResultado = filtro.id_resultado != null;
      const id = porResultado ? filtro.id_resultado : filtro.id_examen;
      if (!idValido(id)) return null;
      const c = await fila(
        `SELECT e.id_examen::text, s.id_solicitud::text, s.estado AS estado_solicitud, pa.id_paciente::text, pa.estado_historial,
                t.id_tipo_examen::text, t.nombre AS tipo_examen, r.id_resultado::text, r.estado AS estado_resultado
           FROM laboratorio.examen e
           JOIN laboratorio.solicitud s ON s.id_solicitud = e.id_solicitud
           JOIN laboratorio.paciente pa ON pa.id_paciente = s.id_paciente
           JOIN laboratorio.tipo_examen t ON t.id_tipo_examen = e.id_tipo_examen
           LEFT JOIN laboratorio.resultado r ON r.id_examen = e.id_examen
          WHERE ${porResultado ? 'r.id_resultado' : 'e.id_examen'} = $1
          ${opciones?.bloquear ? 'FOR UPDATE OF e FOR SHARE OF pa' : ''}`, [id]);
      if (!c) return null;
      const detalles = c.id_resultado ? await detallesDe([c.id_resultado]) : [];
      return {
        id_examen: c.id_examen, id_solicitud: c.id_solicitud, estado_solicitud: c.estado_solicitud,
        id_paciente: c.id_paciente, estado_historial: c.estado_historial,
        tipo_examen: { id_tipo_examen: c.id_tipo_examen, nombre: c.tipo_examen },
        parametros: await parametrosDe(c.id_tipo_examen),
        resultado: c.id_resultado ? { id_resultado: c.id_resultado, estado: c.estado_resultado, detalles: detalles.map(({ id_resultado: _, ...d }) => d) } : null
      };
    },

    async guardar(idExamen, { fecha_analisis, observaciones }, detalles) {
      const id = await insertar(
        `INSERT INTO laboratorio.resultado (id_examen, fecha_analisis, observaciones) VALUES ($1, $2, $3)
         ON CONFLICT (id_examen) DO UPDATE SET fecha_analisis = EXCLUDED.fecha_analisis, observaciones = EXCLUDED.observaciones
         WHERE laboratorio.resultado.estado = 'Preliminar'
         RETURNING id_resultado::text`, [idExamen, fecha_analisis, observaciones]);
      if (!id) throw E.conflict('El resultado ya fue validado; no admite cambios');
      for (const d of detalles) {
        await q(
          `INSERT INTO laboratorio.resultado_detalle (id_resultado, id_parametro, valor_numerico, valor_texto, fuera_de_rango)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id_resultado, id_parametro) DO UPDATE SET valor_numerico = EXCLUDED.valor_numerico,
             valor_texto = EXCLUDED.valor_texto, fuera_de_rango = EXCLUDED.fuera_de_rango`,
          [id, d.id_parametro, d.valor_numerico, d.valor_texto, d.fuera_de_rango]);
      }
      return id;
    },

    async validar(idResultado, { id_personal_valida, fecha_emision }) {
      const r = await q(
        `UPDATE laboratorio.resultado SET estado = 'Validado', id_personal_valida = $2, fecha_emision = $3
          WHERE id_resultado = $1 AND estado = 'Preliminar'`, [idResultado, id_personal_valida, fecha_emision]);
      return r.rowCount === 1;
    },

    async obtener(id) {
      if (!idValido(id)) return null;
      const r = await fila(
        `SELECT r.id_resultado::text, r.id_examen::text, r.estado, r.fecha_analisis, r.observaciones, r.fecha_emision,
                r.id_personal_valida::text, per.nombres || ' ' || per.apellidos AS validado_por,
                s.id_solicitud::text, pa.id_paciente::text, pa.nombres || ' ' || pa.apellidos AS paciente,
                e.codigo_muestra, t.id_tipo_examen::text, t.nombre AS tipo_examen
           FROM laboratorio.resultado r
           JOIN laboratorio.examen e ON e.id_examen = r.id_examen
           JOIN laboratorio.solicitud s ON s.id_solicitud = e.id_solicitud
           JOIN laboratorio.paciente pa ON pa.id_paciente = s.id_paciente
           JOIN laboratorio.tipo_examen t ON t.id_tipo_examen = e.id_tipo_examen
           LEFT JOIN laboratorio.personal_laboratorio per ON per.id_personal = r.id_personal_valida
          WHERE r.id_resultado = $1`, [id]);
      if (!r) return null;
      const { id_tipo_examen, tipo_examen, ...resto } = r;
      const detalles = await detallesDe([r.id_resultado]);
      return {
        ...resto, tipo_examen: { id_tipo_examen, nombre: tipo_examen }, parametros: await parametrosDe(id_tipo_examen),
        detalles: detalles.map(({ id_resultado: _, ...d }) => d)
      };
    },

    async listar({ estado, limite, saltar }) {
      return pagina(await filas(
        `SELECT r.id_resultado::text, r.id_examen::text, r.estado, r.fecha_analisis, r.fecha_emision, t.nombre AS tipo_examen,
                pa.id_paciente::text, pa.nombres || ' ' || pa.apellidos AS paciente, count(*) OVER ()::int AS total
           FROM laboratorio.resultado r
           JOIN laboratorio.examen e ON e.id_examen = r.id_examen
           JOIN laboratorio.tipo_examen t ON t.id_tipo_examen = e.id_tipo_examen
           JOIN laboratorio.solicitud s ON s.id_solicitud = e.id_solicitud
           JOIN laboratorio.paciente pa ON pa.id_paciente = s.id_paciente
          WHERE ($1::text IS NULL OR r.estado = $1) ORDER BY r.fecha_analisis DESC, r.id_resultado DESC LIMIT $2 OFFSET $3`,
        [estado || null, limite, saltar]));
    }
  };

  const catalogos = {
    tiposMuestra: () => filas('SELECT id_tipo_muestra::text, nombre FROM laboratorio.tipo_muestra ORDER BY nombre'),
    crearTipoMuestra: d => insertar('INSERT INTO laboratorio.tipo_muestra (nombre) VALUES ($1) RETURNING id_tipo_muestra::text', [d.nombre]),

    parametros: () => filas('SELECT id_parametro::text, nombre, unidad_medida, tipo_dato FROM laboratorio.parametro ORDER BY nombre'),
    crearParametro: d => insertar(
      'INSERT INTO laboratorio.parametro (nombre, unidad_medida, tipo_dato) VALUES ($1,$2,$3) RETURNING id_parametro::text',
      [d.nombre, d.unidad_medida ?? null, d.tipo_dato]),

    tiposExamen: () => filas(
      `SELECT t.id_tipo_examen::text, t.nombre, t.categoria, t.descripcion, t.id_tipo_muestra::text, m.nombre AS tipo_muestra,
              t.tiempo_entrega_horas, t.precio::float8 AS precio, t.activo
         FROM laboratorio.tipo_examen t JOIN laboratorio.tipo_muestra m ON m.id_tipo_muestra = t.id_tipo_muestra
        ORDER BY t.nombre`),
    async obtenerTipoExamen(id) {
      if (!idValido(id)) return null;
      const t = await fila(
        `SELECT t.id_tipo_examen::text, t.nombre, t.categoria, t.descripcion, t.id_tipo_muestra::text, m.nombre AS tipo_muestra,
                t.tiempo_entrega_horas, t.precio::float8 AS precio, t.activo
           FROM laboratorio.tipo_examen t JOIN laboratorio.tipo_muestra m ON m.id_tipo_muestra = t.id_tipo_muestra
          WHERE t.id_tipo_examen = $1`, [id]);
      return t ? { ...t, parametros: await parametrosDe(t.id_tipo_examen) } : null;
    },
    async crearTipoExamen(t, parametros) {
      const id = await insertar(
        `INSERT INTO laboratorio.tipo_examen (nombre, categoria, descripcion, id_tipo_muestra, tiempo_entrega_horas, precio)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_tipo_examen::text`,
        [t.nombre, t.categoria, t.descripcion ?? null, t.id_tipo_muestra, t.tiempo_entrega_horas, t.precio]);
      for (const p of parametros) {
        await q(
          `INSERT INTO laboratorio.tipo_examen_parametro (id_tipo_examen, id_parametro, valor_ref_min, valor_ref_max, valor_ref_texto, orden_presentacion)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, p.id_parametro, p.valor_ref_min ?? null, p.valor_ref_max ?? null, p.valor_ref_texto ?? null, p.orden_presentacion]);
      }
      return id;
    },

    medicos: () => filas(
      `SELECT id_medico::text, nombre_completo, numero_colegiado, institucion_procedencia, telefono_contacto
         FROM laboratorio.medico_solicitante ORDER BY nombre_completo`),
    obtenerMedico: id => (idValido(id) ? fila(
      `SELECT id_medico::text, nombre_completo, numero_colegiado, institucion_procedencia, telefono_contacto
         FROM laboratorio.medico_solicitante WHERE id_medico = $1`, [id]) : Promise.resolve(null)),
    crearMedico: d => insertar(
      `INSERT INTO laboratorio.medico_solicitante (nombre_completo, numero_colegiado, institucion_procedencia, telefono_contacto)
       VALUES ($1,$2,$3,$4) RETURNING id_medico::text`,
      [d.nombre_completo, d.numero_colegiado, d.institucion_procedencia ?? null, d.telefono_contacto ?? null]),

    personal: () => filas(
      `SELECT id_personal::text, nombres, apellidos, cargo, numero_colegiado, usuario, activo
         FROM laboratorio.personal_laboratorio ORDER BY apellidos, nombres`),
    personalPorUsuario: usuario => fila(
      `SELECT id_personal::text, nombres, apellidos, cargo, numero_colegiado, usuario, activo
         FROM laboratorio.personal_laboratorio WHERE usuario = $1`, [usuario]),
    crearPersonal: d => insertar(
      `INSERT INTO laboratorio.personal_laboratorio (nombres, apellidos, cargo, numero_colegiado, usuario)
       VALUES ($1,$2,$3,$4,$5) RETURNING id_personal::text`,
      [d.nombres, d.apellidos, d.cargo, d.numero_colegiado ?? null, d.usuario])
  };

  const auditoria = {
    async registrar(e) {
      await q(`INSERT INTO laboratorio.bitacora (usuario, rol, accion, id_paciente, recurso, resultado, detalle)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [e.usuario, e.rol, e.accion, idValido(e.id_paciente) ? e.id_paciente : null, e.recurso, e.resultado, e.detalle]);
    },
    listar: ({ id_paciente, accion, limite = 50 } = {}) => (id_paciente != null && !idValido(id_paciente) ? Promise.resolve([]) : filas(
      `SELECT id_evento::text, fecha_hora, usuario, rol, accion, id_paciente::text, recurso, resultado, detalle
         FROM laboratorio.bitacora
        WHERE ($1::bigint IS NULL OR id_paciente = $1) AND ($2::text IS NULL OR accion = $2)
        ORDER BY fecha_hora DESC, id_evento DESC LIMIT $3`,
      [id_paciente ?? null, accion || null, limite]))
  };

  return { pacientes, solicitudes, resultados, catalogos, auditoria };
}

module.exports = { crearRepositorios, idValido };
