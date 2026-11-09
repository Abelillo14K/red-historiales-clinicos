'use strict';
// Cuentas de acceso: inicio de sesión con usuario y contraseña, alta de cuentas y cambio de contraseña.
// La respuesta no distingue usuario inexistente de contraseña incorrecta; la bitácora sí lo registra.
const E = require('../domain/errors');
const { ROLES } = require('../permisos');
const C = require('../contrasenas');

const USUARIO = /^[a-z][a-z0-9._-]{2,39}$/;
const MINIMO = 12;
const normalizar = u => String(u ?? '').trim().toLowerCase();
const credencialesInvalidas = () => new E.DomainError('Usuario o contraseña incorrectos', 401, 'CREDENCIALES_INVALIDAS');

function exigirContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length < MINIMO || contrasena.length > 200) {
    throw E.invalid(`La contraseña debe tener entre ${MINIMO} y 200 caracteres`);
  }
}

function crearAccesoService({ cuentas }, comun) {
  return {
    async autenticar(usuario, contrasena) {
      const u = normalizar(usuario);
      const formatoValido = USUARIO.test(u) && typeof contrasena === 'string' && contrasena.length <= 200;
      const cuenta = formatoValido ? await cuentas.obtener(u) : null;
      // Se verifica siempre (contra un hash de relleno si no hay cuenta) para responder en el mismo tiempo.
      const valida = await C.verificar(formatoValido ? contrasena : '', cuenta?.hash_contrasena ?? await C.hashRelleno());
      if (!cuenta || !valida || !cuenta.activo) {
        const detalle = !cuenta ? 'Usuario inexistente' : !valida ? 'Contraseña incorrecta' : 'Cuenta inactiva';
        await comun.auditar({ id: u.slice(0, 80) || '(vacío)', rol: cuenta?.rol ?? null }, 'INICIO_SESION',
          { recurso: 'auth', resultado: 'DENEGADO', detalle }).catch(() => {});
        throw credencialesInvalidas();
      }
      await comun.auditar({ id: u, rol: cuenta.rol }, 'INICIO_SESION', { recurso: 'auth' });
      return { usuario: u, rol: cuenta.rol };
    },

    async obtener(usuario) {
      const c = await cuentas.obtener(normalizar(usuario));
      return c && { usuario: c.usuario, rol: c.rol, activo: c.activo };
    },

    async crearCuenta(actor, { usuario, rol, contrasena }) {
      const u = normalizar(usuario);
      if (!USUARIO.test(u)) throw E.invalid('Usuario inválido: 3 a 40 caracteres, minúsculas, números, punto, guion o guion bajo');
      if (!ROLES.includes(rol)) throw E.invalid(`Rol inválido; use uno de: ${ROLES.join(', ')}`);
      exigirContrasena(contrasena);
      const hash_contrasena = await C.cifrar(contrasena);
      return comun.escribir(actor, 'CREAR_CUENTA', { recurso: `cuenta:${u}` }, async tx => {
        if (await tx.cuentas.obtener(u)) throw E.conflict('Ya existe una cuenta con ese usuario');
        await tx.cuentas.crear({ usuario: u, rol, hash_contrasena, activo: true, creado: new Date() });
        return { usuario: u, rol };
      });
    },

    async cambiarContrasena(actor, usuario, contrasena) {
      const u = normalizar(usuario);
      exigirContrasena(contrasena);
      const hash = await C.cifrar(contrasena);
      return comun.escribir(actor, 'CAMBIAR_CONTRASENA', { recurso: `cuenta:${u}` }, async tx => {
        if (!(await tx.cuentas.obtener(u))) throw E.notFound('Cuenta inexistente');
        await tx.cuentas.actualizarContrasena(u, hash);
        return { usuario: u };
      });
    }
  };
}

module.exports = { crearAccesoService };
