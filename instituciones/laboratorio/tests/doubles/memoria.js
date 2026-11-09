'use strict';
// Doble en memoria de los puertos del laboratorio, con la misma semántica que el adaptador PostgreSQL.
// La unidad de trabajo copia el estado y lo restaura si la operación falla (simula ROLLBACK).
const E = require('../../backend/domain/errors');

const copia = x => structuredClone(x);

function crearRepositoriosMemoria({ fallarAuditoria = false } = {}) {
  let db = {
    secuencia: 0, pacientes: [], medicos: [], personal: [], tiposMuestra: [], parametros: [], tiposExamen: [],
    tipoExamenParametro: [], solicitudes: [], examenes: [], resultados: [], detalles: [], cuentas: [], bitacora: []
  };
  const nuevoId = () => String(++db.secuencia);
  const unico = (lista, campo, valor, mensaje) => {
    if (valor != null && lista.some(x => x[campo] === valor)) throw E.conflict(mensaje);
  };
  const pagina = (items, { limite = 20, saltar = 0 }) => ({ items: items.slice(saltar, saltar + limite), total: items.length });

  const parametrosDe = id_tipo_examen => db.tipoExamenParametro
    .filter(tp => tp.id_tipo_examen === id_tipo_examen)
    .sort((a, b) => a.orden_presentacion - b.orden_presentacion)
    .map(tp => ({ ...db.parametros.find(p => p.id_parametro === tp.id_parametro), ...tp }));
  const nombreDe = p => `${p.nombres} ${p.apellidos}`;
  const pacienteDe = id => db.pacientes.find(p => p.id_paciente === id);
  const detallesDe = id_resultado => db.detalles.filter(d => d.id_resultado === id_resultado).map(({ id_resultado: _, ...d }) => {
    const p = db.parametros.find(x => x.id_parametro === d.id_parametro);
    return { ...d, parametro: p.nombre, unidad_medida: p.unidad_medida ?? null };
  });
  const resultadoDe = id_examen => {
    const r = db.resultados.find(x => x.id_examen === id_examen);
    if (!r) return null;
    const { id_examen: _, ...resto } = r;
    return { ...resto, detalles: detallesDe(r.id_resultado) };
  };
  const examenCompleto = e => ({
    ...e, tipo_examen: db.tiposExamen.find(t => t.id_tipo_examen === e.id_tipo_examen)?.nombre, resultado: resultadoDe(e.id_examen)
  });
  const solicitudCompleta = s => ({
    ...s, paciente: nombreDe(pacienteDe(s.id_paciente)),
    medico: db.medicos.find(m => m.id_medico === s.id_medico)?.nombre_completo ?? null,
    examenes: db.examenes.filter(e => e.id_solicitud === s.id_solicitud).map(examenCompleto)
  });
  const porFechaDesc = campo => (a, b) => b[campo] - a[campo];

  const pacientes = {
    async crear(d) {
      unico(db.pacientes, 'documento_identidad', d.documento_identidad, 'Ya existe un paciente con ese documento de identidad');
      const id_paciente = nuevoId();
      db.pacientes.push({ ...copia(d), id_paciente, estado_historial: 'Activo', fecha_registro: new Date(), fecha_archivado: null, motivo_archivado: null });
      return id_paciente;
    },
    async obtener(id) { return copia(db.pacientes.find(p => p.id_paciente === String(id)) || null); },
    async listar({ texto, estado, limite, saltar }) {
      const t = (texto || '').toLowerCase();
      const items = db.pacientes
        .filter(p => (!estado || estado === 'Todos' || p.estado_historial === estado) &&
          (!t || `${p.nombres} ${p.apellidos}`.toLowerCase().includes(t) || p.documento_identidad === texto))
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombres.localeCompare(b.nombres));
      return copia(pagina(items, { limite, saltar }));
    },
    async archivar(id, datos) {
      const p = db.pacientes.find(x => x.id_paciente === String(id) && x.estado_historial === 'Activo');
      if (!p) return false;
      Object.assign(p, copia(datos), { estado_historial: 'Archivado' });
      return true;
    },
    async resumen() {
      const n = e => db.pacientes.filter(p => p.estado_historial === e).length;
      return { pacientes_activos: n('Activo'), pacientes_archivados: n('Archivado') };
    }
  };

  const solicitudes = {
    async crear(s, examenes) {
      for (const e of examenes) unico(db.examenes, 'codigo_muestra', e.codigo_muestra || null, 'Código de muestra repetido');
      const id_solicitud = nuevoId();
      db.solicitudes.push({ ...copia(s), id_solicitud });
      for (const e of examenes) {
        db.examenes.push({
          id_examen: nuevoId(), id_solicitud, id_tipo_examen: String(e.id_tipo_examen), codigo_muestra: e.codigo_muestra || null,
          fecha_toma_muestra: e.fecha_toma_muestra || null, estado: e.estado
        });
      }
      return id_solicitud;
    },
    async obtener(id) {
      const s = db.solicitudes.find(x => x.id_solicitud === String(id));
      return copia(s ? solicitudCompleta(s) : null);
    },
    async listar({ estado, limite, saltar }) {
      const items = db.solicitudes.filter(s => !estado || s.estado === estado).sort(porFechaDesc('fecha_solicitud'))
        .map(s => { const { examenes: _, ...resto } = solicitudCompleta(s); return resto; });
      return copia(pagina(items, { limite, saltar }));
    },
    async dePaciente(idPaciente) {
      return copia(db.solicitudes.filter(s => s.id_paciente === String(idPaciente)).sort(porFechaDesc('fecha_solicitud')).map(solicitudCompleta));
    },
    async cambiarEstadoExamen(idExamen, estado) {
      const e = db.examenes.find(x => x.id_examen === String(idExamen));
      e.estado = estado;
      return db.examenes.filter(x => x.id_solicitud === e.id_solicitud).map(x => x.estado);
    },
    async cambiarEstado(idSolicitud, estado) { db.solicitudes.find(s => s.id_solicitud === String(idSolicitud)).estado = estado; },
    async resumen() {
      const n = e => db.solicitudes.filter(s => s.estado === e).length;
      return { pendientes: n('Pendiente'), en_proceso: n('En proceso'), completadas: n('Completada') };
    }
  };

  const resultados = {
    async contexto(filtro) {
      const id_examen = filtro.id_examen != null ? String(filtro.id_examen)
        : db.resultados.find(r => r.id_resultado === String(filtro.id_resultado))?.id_examen;
      const e = db.examenes.find(x => x.id_examen === id_examen);
      if (!e) return null;
      const s = db.solicitudes.find(x => x.id_solicitud === e.id_solicitud);
      const p = db.pacientes.find(x => x.id_paciente === s.id_paciente);
      const t = db.tiposExamen.find(x => x.id_tipo_examen === e.id_tipo_examen);
      return copia({
        id_examen, id_solicitud: s.id_solicitud, estado_solicitud: s.estado, id_paciente: p.id_paciente,
        estado_historial: p.estado_historial, tipo_examen: { id_tipo_examen: t.id_tipo_examen, nombre: t.nombre },
        parametros: parametrosDe(t.id_tipo_examen),
        resultado: db.resultados.some(r => r.id_examen === id_examen)
          ? (({ id_resultado, estado, detalles }) => ({ id_resultado, estado, detalles }))(resultadoDe(id_examen)) : null
      });
    },
    async guardar(idExamen, datos, detalles) {
      let r = db.resultados.find(x => x.id_examen === String(idExamen));
      if (!r) {
        r = { id_resultado: nuevoId(), id_examen: String(idExamen), estado: 'Preliminar', id_personal_valida: null, fecha_emision: null };
        db.resultados.push(r);
      }
      Object.assign(r, copia(datos));
      for (const d of detalles) {
        db.detalles = db.detalles.filter(x => !(x.id_resultado === r.id_resultado && x.id_parametro === d.id_parametro));
        db.detalles.push({ ...copia(d), id_resultado: r.id_resultado });
      }
      return r.id_resultado;
    },
    async validar(idResultado, datos) {
      const r = db.resultados.find(x => x.id_resultado === String(idResultado) && x.estado === 'Preliminar');
      if (!r) return false;
      Object.assign(r, copia(datos), { estado: 'Validado' });
      // Equivalente al trigger trg_resultado_validacion de PostgreSQL.
      const e = db.examenes.find(x => x.id_examen === r.id_examen);
      const s = db.solicitudes.find(x => x.id_solicitud === e.id_solicitud);
      const per = db.personal.find(x => x.id_personal === datos.id_personal_valida);
      db.bitacora.push({ id_evento: nuevoId(), fecha_hora: new Date(), usuario: per.usuario, rol: null, accion: 'VALIDAR_RESULTADO',
        id_paciente: s.id_paciente, recurso: 'resultado', resultado: 'PERMITIDO', detalle: null });
      return true;
    },
    async obtener(id) {
      const r = db.resultados.find(x => x.id_resultado === String(id));
      if (!r) return null;
      const ctx = await resultados.contexto({ id_examen: r.id_examen });
      const per = db.personal.find(x => x.id_personal === r.id_personal_valida);
      return copia({
        ...resultadoDe(r.id_examen), id_examen: r.id_examen, validado_por: per ? nombreDe(per) : null,
        id_solicitud: ctx.id_solicitud, id_paciente: ctx.id_paciente, paciente: nombreDe(pacienteDe(ctx.id_paciente)),
        codigo_muestra: db.examenes.find(e => e.id_examen === r.id_examen).codigo_muestra,
        tipo_examen: ctx.tipo_examen, parametros: ctx.parametros
      });
    },
    async listar({ estado, limite, saltar }) {
      const items = db.resultados.filter(r => !estado || r.estado === estado).sort(porFechaDesc('fecha_analisis')).map(r => {
        const e = db.examenes.find(x => x.id_examen === r.id_examen);
        const p = pacienteDe(db.solicitudes.find(s => s.id_solicitud === e.id_solicitud).id_paciente);
        return {
          id_resultado: r.id_resultado, id_examen: r.id_examen, estado: r.estado, fecha_analisis: r.fecha_analisis, fecha_emision: r.fecha_emision,
          tipo_examen: db.tiposExamen.find(t => t.id_tipo_examen === e.id_tipo_examen).nombre, id_paciente: p.id_paciente, paciente: nombreDe(p)
        };
      });
      return copia(pagina(items, { limite, saltar }));
    }
  };

  const catalogos = {
    async tiposMuestra() { return copia(db.tiposMuestra); },
    async crearTipoMuestra(d) {
      unico(db.tiposMuestra, 'nombre', d.nombre, 'Ya existe ese tipo de muestra');
      const id_tipo_muestra = nuevoId();
      db.tiposMuestra.push({ ...copia(d), id_tipo_muestra });
      return id_tipo_muestra;
    },
    async parametros() { return copia(db.parametros); },
    async crearParametro(d) {
      unico(db.parametros, 'nombre', d.nombre, 'Ya existe ese parámetro');
      const id_parametro = nuevoId();
      db.parametros.push({ unidad_medida: null, ...copia(d), id_parametro });
      return id_parametro;
    },
    async tiposExamen() { return copia(db.tiposExamen); },
    async obtenerTipoExamen(id) {
      const t = db.tiposExamen.find(x => x.id_tipo_examen === String(id));
      return copia(t ? { ...t, parametros: parametrosDe(t.id_tipo_examen) } : null);
    },
    async crearTipoExamen(tipo, parametros) {
      unico(db.tiposExamen, 'nombre', tipo.nombre, 'Ya existe ese tipo de examen');
      const id_tipo_examen = nuevoId();
      db.tiposExamen.push({ ...copia(tipo), id_tipo_muestra: String(tipo.id_tipo_muestra), id_tipo_examen, activo: true });
      for (const p of parametros) {
        db.tipoExamenParametro.push({ valor_ref_min: null, valor_ref_max: null, valor_ref_texto: null, ...copia(p), id_parametro: String(p.id_parametro), id_tipo_examen });
      }
      return id_tipo_examen;
    },
    async medicos() { return copia(db.medicos); },
    async obtenerMedico(id) { return copia(db.medicos.find(m => m.id_medico === String(id)) || null); },
    async crearMedico(d) {
      unico(db.medicos, 'numero_colegiado', d.numero_colegiado, 'Ya existe un médico con ese número de colegiado');
      const id_medico = nuevoId();
      db.medicos.push({ ...copia(d), id_medico });
      return id_medico;
    },
    async personal() { return copia(db.personal); },
    async personalPorUsuario(usuario) { return copia(db.personal.find(p => p.usuario === usuario) || null); },
    async crearPersonal(d) {
      unico(db.personal, 'usuario', d.usuario, 'Ya existe personal con ese usuario');
      const id_personal = nuevoId();
      db.personal.push({ activo: true, ...copia(d), id_personal });
      return id_personal;
    }
  };

  const cuentas = {
    async obtener(u) { return copia(db.cuentas.find(c => c.usuario === u) ?? null); },
    async crear(c) {
      unico(db.cuentas, 'usuario', c.usuario, 'Ya existe una cuenta con ese usuario');
      db.cuentas.push({ usuario: c.usuario, rol: c.rol, hash_contrasena: c.hash_contrasena, activo: true });
    },
    async actualizarContrasena(u, hash) {
      const c = db.cuentas.find(x => x.usuario === u);
      if (c) c.hash_contrasena = hash;
    }
  };

  const auditoria = {
    async registrar(evento) {
      if (fallarAuditoria) throw new Error('bitácora no disponible');
      db.bitacora.push({ ...copia(evento), id_evento: nuevoId(), fecha_hora: new Date() });
    },
    async listar({ id_paciente, accion, limite = 50 } = {}) {
      return copia(db.bitacora.filter(e => (!id_paciente || e.id_paciente === id_paciente) && (!accion || e.accion === accion))
        .sort(porFechaDesc('fecha_hora')).slice(0, limite));
    }
  };

  const repos = { pacientes, solicitudes, resultados, catalogos, cuentas, auditoria };
  const unidad = {
    async ejecutar(fn) {
      const respaldo = copia(db);
      try {
        return await fn(repos);
      } catch (e) {
        db = respaldo;
        throw e;
      }
    }
  };

  return { ...repos, unidad, estado: () => db, fallarAuditoria: v => { fallarAuditoria = v; } };
}

module.exports = { crearRepositoriosMemoria };
