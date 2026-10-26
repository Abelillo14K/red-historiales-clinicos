'use strict';
// Errores de dominio: la API los traduce a códigos HTTP sin conocer MongoDB.
class DomainError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}
const notFound = msg => new DomainError(msg, 404, 'NO_ENCONTRADO');
const conflict = msg => new DomainError(msg, 409, 'CONFLICTO');
const invalid = msg => new DomainError(msg, 400, 'REGLA_NEGOCIO');
const badReference = msg => new DomainError(msg, 422, 'REFERENCIA_INVALIDA');
const forbidden = msg => new DomainError(msg, 403, 'PROHIBIDO');

module.exports = { DomainError, notFound, conflict, invalid, badReference, forbidden };
