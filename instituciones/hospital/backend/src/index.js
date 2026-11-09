import { config } from './config.js';
import { pool } from './db.js';
import { crearApp } from './app.js';

await pool.query('SELECT 1'); // falla rápido si MySQL no responde
const servidor = crearApp().listen(config.puerto, () =>
  console.log(`Hospital General: http://localhost:${config.puerto}  (salud: /salud)`));

for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => servidor.close(() => pool.end().then(() => process.exit(0))));
