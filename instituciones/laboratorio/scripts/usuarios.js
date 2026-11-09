'use strict';
// Crea las cuentas de acceso del laboratorio (una por rol) con contraseñas aleatorias.
//   npm run lab:usuarios                    crea las que falten; las que ya existen no cambian
//   npm run lab:usuarios -- --restablecer   genera contraseñas nuevas para todas
// Las contraseñas se muestran una sola vez y se agregan a un archivo FUERA del repositorio.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { crearPool } = require('../backend/db');
const { crearRepositoriosPostgres } = require('../backend/adapters/postgres');
const { crearServicios } = require('../backend/application');
const { generar } = require('../backend/contrasenas');

const CUENTAS = [['lab.admin', 'administrador'], ['lab.recepcion', 'recepcion'], ['lab.tecnico', 'tecnico'], ['lab.bioquimico', 'bioquimico']];
const SISTEMA = { id: 'script-usuarios', rol: 'sistema' };
const ARCHIVO = path.resolve(__dirname, '..', '..', '..', '..', 'DATOS_DE_ACCESO_LABORATORIO.txt');

function nombreBase() {
  try {
    return new URL(process.env.LABORATORIO_DB_URL).pathname.slice(1) || '—';
  } catch {
    return '—';
  }
}

function texto(nuevas, sinCambios) {
  const l = [
    'RED DE HISTORIALES CLÍNICOS - LABORATORIO CLÍNICO - DATOS DE ACCESO',
    'CONFIDENCIAL: no subir a Git ni publicar. Compartir solo por un medio privado.',
    `Creado: ${new Date().toISOString()}`, '',
    'APLICACIÓN', '  Dirección: http://localhost:3001', '  Arranque:  npm run build  y luego  npm start', '',
    'USUARIOS (una cuenta por rol)'
  ];
  for (const c of nuevas) l.push(`  Rol:        ${c.rol}`, `  Usuario:    ${c.usuario}`, `  Contraseña: ${c.contrasena}`, '');
  if (sinCambios.length) {
    l.push(`  Sin cambios (ya existían): ${sinCambios.join(', ')}. Su contraseña está en un bloque anterior de este archivo;`,
      '  para generar otras: npm run lab:usuarios -- --restablecer', '');
  }
  l.push('BASE DE DATOS', `  Motor: PostgreSQL · Base: ${nombreBase()} · tabla laboratorio.cuenta_acceso (solo hash scrypt)`, '', '-'.repeat(70), '');
  return l.join('\n');
}

async function main() {
  const restablecer = process.argv.includes('--restablecer');
  const pool = crearPool();
  try {
    const s = crearServicios(crearRepositoriosPostgres(pool));
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
      console.log('Para generar contraseñas nuevas: npm run lab:usuarios -- --restablecer');
      return;
    }
    const bloque = texto(nuevas, sinCambios);
    fs.appendFileSync(ARCHIVO, bloque, { encoding: 'utf8', mode: 0o600 });
    console.log(bloque);
    console.log(`Guardado en ${ARCHIVO} (fuera del repositorio).`);
  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error(e.code === '42P01' ? 'Falta la tabla de cuentas: ejecute antes npm run lab:esquema' : e.message);
  process.exitCode = 1;
});
