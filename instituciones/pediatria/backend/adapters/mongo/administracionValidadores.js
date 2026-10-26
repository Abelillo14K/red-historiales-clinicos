'use strict';
// Administración segura de los validadores $jsonSchema (collMod):
//   estado -> verificar -> respaldar -> aplicar -> (revertir).
// collMod solo cambia la regla de validación de la colección: no modifica ni
// elimina documentos. Aun así se respalda el validador previo y los datos.
const fs = require('node:fs');
const path = require('node:path');
const { BSON } = require('mongodb');
const { VALIDADORES } = require('./validadores');

const COLECCIONES = Object.keys(VALIDADORES);

async function estado(db) {
  const infos = await db.listCollections({ name: { $in: COLECCIONES } }).toArray();
  return Object.fromEntries(COLECCIONES.map(c => {
    const o = infos.find(i => i.name === c)?.options || null;
    return [c, o && {
      existe: true, validator: o.validator || null,
      validationLevel: o.validationLevel || 'strict', validationAction: o.validationAction || 'error'
    }];
  }).map(([c, v]) => [c, v || { existe: false, validator: null }]));
}

// Cuenta (solo lectura) los documentos que el validador nuevo rechazaría.
async function verificar(db, validadores = VALIDADORES) {
  const r = {};
  for (const [c, schema] of Object.entries(validadores)) {
    const col = db.collection(c);
    const incumplen = await col.find({ $nor: [{ $jsonSchema: schema }] }, { projection: { _id: 1 } }).limit(50).toArray();
    r[c] = { total: await col.countDocuments(), incumplen: incumplen.map(d => String(d._id)) };
  }
  return r;
}

// Respaldo en EJSON canónico (conserva tipos BSON: Date, ObjectId, Int32...).
async function respaldar(db, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const previo = await estado(db);
  fs.writeFileSync(path.join(dir, 'validadores_previos.json'), BSON.EJSON.stringify(previo, null, 2, { relaxed: false }));
  const conteos = {};
  for (const c of COLECCIONES) {
    const docs = await db.collection(c).find({}).toArray();
    conteos[c] = docs.length;
    fs.writeFileSync(path.join(dir, `${c}.json`), BSON.EJSON.stringify(docs, null, 2, { relaxed: false }));
  }
  fs.writeFileSync(path.join(dir, 'LEEME.txt'),
    'Respaldo previo a collMod. validadores_previos.json permite revertir con:\n' +
    `  npm run db:validadores -- --revertir "${dir}"\n` +
    'Los archivos <coleccion>.json contienen los documentos en EJSON canónico (solo lectura; collMod no los modifica).\n' +
    `Conteos: ${JSON.stringify(conteos)}\n`);
  return { dir, conteos, previo };
}

const opcionesCollMod = (c, v) => ({
  collMod: c, validator: v.validator || {},
  validationLevel: v.validationLevel || 'strict', validationAction: v.validationAction || 'error'
});

async function aplicar(db, validadores = VALIDADORES) {
  const v = await verificar(db, validadores);
  const malos = Object.entries(v).filter(([, x]) => x.incumplen.length);
  if (malos.length) {
    throw new Error(`Documentos que incumplen el validador: ${malos.map(([c, x]) => `${c} (${x.incumplen.join(', ')})`).join('; ')}`);
  }
  for (const [c, schema] of Object.entries(validadores)) {
    if (!(await estado(db))[c].existe) await db.createCollection(c);
    await db.command(opcionesCollMod(c, { validator: { $jsonSchema: schema } }));
  }
  return v;
}

// Restaura exactamente los validadores leídos antes de aplicar.
async function revertir(db, previo) {
  for (const c of COLECCIONES) {
    const p = previo[c];
    if (!p?.existe) continue;
    await db.command(opcionesCollMod(c, p));
  }
}

const leerRespaldo = dir => BSON.EJSON.parse(fs.readFileSync(path.join(dir, 'validadores_previos.json'), 'utf8'), { relaxed: false });

module.exports = { COLECCIONES, estado, verificar, respaldar, aplicar, revertir, leerRespaldo };
