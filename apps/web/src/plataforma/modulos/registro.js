// Registro de módulos institucionales CONECTADOS en esta interfaz.
// Para incorporar una institución: su módulo (instituciones/<carpeta>/frontend/modulo.js) debe cumplir
// el contrato (contrato.js) y su backend ya debe atender /api/sesion para esa institución
// (docs/FRONTEND_EQUIPO.md §7). Recién entonces se agrega aquí, en una línea coordinada.
// Los módulos preparados pero sin backend (hospital, odontologia, laboratorio) NO se
// registran: solo se revisan en la vista previa de desarrollo (/vista-previa).
import { crearRegistro } from './contrato.js';
import pediatria from '@instituciones/pediatria/frontend/modulo.js';

export const registro = crearRegistro([
  pediatria
]);

export const NOMBRE_PLATAFORMA = 'Red de Historiales Clínicos';
