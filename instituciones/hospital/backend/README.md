# Backend · Hospital General (MySQL 8 + Express)

Alineado con `docs/GUIA_EQUIPO.md` (sesión §3, errores §4, permisos §9). Esquema de 29 tablas en `sql/`.

## Puesta en marcha (modo independiente, puerto 3002)
1. `npm install`
2. `.env`: copie `.env.example` y ponga los MISMOS `JWT_SECRET`, `JWT_ISSUER` y `JWT_AUDIENCE` del `.env` de la raíz.
3. Ejecute `sql/01_esquema.sql` y `sql/02_datos_base.sql` (Workbench) y cree el usuario MySQL de la app.
4. `npm run db:crear-usuario -- admin <contraseña-de-la-app> administrador`
5. `npm run dev` → http://localhost:3002/salud

## En el servidor común (puerto 3001)
1. En la raíz del repositorio: `npm run hospital:install`.
2. En el `.env` de la raíz: `HOSPITAL_DB_USER` y `HOSPITAL_DB_PASSWORD` (opcionales: `HOSPITAL_DB_HOST`, `HOSPITAL_DB_PORT`, `HOSPITAL_DB_NAME`).
3. Ejecute `sql/01_esquema.sql` y `sql/02_datos_base.sql`, y cree el usuario MySQL de la app.
4. Cree las cuentas con el prefijo `hosp.`: `npm run hospital:usuario -- hosp.admin <contraseña> administrador`. Para que un médico registre consultas a su nombre, agregue su `id_medico` al final.
5. `npm start` debe mostrar `Hospital General: MySQL conectado`. Se entra por el formulario común con la cuenta `hosp.*`.

## Estructura
- `src/router.js` → `crearRouterHospital()`: rutas relativas a `/api` (incluye `GET /sesion`). Es lo que se registra en el servidor común.
- `src/app.js` → servidor independiente solo para desarrollo.
- Permisos por rol: `src/seguridad.js`. Auditoría de tablas restringidas: `src/bitacora.js` (`GET /api/auditoria`).

## Límites por ceñirse al documento Fase I
- No hay columna para el motivo de baja (ALTER opcional comentado en `01_esquema.sql`).
- Sin relación medicamento↔alergia: la alerta compara por nombre.
- Sin cita no hay columna de motivo en `consulta`: se guarda en `observaciones`.
- Los catálogos (salvo médicos) no tienen estado: no se desactivan.
