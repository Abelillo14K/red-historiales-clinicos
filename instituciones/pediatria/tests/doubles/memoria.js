'use strict';
// Doble de prueba: implementa los puertos en memoria con la misma semántica
// condicional que el adaptador MongoDB. Nunca toca centro_pediatrico_db.
const { conflict } = require('../../backend/domain/errors');
const clonar = x => structuredClone(x);

function crearRepositoriosMemoria({ pacientes = [], medicos = [], vacunas = [], perimetroOpcional = true } = {}) {
  const P = new Map(pacientes.map(p => [p.id_paciente, clonar(p)]));
  const MED = new Map(medicos.map(m => [m.id_medico, clonar(m)]));
  const VAC = new Map(vacunas.map(v => [v.id_vacuna, clonar(v)]));
  const bitacora = [];
  const pendientes = [];
  const activo = id => { const p = P.get(id); return p && p.estado_historial === 'Activo' ? p : null; };
  const consultaDe = (p, id) => (p.consultas || []).find(c => c.id_consulta === id);
  const dosisDe = (p, id) => (p.esquema_vacunacion || []).find(d => d.id_esquema === id);

  const repoPacientes = {
    async crear(p) { if (P.has(p.id_paciente)) throw conflict('Identificador duplicado'); P.set(p.id_paciente, clonar(p)); },
    async siguienteId() {
      const n = Math.max(0, ...[...P.keys()].filter(k => /^P\d+$/.test(k)).map(k => Number(k.slice(1))));
      return `P${String(n + 1).padStart(3, '0')}`;
    },
    async buscarDuplicado({ nombres, apellidos, fecha_nacimiento }) {
      const x = [...P.values()].find(p => p.nombres.toLowerCase() === nombres.toLowerCase() &&
        p.apellidos.toLowerCase() === apellidos.toLowerCase() && +p.fecha_nacimiento === +fecha_nacimiento);
      return x ? { id_paciente: x.id_paciente, estado_historial: x.estado_historial } : null;
    },
    async listar({ texto, estado, sexo, limite = 25, saltar = 0, buscarDpi = true }) {
      let items = [...P.values()].filter(p => (estado === 'Todos' || !estado || p.estado_historial === estado) &&
        (!sexo || p.sexo === sexo));
      if (texto) {
        const t = texto.toLowerCase();
        items = items.filter(p => [p.id_paciente, p.nombres, p.apellidos, ...(p.tutores || []).flatMap(x => [x.nombres, x.apellidos])]
          .some(v => v.toLowerCase().includes(t)) || (buscarDpi && (p.tutores || []).some(x => x.dpi === texto)));
      }
      const total = items.length;
      items = items.slice(saltar, saltar + limite).map(p => ({
        id_paciente: p.id_paciente, nombres: p.nombres, apellidos: p.apellidos, fecha_nacimiento: p.fecha_nacimiento,
        sexo: p.sexo, estado_historial: p.estado_historial, total_consultas: (p.consultas || []).length,
        dosis_pendientes: (p.esquema_vacunacion || []).filter(d => d.estado === 'Pendiente').length
      }));
      return { items: clonar(items), total };
    },
    async obtener(id) { return P.has(id) ? clonar(P.get(id)) : null; },
    async obtenerAdministrativo(id) {
      if (!P.has(id)) return null;
      const { consultas, controles_crecimiento, esquema_vacunacion, ...resto } = clonar(P.get(id));
      return resto;
    },
    async actualizarDatos(id, campos) {
      const p = activo(id); if (!p) return false;
      const n = campos.fecha_nacimiento;
      const fechas = [...(p.consultas || []).map(c => c.fecha_hora), ...(p.controles_crecimiento || []).map(c => c.fecha),
        ...(p.esquema_vacunacion || []).flatMap(d => [d.fecha_programada, d.fecha_aplicacion])].filter(Boolean);
      if (n && fechas.some(f => new Date(f) < n)) return false;
      Object.assign(p, clonar(campos)); return true;
    },
    async reemplazarTutores(id, previos, nuevos) {
      const p = activo(id);
      if (!p || JSON.stringify(p.tutores) !== JSON.stringify(previos)) return false;
      p.tutores = clonar(nuevos); return true;
    },
    async agregarConsulta(id, c, control) {
      const p = activo(id);
      if (!p || consultaDe(p, c.id_consulta)) return false;
      if (control && p.controles_crecimiento.some(x => x.id_control === control.id_control)) return false;
      p.consultas.push(clonar(c)); if (control) p.controles_crecimiento.push(clonar(control)); return true;
    },
    async agregarDiagnostico(id, idC, d) {
      const c = activo(id) && consultaDe(activo(id), idC);
      if (!c || (c.diagnosticos || []).some(x => x.codigo === d.codigo)) return false;
      (c.diagnosticos ||= []).push(clonar(d)); return true;
    },
    async establecerTratamiento(id, idC, t, previo, reemplazo) {
      const c = activo(id) && consultaDe(activo(id), idC);
      if (!c || JSON.stringify(c.tratamiento ?? null) !== JSON.stringify(previo ?? null)) return false;
      if (previo) (c.tratamientos_anteriores ||= []).push(clonar({ ...previo, ...reemplazo }));
      c.tratamiento = clonar(t); return true;
    },
    async agregarPrescripcion(id, idC, rx) {
      const c = activo(id) && consultaDe(activo(id), idC);
      if (!c || (c.prescripciones || []).some(x => x.id_prescripcion === rx.id_prescripcion)) return false;
      (c.prescripciones ||= []).push(clonar(rx)); return true;
    },
    async agregarControl(id, ctl) {
      const p = activo(id);
      if (!p || !consultaDe(p, ctl.id_consulta) || p.controles_crecimiento.some(x => x.id_control === ctl.id_control)) return false;
      p.controles_crecimiento.push(clonar(ctl)); return true;
    },
    async programarDosis(id, d) {
      const p = activo(id);
      if (!p || dosisDe(p, d.id_esquema) || p.esquema_vacunacion.some(x => x.id_vacuna === d.id_vacuna &&
        x.numero_dosis === d.numero_dosis && x.estado !== 'Cancelada')) return false;
      p.esquema_vacunacion.push(clonar(d)); return true;
    },
    async aplicarDosis(id, idE, x) {
      const d = activo(id) && dosisDe(activo(id), idE);
      if (!d || d.estado !== 'Pendiente') return false;
      Object.assign(d, clonar({ estado: 'Aplicada', fecha_aplicacion: x.fecha_aplicacion, lote: x.lote, id_medico: x.id_medico, aplicado_por: x.aplicado_por }));
      return true;
    },
    async cancelarDosis(id, idE, x) {
      const d = activo(id) && dosisDe(activo(id), idE);
      if (!d || d.estado !== 'Pendiente') return false;
      Object.assign(d, clonar({ estado: 'Cancelada', ...x })); return true;
    },
    async archivar(id, x) { const p = activo(id); if (!p) return false; Object.assign(p, clonar({ estado_historial: 'Archivado', ...x })); return true; },
    async resumen() {
      const ps = [...P.values()];
      const dosis = ps.flatMap(p => p.esquema_vacunacion || []);
      return {
        pacientes_activos: ps.filter(p => p.estado_historial === 'Activo').length,
        pacientes_archivados: ps.filter(p => p.estado_historial === 'Archivado').length,
        consultas: ps.reduce((n, p) => n + (p.consultas || []).length, 0),
        controles_crecimiento: ps.reduce((n, p) => n + (p.controles_crecimiento || []).length, 0),
        dosis_pendientes: ps.filter(p => p.estado_historial === 'Activo').flatMap(p => p.esquema_vacunacion || []).filter(d => d.estado === 'Pendiente').length,
        dosis_aplicadas: dosis.filter(d => d.estado === 'Aplicada').length,
        consultas_recientes: []
      };
    },
    async dosisPendientes({ limite = 20 } = {}) {
      return [...P.values()].filter(p => p.estado_historial === 'Activo')
        .flatMap(p => p.esquema_vacunacion.filter(d => d.estado === 'Pendiente').map(d => ({
          id_paciente: p.id_paciente, nombres: p.nombres, apellidos: p.apellidos, id_esquema: d.id_esquema,
          id_vacuna: d.id_vacuna, numero_dosis: d.numero_dosis, fecha_programada: d.fecha_programada
        }))).sort((a, b) => a.fecha_programada - b.fecha_programada).slice(0, limite);
    }
  };

  const catalogo = (mapa, clave) => ({
    async listar(f = {}) { return clonar([...mapa.values()].filter(x => !f.especialidad || x.especialidad?.nombre === f.especialidad)); },
    async obtener(id) { return mapa.has(id) ? clonar(mapa.get(id)) : null; },
    async crear(x) { if (mapa.has(x[clave])) throw conflict('Identificador duplicado'); mapa.set(x[clave], clonar(x)); }
  });

  const repos = {
    pacientes: repoPacientes,
    medicos: catalogo(MED, 'id_medico'),
    vacunas: catalogo(VAC, 'id_vacuna'),
    auditoria: {
      fallar: false,
      async registrar(e) { if (this.fallar) throw new Error('bitácora no disponible'); bitacora.push(clonar(e)); },
      async listar({ id_paciente, accion, limite = 100 } = {}) {
        return bitacora.filter(e => (!id_paciente || e.id_paciente === id_paciente) && (!accion || e.accion === accion))
          .slice().reverse().slice(0, limite);
      }
    },
    // Misma garantía que el adaptador sin transacciones: si la bitácora falla, el
    // evento queda pendiente (no se pierde) y reenviarPendientes lo entrega.
    unidad: {
      async ejecutar(fn, evento) {
        const r = await fn();
        if (evento) {
          try { await this.auditoria.registrar(evento); } catch { pendientes.push(clonar(evento)); }
        }
        return r;
      },
      soportaTransacciones: async () => false,
      async reenviarPendientes() {
        let n = 0;
        while (pendientes.length) { await this.auditoria.registrar(pendientes[0]); pendientes.shift(); n++; }
        return n;
      }
    },
    capacidades: async () => ({ perimetro_cefalico_opcional: perimetroOpcional }),
    _bitacora: bitacora,
    _pendientes: pendientes,
    _pacientes: P
  };
  repos.unidad.auditoria = repos.auditoria;
  return repos;
}

module.exports = { crearRepositoriosMemoria };
