// Crea las cuentas de acceso del Hospital (una por rol) con contraseñas aleatorias.
//   npm run hospital:usuarios                    crea las que falten; las que ya existen no cambian
//   npm run hospital:usuarios -- --restablecer   genera contraseñas nuevas para todas
// Las contraseñas no se imprimen: se agregan a un archivo FUERA del repositorio.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, q } from '../src/db.js';

const CUENTAS = [['hosp.admin', 'administrador'], ['hosp.medico', 'medico'], ['hosp.enfermeria', 'enfermeria'], ['hosp.recepcion', 'recepcion']];
const ARCHIVO = process.env.HOSPITAL_ARCHIVO_ACCESOS
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'DATOS_DE_ACCESO_HOSPITAL.txt');
const generar = () => crypto.randomBytes(15).toString('base64url');

function texto(nuevas, sinCambios) {
  const l = [
    'RED DE HISTORIALES CLÍNICOS - HOSPITAL GENERAL - DATOS DE ACCESO',
    'CONFIDENCIAL: no subir a Git ni publicar. Compartir solo por un medio privado.',
    `Creado: ${new Date().toISOString()}`, '',
    'APLICACIÓN', '  Dirección: http://localhost:3001', '  Arranque:  npm run build  y luego  npm start', '',
    'USUARIOS (una cuenta por rol)'
  ];
  for (const c of nuevas) l.push(`  Rol:        ${c.rol}`, `  Usuario:    ${c.usuario}`, `  Contraseña: ${c.contrasena}`, '');
  if (sinCambios.length) l.push(`  Sin cambios (ya existían): ${sinCambios.join(', ')}.`, '');
  l.push('-'.repeat(70), '');
  return l.join('\n');
}

async function main() {
  const restablecer = process.argv.includes('--restablecer');
  try {
    const [medico] = await q("SELECT id_medico FROM medico WHERE estado = 'Activo' ORDER BY id_medico LIMIT 1");
    const nuevas = [], sinCambios = [];
    for (const [usuario, rol] of CUENTAS) {
      const [existente] = await q('SELECT id_usuario FROM usuario WHERE nombre_usuario = ?', [usuario]);
      if (existente && !restablecer) { sinCambios.push(usuario); continue; }
      const contrasena = generar();
      const hash = await bcrypt.hash(contrasena, 12);
      if (existente) {
        await q('UPDATE usuario SET contrasena_hash = ? WHERE id_usuario = ?', [hash, existente.id_usuario]);
      } else {
        const [r] = await q('SELECT id_rol FROM rol WHERE nombre_rol = ?', [rol]);
        if (!r) throw new Error(`Rol inexistente: ${rol}. ¿Se aplicó npm run hospital:esquema?`);
        await q('INSERT INTO usuario (id_medico, nombre_usuario, contrasena_hash, id_rol) VALUES (?,?,?,?)',
          [rol === 'medico' ? medico?.id_medico ?? null : null, usuario, hash, r.id_rol]);
      }
      nuevas.push({ usuario, rol, contrasena });
    }
    if (nuevas.length) {
      fs.appendFileSync(ARCHIVO, texto(nuevas, sinCambios), { encoding: 'utf8', mode: 0o600 });
      console.log(`Cuentas creadas o restablecidas: ${nuevas.map(c => c.usuario).join(', ')}`);
      console.log(`Contraseñas guardadas en: ${ARCHIVO}`);
    }
    if (sinCambios.length) console.log(`Sin cambios (ya existían): ${sinCambios.join(', ')}`);
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
