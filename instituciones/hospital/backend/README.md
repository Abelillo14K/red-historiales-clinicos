# Backend · Hospital General (MySQL 8 + Express)

Alineado con `docs/GUIA_EQUIPO.md` (sesión §3, errores §4, permisos §9). Esquema de 29 tablas en `sql/`.

## Puesta en marcha (modo independiente, puerto 3002)
1. `npm install`
2. `.env`: copie `.env.example` y ponga los MISMOS `JWT_SECRET`, `JWT_ISSUER` y `JWT_AUDIENCE` del `.env` de la raíz.
3. Ejecute `sql/01_esquema.sql` y `sql/02_datos_base.sql` (Workbench) y cree el usuario MySQL de la app.
4. `npm run db:crear-usuario -- admin <contraseña-de-la-app> administrador`
5. `npm run dev` → http://localhost:3002/salud
6. `npm run token:dev -- admin` → imprime un JWT.

## Probar con la interfaz
Terminal 1 (backend): `npm run dev` · Terminal 2 (raíz del repo):
`$env:VITE_API_PROXY="http://localhost:3002"; npm run web:dev`
En la pantalla de acceso: «Usar un token institucional» → pegue el JWT del paso 6.
(El login con contraseña de la pantalla es un pendiente común del equipo; mientras tanto se usa el token.)

## Estructura
- `src/router.js` → `crearRouterHospital()`: rutas relativas a `/api` (incluye `GET /sesion`). Es lo que se registra en el servidor común.
- `src/app.js` → servidor independiente solo para desarrollo.
- Permisos por rol: `src/seguridad.js`. Auditoría de tablas restringidas: `src/bitacora.js` (`GET /api/auditoria`).

## Límites por ceñirse al documento Fase I
- No hay columna para el motivo de baja (ALTER opcional comentado en `01_esquema.sql`).
- Sin relación medicamento↔alergia: la alerta compara por nombre.
- Sin cita no hay columna de motivo en `consulta`: se guarda en `observaciones`.
- Los catálogos (salvo médicos) no tienen estado: no se desactivan.
