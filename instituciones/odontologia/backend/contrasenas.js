'use strict';
// Contraseñas con scrypt (node:crypto): sal aleatoria por cuenta y comparación en tiempo constante.
// Formato guardado: scrypt$N$r$p$sal$hash (base64url). Nunca se guarda ni se registra la contraseña.
const crypto = require('node:crypto');

const PARAMETROS = { N: 16384, r: 8, p: 1 };
const LONGITUD = 64;

const derivar = (contrasena, sal, { N, r, p }) => new Promise((resolver, rechazar) =>
  crypto.scrypt(String(contrasena).normalize('NFC'), sal, LONGITUD, { N, r, p, maxmem: 64 * 1024 * 1024 },
    (e, clave) => (e ? rechazar(e) : resolver(clave))));

async function cifrar(contrasena) {
  const sal = crypto.randomBytes(16);
  const hash = await derivar(contrasena, sal, PARAMETROS);
  const { N, r, p } = PARAMETROS;
  return `scrypt$${N}$${r}$${p}$${sal.toString('base64url')}$${hash.toString('base64url')}`;
}

async function verificar(contrasena, guardado) {
  const partes = String(guardado ?? '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, N, r, p, sal, hash] = partes;
  const esperado = Buffer.from(hash, 'base64url');
  const obtenido = await derivar(contrasena, Buffer.from(sal, 'base64url'), { N: Number(N), r: Number(r), p: Number(p) });
  return esperado.length === obtenido.length && crypto.timingSafeEqual(esperado, obtenido);
}

// Contraseña aleatoria de 20 caracteres (letras, números, - y _).
const generar = () => crypto.randomBytes(15).toString('base64url');

// Hash de relleno: se verifica contra él cuando el usuario no existe, para responder en el mismo tiempo.
let relleno;
const hashRelleno = async () => (relleno ??= await cifrar(crypto.randomBytes(16).toString('hex')));

module.exports = { cifrar, verificar, generar, hashRelleno };
