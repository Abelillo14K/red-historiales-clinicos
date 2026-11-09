// Registro de módulos institucionales CONECTADOS en esta interfaz.
// Para incorporar una institución: su módulo (instituciones/<carpeta>/frontend/modulo.js) debe cumplir
// el contrato (contrato.js) y su backend ya debe atender /api/sesion para esa institución
// (docs/GUIA_EQUIPO.md §7.4). Recién entonces se agrega aquí, en una línea coordinada.
// Los módulos preparados pero sin backend NO se registran: solo se revisan en la vista
// previa de desarrollo (/vista-previa). Hoy las cuatro instituciones están conectadas.
import { crearRegistro } from './contrato.js';
import pediatria from '@instituciones/pediatria/frontend/modulo.js';
import hospital from '@instituciones/hospital/frontend/modulo.js';
import laboratorio from '@instituciones/laboratorio/frontend/modulo.js';
import odontologia from '@instituciones/odontologia/frontend/modulo.js';

export const registro = crearRegistro([
  pediatria,
  hospital,
  laboratorio,
  odontologia
]);

export const NOMBRE_PLATAFORMA = 'Red Clínica Integrada';
