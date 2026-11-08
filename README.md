# Red de Historiales Clínicos

Proyecto final de Bases de Datos II (Universidad Rafael Landívar): una plataforma de historiales clínicos compartida por cuatro instituciones. Cada institución tiene **su propio backend y su propio motor de base de datos**. Hay **una sola aplicación web** (React + Vite) y una arquitectura hexagonal común.

| Institución | Carpeta | Responsable | Estado |
|---|---|---|---|
| Centro Médico Pediátrico | [`instituciones/pediatria/`](instituciones/pediatria/README.md) | Abel | **Implementado** con MongoDB: backend, interfaz, pruebas y documentación |
| Hospital General | [`instituciones/hospital/`](instituciones/hospital/README.md) | Ely | Interfaz en vista previa; backend pendiente (MySQL) |
| Clínica Odontológica | [`instituciones/odontologia/`](instituciones/odontologia/README.md) | Eddy | Interfaz en vista previa; backend pendiente (Firestore) |
| Laboratorio Clínico | [`instituciones/laboratorio/`](instituciones/laboratorio/README.md) | Eddy | **Implementado** con PostgreSQL: backend, interfaz, pruebas y documentación |

Pediatría y Laboratorio tienen backend y datos (todos **ficticios**). El sistema no genera indicaciones clínicas.

## Estructura

```
apps/web/          aplicación web única: plataforma común (sesión, permisos, cliente HTTP, layout, componentes)
instituciones/     una carpeta por institución: frontend/ y, cuando existen, backend/, tests/ y docs/
tests/             pruebas de la plataforma común
docs/              GUIA_EQUIPO.md (estructura, contratos y cómo conectar una institución) y DISENO.md (sistema visual)
```

Flujo: inicio de sesión → portal de instituciones → módulo de la institución. **La institución y los permisos de cada sesión los decide el backend** (`GET /api/sesion`). El servidor de Pediatría aloja el servidor común: sirve la aplicación web y el enrutador por institución, y monta el Laboratorio cuando `LABORATORIO_DB_URL` está configurada.

| Documento | Contenido |
|---|---|
| [`docs/GUIA_EQUIPO.md`](docs/GUIA_EQUIPO.md) | Responsables, estructura, contratos de sesión, HTTP, errores y permisos; cómo conectar el backend y el frontend de una institución |
| [`docs/DISENO.md`](docs/DISENO.md) | Sistema visual: temas, tokens, componentes y accesibilidad |
| [`instituciones/pediatria/README.md`](instituciones/pediatria/README.md) | API, roles, seguridad, pruebas y documentación académica de Pediatría |
| [`instituciones/laboratorio/README.md`](instituciones/laboratorio/README.md) | Puesta en marcha con PostgreSQL, roles, API y pruebas del Laboratorio |

Tecnologías: React 18, React Router 7 y Vite 8 en la web; Node.js (≥ 20.19), Express 4, Zod y JWT en los backends; el driver oficial de MongoDB 6 en Pediatría (MongoDB 9.0) y `pg` 8 en Laboratorio (PostgreSQL ≥ 16); `node:test` y `playwright-core` para las pruebas.

## Instalación (Windows, PowerShell)

**Requisitos:**
- Node.js ≥ 20.19 con npm.
- MongoDB Community Server 9.0.
- PostgreSQL 16 o superior (solo para el Laboratorio; ver su [README](instituciones/laboratorio/README.md)).
- Para las pruebas E2E: Microsoft Edge o Google Chrome.
- Para respaldos: [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools).

No se instala nada de forma global.

```powershell
git clone https://github.com/Abelillo14K/red-historiales-clinicos.git
cd red-historiales-clinicos
npm ci                      # dependencias del backend y de las pruebas
npm run web:ci              # dependencias de la aplicación web
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # pegue el resultado en JWT_SECRET
notepad .env
```

**`.env`:** cada integrante crea el suyo; nunca se sube a Git.
- `JWT_SECRET`: obligatorio, de al menos 32 caracteres.
- `MONGO_URI`: `mongodb://127.0.0.1:27017` sin autenticación, o `mongodb://<usuario>:<contraseña>@127.0.0.1:27017/?authSource=admin` (basta el rol `readWrite`).
- `LABORATORIO_DB_URL`: opcional; si falta, el Laboratorio no se monta. Pasos en el [README del Laboratorio](instituciones/laboratorio/README.md).
- El resto puede quedar como en el ejemplo.

