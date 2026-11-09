import { Router } from 'express';
import { q } from '../db.js';
import { ah } from '../errores.js';
import { permiso, puede } from '../seguridad.js';
import { NOMBRE_PACIENTE } from '../utilidades.js';
import { registrar } from '../bitacora.js';

export const panelRouter = Router();

panelRouter.get('/panel', permiso('panel.ver'), ah(async (req, res) => {
  const [[pa]] = [await q(`SELECT COUNT(*) n FROM paciente WHERE estado='Activo'`)];
  const [[ar]] = [await q(`SELECT COUNT(*) n FROM paciente WHERE estado='Archivado'`)];
  const [[ci]] = [await q(`SELECT COUNT(*) n FROM cita WHERE DATE(fecha_hora_cita)=CURDATE() AND estado_cita IN ('Programada','Confirmada')`)];
  const [[ho]] = [await q(`SELECT COUNT(*) n FROM hospitalizacion WHERE fecha_egreso IS NULL`)];
  const out = {
    pacientes_activos: pa.n, historiales_archivados: ar.n, citas_hoy: ci.n, hospitalizados: ho.n,
    consultas_registradas: null, consultas_recientes: []
  };
  if (puede(req, 'historial.leer')) { // dato clínico → solo con permiso, y queda en bitácora
    out.consultas_registradas = (await q('SELECT COUNT(*) n FROM consulta'))[0].n;
    out.consultas_recientes = await q(
      `SELECT c.id_consulta, c.id_paciente, ${NOMBRE_PACIENTE} AS paciente, c.tipo_consulta, c.fecha_hora_consulta AS fecha
         FROM consulta c JOIN paciente p ON p.id_paciente = c.id_paciente
        ORDER BY c.fecha_hora_consulta DESC LIMIT 5`);
    await registrar(req, { tabla: 'consulta', accion: 'LEER' });
  }
  res.json(out);
}));
