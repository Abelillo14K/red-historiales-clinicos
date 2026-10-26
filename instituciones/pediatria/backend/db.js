'use strict';
// Conexión MongoDB. La URI (con credenciales) solo se lee de variables de entorno.
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', {
  appName: 'centro-pediatrico-api',
  serverSelectionTimeoutMS: 8000,
  maxPoolSize: 20
});
async function connect() {
  await client.connect();
  return client.db(process.env.MONGO_DB || 'centro_pediatrico_db');
}
module.exports = { connect, client };
