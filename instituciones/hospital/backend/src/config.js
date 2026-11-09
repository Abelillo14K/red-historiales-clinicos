const req = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta la variable ${k} en .env`);
  return v;
};

const jwtSecret = req('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

export const config = {
  institucion: 'hospital_general', // igual al claim `institucion` del JWT y a modulo.js
  puerto: Number(process.env.PORT || 3002),
  jwtSecret,
  jwtExpira: process.env.JWT_EXPIRA || '8h',
  jwtIssuer: process.env.JWT_ISSUER || 'centro-pediatrico-dev',       // mismos valores que el resto de servicios (GUIA_EQUIPO §3.1)
  jwtAudience: process.env.JWT_AUDIENCE || 'centro-pediatrico-api',
  db: {
    host: process.env.HOSPITAL_DB_HOST || '127.0.0.1',
    port: Number(process.env.HOSPITAL_DB_PORT || 3306),
    user: req('HOSPITAL_DB_USER'),
    password: process.env.HOSPITAL_DB_PASSWORD || '',
    database: process.env.HOSPITAL_DB_NAME || 'historial_clinico'
  }
};
