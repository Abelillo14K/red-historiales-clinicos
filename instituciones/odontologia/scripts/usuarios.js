'use strict';
// Crea las cuentas de acceso de la clínica (una por rol) con contraseñas aleatorias.
//   npm run odonto:usuarios                    crea las que falten; las que ya existen no cambian
//   npm run odonto:usuarios -- --restablecer   genera contraseñas nuevas para todas
// Las contraseñas se muestran una sola vez y se agregan a un archivo FUERA del repositorio.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { crearFirestore, proyectoConectado } = require('../backend/db');
const { crearRepositoriosFirestore } = require('../backend/adapters/firestore');
const { crearServicios } = require('../backend/application');
const { generar } = require('../backend/contrasenas');

const CUENTAS = [['odonto.admin', 'administrador'], ['odonto.recepcion', 'recepcion'], ['odonto.odontologo', 'odontologo']];
const SISTEMA = { id: 'script-usuarios', rol: 'sistema' };
const ARCHIVO = path.resolve(__dirname, '..', '..', '..', '..', 'DATOS_DE_ACCESO_ODONTOLOGIA.txt');

function texto(nuevas, sinCambios) {
  const l = [
    'RED DE HISTORIALES CLÍNICOS - CLÍNICA ODONTOLÓGICA - DATOS DE ACCESO',
    'CONFIDENCIAL: no subir a Git ni publicar. Compartir solo por un medio privado.',
    `Creado: ${new Date().toISOString()}`, '',
    'APLICACIÓN', '  Dirección: http://localhost:3001', '  Arranque:  npm run build  y luego  npm start', '',
    'USUARIOS (una cuenta por rol)'
  ];
  for (const c of nuevas) l.push(`  Rol:        ${c.rol}`, `  Usuario:    ${c.usuario}`, `  Contraseña: ${c.contrasena}`, '');
  if (sinCambios.length) {
    l.push(`  Sin cambios (ya existían): ${sinCambios.join(', ')}. Su contraseña está en un bloque anterior de este archivo;`,
      '  para generar otras: npm run odonto:usuarios -- --restablecer', '');
  }
  l.push('BASE DE DATOS', `  Motor: Cloud Firestore · Proyecto: ${proyectoConectado()} · colección cuentas_acceso (solo hash scrypt)`,
    '', '-'.repeat(70), '');
  return l.join('\n');
}

async function main() {
  const restablecer = process.argv.includes('--restablecer');
  const db = crearFirestore();
  try {
    const s = crearServicios(crearRepositoriosFirestore(db));
    const nuevas = [];
    const sinCambios = [];
    for (const [usuario, rol] of CUENTAS) {
      const existente = await s.acceso.obtener(usuario);
      if (existente && !restablecer) {
        sinCambios.push(usuario);
        continue;
      }
      const contrasena = generar();
      if (existente) await s.acceso.cambiarContrasena(SISTEMA, usuario, contrasena);
      else await s.acceso.crearCuenta(SISTEMA, { usuario, rol, contrasena });
      nuevas.push({ usuario, rol: existente?.rol ?? rol, contrasena });
    }
    if (!nuevas.length) {
      console.log(`Las cuentas ya existen: ${sinCambios.join(', ')}. Sus contraseñas están en ${ARCHIVO}`);
      console.log('Para generar contraseñas nuevas: npm run odonto:usuarios -- --restablecer');
      return;
    }
    const bloque = texto(nuevas, sinCambios);
    fs.appendFileSync(ARCHIVO, bloque, { encoding: 'utf8', mode: 0o600 });
    console.log(bloque);
    console.log(`Guardado en ${ARCHIVO} (fuera del repositorio).`);
  } finally {
    await db.terminate();
  }
}

main().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