**Base de Pediatría:** elija una opción.
- **La base `centro_pediatrico_db` ya existe.** Compruébela en solo lectura con `npm run db:diagnostico` y `npm run db:validadores`.
- **Base vacía.** Ejecute `npm run db:indices` y luego, con una URI de usuario `dbAdmin` en `$env:MONGO_ADMIN_URI`, `npm run db:validadores -- --aplicar`. Ninguno de los dos borra datos. Los médicos y vacunas se dan de alta como administrador por la API (`POST /api/medicos`, `POST /api/vacunas`; ejemplo en el README de Pediatría).
- **Datos de demostración.** Restaure un respaldo compartido por un medio privado, siguiendo [`RESPALDO_Y_RESTAURACION.md`](instituciones/pediatria/docs/RESPALDO_Y_RESTAURACION.md): primero `npm run db:restaurar-aislado -- <carpeta>`, y nunca con `--drop`.

**Ejecutar:**

```powershell
npm run build; npm start    # una terminal: API e interfaz en http://localhost:3001
# o, para desarrollar, en dos terminales:
npm run dev                 # API en http://localhost:3001 (se reinicia al guardar)
npm run web:dev             # interfaz en http://localhost:5173 (incluye /vista-previa)
```

En la pantalla de acceso, el **modo de desarrollo** permite entrar como Médico, Secretaría o Administrador. `http://localhost:3001/salud` debe responder `{"servicio":"centro-pediatrico","ok":true}`. Si el puerto está ocupado: `$env:PORT=3002` (y `$env:VITE_API_PROXY="http://localhost:3002"` para `web:dev`).

| Problema | Solución |
|---|---|
| `Configure JWT_SECRET de al menos 32 caracteres` | Falta `.env` o conserva el secreto de ejemplo |
| `connect ECONNREFUSED 127.0.0.1:27017` | MongoDB no está en ejecución (`Get-Service MongoDB`) o `MONGO_URI` es incorrecta |
| `Cannot GET /` en el puerto 3001 | Falta `npm run build` |
| Pruebas de MongoDB omitidas («sin binario mongod») | `$env:MONGOD_BIN="C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe"` |
| Pruebas de PostgreSQL omitidas («sin binarios de PostgreSQL») | `PG_BIN` en `.env` con la carpeta `bin` de PostgreSQL |
| `Laboratorio Clínico: PostgreSQL NO disponible` al arrancar | PostgreSQL detenido o `LABORATORIO_DB_URL` incorrecta; el resto del servidor funciona y el Laboratorio responde 503 |

## Pruebas

```powershell
npm test                      # 197 pruebas: plataforma (32) + Pediatría (118) + Laboratorio (47)
npm run test:e2e              # Pediatría en Edge/Chrome con MongoDB desechable (27 pasos)
npm run test:e2e:vista-previa # vista previa de las instituciones pendientes (12 pasos)
npm run test:todo             # todo lo anterior
```

**Ninguna prueba toca `centro_pediatrico_db` ni `historial_lab`.** Usan dobles en memoria, un `mongod` desechable o un PostgreSQL desechable que se eliminan al terminar.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` · `npm run dev` | Servidor (API + aplicación compilada) en el puerto 3001 |
| `npm run build` · `npm run web:dev` | Compila la aplicación web · servidor de desarrollo en el puerto 5173 |
| `npm run db:indices` · `db:validadores` · `db:diagnostico` · `db:respaldo` · `db:restaurar-aislado` | Operación de MongoDB de Pediatría |
| `npm run token:dev -- <rol> <usuario>` | JWT de desarrollo (Pediatría) |
| `npm run lab:esquema` · `npm run lab:token -- <rol> <usuario>` · `npm run test:laboratorio` | Laboratorio: aplicar el esquema, JWT de desarrollo y pruebas |
| `npm run web:install` | Agrega o actualiza dependencias de la aplicación web |

## Trabajo en equipo y seguridad

- Cada integrante trabaja en su carpeta `instituciones/<x>/`. Los cambios compartidos (`apps/web/`, `tests/`, `docs/`, `package.json`) se avisan al equipo. Detalle en [`docs/GUIA_EQUIPO.md`](docs/GUIA_EQUIPO.md) §11.
- Antes de integrar en `main`: `npm test` y `npm run build`, y los E2E si se tocó algo compartido. Las ramas y los pull requests se usan cuando son útiles; no se exige aprobación de otro integrante. `main` no admite force-push ni eliminación.
- Nunca suba `.env`, secretos JWT, URIs con contraseña, tokens ni respaldos (`.gitignore` los excluye). El acceso de desarrollo (`/auth/dev-login`) solo responde desde el propio equipo y se desactiva con `NODE_ENV=production`.
