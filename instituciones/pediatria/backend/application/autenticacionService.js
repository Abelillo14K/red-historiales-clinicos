'use strict';
// Caso de uso: inicio de sesión con usuario y contraseña.
const E = require('../domain/errors');
const { verificarContrasena, HUELLA_SIMULADA } = require('../contrasenas');

function crearAutenticacionService({ usuarios }, comun) {
  // Mismo mensaje si el usuario no existe, si está inactivo o si la contraseña es
  // incorrecta: la respuesta no revela cuáles cuentas existen.
  async function iniciarSesion({ usuario, contrasena }) {
    const cuenta = await usuarios.obtenerPorUsuario(usuario);
    const coincide = await verificarContrasena(contrasena, cuenta?.contrasena_hash ?? HUELLA_SIMULADA);
    if (!cuenta || !coincide || cuenta.activo !== true) {
      // El acceso se rechaza aunque falle el registro del intento.
      await comun.auditar({ id: usuario, rol: null }, 'INICIO_SESION_FALLIDO', { recurso: 'auth', resultado: 'DENEGADO' }).catch(() => {});
      throw E.unauthorized('Usuario o contraseña incorrectos');
    }
    // Como en las lecturas: sin evento en la bitácora no se entrega la sesión.
    await comun.auditar({ id: cuenta.usuario, rol: cuenta.rol }, 'INICIO_SESION', { recurso: 'auth' });
    return { usuario: cuenta.usuario, rol: cuenta.rol };
  }

  return { iniciarSesion };
}

module.exports = { crearAutenticacionService };
