'use strict';
// Contraseñas con scrypt (node:crypto). En la base solo se guarda la huella con su sal;
// la contraseña original nunca se almacena ni se escribe en los registros.
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const N = 2 ** 15, R = 8, P = 1, LARGO = 32;
const MAXMEM = 128 * N * R * 2;

const formatear = (sal, huella) => `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${huella.toString('base64')}`;

async function cifrarContrasena(texto) {
  const sal = crypto.randomBytes(16);
  return formatear(sal, await scrypt(texto, sal, LARGO, { N, r: R, p: P, maxmem: MAXMEM }));
}

function cifrarContrasenaSincrona(texto) {
  const sal = crypto.randomBytes(16);
  return formatear(sal, crypto.scryptSync(texto, sal, LARGO, { N, r: R, p: P, maxmem: MAXMEM }));
}

// Devuelve false ante cualquier formato inesperado: un dato dañado nunca concede acceso.
async function verificarContrasena(texto, guardado) {
  const partes = String(guardado ?? '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [n, r, p] = partes.slice(1, 4).map(Number);
  const sal = Buffer.from(partes[4], 'base64');
  const esperada = Buffer.from(partes[5], 'base64');
  if (![n, r, p].every(Number.isSafeInteger) || !esperada.length) return false;
  try {
    const calculada = await scrypt(texto, sal, esperada.length, { N: n, r, p, maxmem: 128 * n * r * 2 });
    return crypto.timingSafeEqual(calculada, esperada);
  } catch {
    return false;
  }
}

// Se compara contra esta huella cuando el usuario no existe, para que la respuesta
// tarde lo mismo y no revele qué nombres de usuario son válidos.
const HUELLA_SIMULADA = cifrarContrasenaSincrona(crypto.randomBytes(24).toString('base64'));

module.exports = { cifrarContrasena, cifrarContrasenaSincrona, verificarContrasena, HUELLA_SIMULADA };
