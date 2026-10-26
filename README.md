# Red de Historiales Clínicos

Plataforma multiinstitución para la gestión de historiales clínicos. Proyecto académico (Bases de Datos II) con React, Express y módulos independientes para cuatro instituciones y diferentes motores de bases de datos.

Es un monorepositorio con **una sola aplicación web** (React + Vite) que comparten cuatro instituciones. Cada una tiene **su propio backend y su propio motor de datos**, y la institución y los permisos de cada sesión los decide siempre el backend (`GET /api/sesion`).

| Institución | Carpeta | Responsable | Estado |
|---|---|---|---|
| Centro Médico Pediátrico | [`instituciones/pediatria/`](instituciones/pediatria/README.md) | Propietario del proyecto | **Implementado** (MongoDB): backend, módulo React, scripts, pruebas y documentación |
| Hospital General | [`instituciones/hospital/`](instituciones/hospital/README.md) | Ely | Módulo React preparado; backend **pendiente de integrar** |
| Clínica Odontológica | [`instituciones/odontologia/`](instituciones/odontologia/README.md) | Eddy | Módulo React preparado; backend **pendiente de integrar** |
| Laboratorio Clínico | [`instituciones/laboratorio/`](instituciones/laboratorio/README.md) | Eddy | Módulo React preparado; backend **pendiente de integrar** |

> **Alcance real:** solo Pediatría tiene backend y datos. Los otros módulos no tienen backend, no están registrados en la aplicación y no muestran datos; se revisan en la vista previa de desarrollo («Ver diseño» en el portal o `/vista-previa`). Todavía no existen PostgreSQL, MySQL, Firebase ni un inicio de sesión común, y el motor de cada institución pendiente aún no está confirmado ([`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) §6). Todos los datos son **ficticios** y el sistema **no genera indicaciones clínicas**.

## Arquitectura en breve

```
Navegador ─ apps/web (React) ─ plataforma común: sesión, portal, layout, permisos, cliente HTTP
                │  carga SOLO el módulo de la institución que informa el backend
                ▼
        instituciones/<x>/frontend  (manifiesto modulo.js, páginas, api.js)
                │  HTTP + JWT
                ▼
        backend de la institución ─▶ su motor de datos (Pediatría: Express + MongoDB)
```

- **Flujo de usuario:** inicio de sesión → portal de instituciones (`/instituciones`) → panel de la institución → «Volver a instituciones», todo sin cerrar sesión.
- El portal es navegación, no autorización: solo se entra a una institución cuando la sesión verificada por el backend le pertenece. Las instituciones pendientes ofrecen «Ver diseño» únicamente en desarrollo.
- El servidor de Pediatría aloja hoy el servidor común (enrutador por institución, JWT y entrega de `apps/web/dist`). Detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## 1. Estructura del repositorio

```
red-historiales-clinicos/
├── apps/web/                 ÚNICA aplicación frontend (React + Vite)
│   ├── src/plataforma/       base común: sesión, permisos, cliente HTTP, layout, componentes, tema, vista previa
│   ├── alias.js              alias @plataforma y @instituciones (un solo lugar)
│   └── vite.config.js        configuración de Vite y proxy de desarrollo
├── instituciones/
│   ├── pediatria/            backend/ · frontend/ · scripts/ · mongodb/ · tests/ · docs/
│   ├── hospital/             frontend/ (módulo React) · README.md
│   ├── odontologia/          frontend/ (módulo React) · README.md
│   └── laboratorio/          frontend/ (módulo React) · README.md
├── tests/                    pruebas de la plataforma (contrato de módulos, cliente HTTP, proxy de Vite, vista previa)
├── docs/                     arquitectura, integración, frontend del equipo y sistema visual
├── scripts/                  herramientas comunes (paquete de revisión de código)
├── package.json              dependencias del backend y de las pruebas; todos los comandos npm
└── .env.example              variables de entorno (copiar a .env)
```

Las carpetas locales `respaldos/` (incluye el respaldo verificado de MongoDB) y `.env` existen solo en cada equipo y están excluidas de Git.

| Documento | Contenido |
|---|---|
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Qué va en cada carpeta, alias, dependencias, decisiones, responsabilidades y colaboración de los tres integrantes |
| [`docs/GUIA_INTEGRACION_EQUIPO.md`](docs/GUIA_INTEGRACION_EQUIPO.md) | Contratos de sesión, HTTP y errores, operaciones comunes, conexión de backend y motor, permisos y verificación |
| [`docs/FRONTEND_EQUIPO.md`](docs/FRONTEND_EQUIPO.md) | Añadir páginas, conectar APIs, declarar permisos, pasar de módulo pendiente a conectado y vista previa |
| [`docs/DISENO.md`](docs/DISENO.md) | Sistema visual: temas claro y oscuro, paleta, contraste WCAG, tokens y componentes compartidos |
| [`docs/capturas/`](docs/capturas) | Capturas de la vista previa de los módulos pendientes (claro y oscuro) |
| [`instituciones/pediatria/README.md`](instituciones/pediatria/README.md) | API REST, roles, seguridad, mejoras, limitaciones y documentos de Pediatría |

## 2. Tecnologías

| Capa | Tecnología |
|---|---|
| Aplicación web | React 18, React Router 7, Vite 8; componentes y tokens propios, tema claro (predeterminado), oscuro y según el sistema |
| Backend de Pediatría | Node.js 24, Express 4, Zod 4.6.7, jsonwebtoken, dotenv; driver oficial `mongodb` 6.x sobre MongoDB 9.0 |
| Pruebas | `node:test`, doble en memoria, `mongod` desechable y `playwright-core` (solo desarrollo) con Edge o Chrome instalados |

## 3. Instalación desde cero en Windows (PowerShell)

Procedimiento comprobado el 24/10/2026 en una copia limpia del proyecto (estructura actualizada al monorepositorio el 25/10/2026) (sin `node_modules`, `apps/web/dist`, `.env` ni `respaldos/`), con una base vacía y con un respaldo restaurado.

### 3.1 Requisitos

| Herramienta | Para qué | ¿Obligatoria? |
|---|---|---|
| Node.js ≥ 20.19 con npm (probado con Node 24.14 y npm 11.11) | API, compilación del frontend y pruebas | Sí |
| MongoDB Community Server 9.0 (servicio de Windows o `mongod`) | Base de datos; su `mongod.exe` también lo usan las pruebas | Sí |
| Microsoft Edge o Google Chrome | Solo `npm run test:e2e` | No |
| [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) ≥ 100.19 | Solo respaldo y restauración (`instituciones/pediatria/docs/RESPALDO_Y_RESTAURACION.md`) | No |

No se instala nada de forma global: Vite y `playwright-core` son dependencias locales, y `playwright-core` usa el Edge o Chrome ya instalado (no descarga navegadores). El paquete que se entrega al equipo **no** debe incluir `node_modules/`, `apps/web/node_modules/`, `apps/web/dist/`, `.env` ni `respaldos/`: se generan en cada equipo.

### 3.2 Dependencias

Obtenga el proyecto (repositorio privado, con acceso concedido por el propietario):

```powershell
git clone https://github.com/<propietario>/red-historiales-clinicos.git
cd red-historiales-clinicos
```

Abra PowerShell **en la carpeta del proyecto** (la que contiene `package.json`, `apps/` e `instituciones/`) e instale las versiones exactas de los lockfiles:

```powershell
npm ci                      # backend (package-lock.json)
npm run web:ci              # aplicación web (apps/web/package-lock.json)
```

`npm install` y `npm run web:install` solo hacen falta para **agregar o actualizar** dependencias (modifican los lockfiles).

### 3.3 Variables de entorno (`.env`)

Cada integrante crea su propio `.env`; **nunca** se comparte ni se sube a Git.

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # copie el resultado en JWT_SECRET
notepad .env
```

- `JWT_SECRET`: obligatorio, ≥ 32 caracteres. La API **no arranca** con el valor de ejemplo (`CAMBIAR_POR…`).
- `MONGO_URI`: sin autenticación, `mongodb://127.0.0.1:27017`; con usuario, `mongodb://<usuario>:<contraseña>@127.0.0.1:27017/?authSource=admin` (los caracteres especiales de la contraseña van codificados, p. ej. `@` → `%40`). Basta con el rol `readWrite` sobre `centro_pediatrico_db`.
- `PORT` (3001 por defecto), `MONGO_DB`, `JWT_ISSUER`, `JWT_AUDIENCE` y `NODE_ENV=development` pueden quedar como en el ejemplo.

### 3.4 Base de datos de Pediatría (MongoDB)

Hoy el único backend es el de Pediatría (`instituciones/pediatria/`). Elija **una** opción:

**a) La base `centro_pediatrico_db` ya existe** (equipo del integrante 2). No hay que preparar nada; para comprobarla sin escribir:
```powershell
npm run db:diagnostico      # colecciones, documentos, índices y validadores (solo lectura)
npm run db:validadores      # documentos frente a los validadores de Fase II (solo lectura)
```

**b) Servidor MongoDB nuevo, base vacía.** Cree índices y validadores (el validador requiere un usuario con `dbAdmin`; en un MongoDB local sin autenticación basta la URI simple). Ninguno de los dos comandos borra datos:
```powershell
npm run db:indices
$env:MONGO_ADMIN_URI = "mongodb://127.0.0.1:27017"    # o una URI con usuario dbAdmin
npm run db:validadores -- --aplicar
Remove-Item Env:MONGO_ADMIN_URI
```
Los catálogos de médicos y vacunas se dan de alta con el rol administrador por la API (la interfaz los consulta, no los crea). Con la API en marcha (§3.5):
```powershell
$t = (Invoke-RestMethod -Method Post http://localhost:3001/auth/dev-login -ContentType 'application/json' -Body '{"rol":"administrador","usuario":"ADMIN-DEMO"}').token
$h = @{ Authorization = "Bearer $t" }
Invoke-RestMethod -Method Post http://localhost:3001/api/medicos -Headers $h -ContentType 'application/json; charset=utf-8' -Body '{"id_medico":"M001","colegiado":"COL-FICTICIO-001","nombres":"Lucia","apellidos":"Ejemplo","especialidad":{"id_especialidad":"ESP01","nombre":"Pediatria"}}'
Invoke-RestMethod -Method Post http://localhost:3001/api/vacunas -Headers $h -ContentType 'application/json; charset=utf-8' -Body '{"id_vacuna":"V001","nombre":"Vacuna demostrativa A","descripcion":"Dato ficticio"}'
```
Después, con **Secretaría** se registran pacientes y con **Médico** consultas, crecimiento y vacunación. Los scripts de `instituciones/pediatria/mongodb/` son históricos y están bloqueados: no los use para crear la base.

**c) Servidor nuevo con los datos de demostración.** El integrante 2 comparte por un medio privado una carpeta de `respaldos/mongodb/<fecha>/` (datos ficticios; `respaldos/` no va en el paquete). Primero verifíquela sin tocar su servidor con `npm run db:restaurar-aislado -- <carpeta>` y luego restáurela **solo en un servidor donde `centro_pediatrico_db` no exista**, siempre con `--uri` explícita y **sin `--drop`** (detalles y salvaguardas en [`RESPALDO_Y_RESTAURACION.md`](instituciones/pediatria/docs/RESPALDO_Y_RESTAURACION.md)):
```powershell
mongorestore --uri="mongodb://127.0.0.1:27017" --archive="<carpeta>\centro_pediatrico_db.archive.gz" --gzip --nsInclude="centro_pediatrico_db.*" --stopOnError
```
Restaura documentos, índices y validadores.

### 3.5 Compilar y ejecutar

**Opción A — una sola terminal (recomendada para la demostración)**
```powershell
npm run build               # compila el frontend en apps/web/dist
npm start                   # abre http://localhost:3001
```

**Opción B — desarrollo (dos terminales)**
```powershell
npm run dev                 # Terminal 1: API en http://localhost:3001 (se reinicia al guardar)
npm run web:dev             # Terminal 2: interfaz en http://localhost:5173 (redirige /api, /auth y /salud a la API)
```

Al iniciar, la API muestra si hay transacciones (no, servidor standalone), si el perímetro cefálico es opcional u obligatorio según el validador instalado, y entrega los eventos de auditoría pendientes. En el navegador, en la sección **Modo de desarrollo** elija **Médico**, **Secretaría** o **Administrador** y pulse **Entrar (modo desarrollo)**. El tema (claro —predeterminado—, oscuro o según el sistema) se cambia en el menú de usuario y se recuerda en el navegador. En escritorio, el menú lateral se puede contraer a iconos.

Si el puerto 3001 está ocupado: `$env:PORT=3002; npm start` (o cambie `PORT` en `.env`); en la opción B indique a Vite la API con `$env:VITE_API_PROXY="http://localhost:3002"; npm run web:dev`.

### 3.6 Comprobación rápida

1. `http://localhost:3001/salud` responde `{"servicio":"centro-pediatrico","ok":true}`.
2. `http://localhost:3001` muestra **Iniciar sesión**; entre como **Administrador** y vea el panel y **Auditoría**.
3. `npm test` termina con `fail 0` en sus dos partes (§4).

### 3.7 Problemas frecuentes

| Mensaje o síntoma | Causa y solución |
|---|---|
| `Configure JWT_SECRET de al menos 32 caracteres` | Falta `.env` o conserva el secreto de ejemplo: genere uno (§3.3) |
| `connect ECONNREFUSED 127.0.0.1:27017` | MongoDB no está en ejecución (`Get-Service MongoDB`) o `MONGO_URI` apunta a otro puerto |
| `Authentication failed` | Usuario, contraseña o `authSource` de `MONGO_URI` incorrectos |
| `El puerto 3001 ya está en uso` | Ya hay una API en marcha: cambie `PORT` (§3.5) |
| `http://localhost:3001` no muestra la interfaz (`Cannot GET /`) | Falta `npm run build` (opción A) o use la opción B |
| `npm ci` falla por lockfile desincronizado | Alguien editó `package.json` sin `npm install`: no modifique los lockfiles a mano |
| Pruebas de MongoDB omitidas (`sin binario mongod`) | Defina `$env:MONGOD_BIN="C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe"` |
| `No se encontró Microsoft Edge ni Google Chrome instalados` | Instale uno de los dos para `npm run test:e2e` |

## 4. Pruebas

```powershell
npm test                      # plataforma + Pediatría (108 pruebas)
npm run test:plataforma       # 30: contrato de módulos, portal de instituciones, módulos pendientes, cliente HTTP, proxy de Vite, compilación sin vista previa
npm run test:pediatria        # 78: backend, seguridad, permisos e integración con MongoDB desechable
npm run test:e2e              # Pediatría en Edge/Chrome real con MongoDB desechable (27 pasos)
npm run test:e2e:vista-previa # vista previa de los módulos pendientes con Vite real (10 pasos)
npm run test:todo             # todo lo anterior
npm audit                     # dependencias de la raíz
npm --prefix apps/web audit   # dependencias de la aplicación web
```

Ninguna prueba toca `centro_pediatrico_db`. Las pruebas de plataforma (`tests/`) usan como backend de referencia la API de Pediatría sobre su doble en memoria, porque es el único backend que existe. Las de cada institución viven en `instituciones/<carpeta>/tests/`.

| Archivo | Qué prueba |
|---|---|
| `tests/frontend-modulos.test.js` | Contrato de módulos: validación del manifiesto, registro con varias instituciones, estados de sesión, navegación y rutas por permiso, migas de pan |
| `tests/frontend-equipo.test.js` | Módulos pendientes: estructura, contrato, roles y permisos sin inventar, `api.js` sin peticiones, páginas sin envíos ni datos, aislamiento entre instituciones y compilación de producción **sin** vista previa |
| `tests/frontend-portal.test.js` | Portal de instituciones: estados según la sesión del backend, presentación única por institución, destino tras el inicio de sesión y portal sin tokens ni peticiones |
| `tests/frontend-cliente.test.js` | Cliente HTTP común contra la API real |
| `tests/vite-proxy.test.js` | Vite real con `apps/web/vite.config.js`: la demo obtiene token por el proxy y un cliente remoto (también con `X-Forwarded-For` manipulado) no |
| `tests/e2e/vista-previa.e2e.js` | Vista previa en navegador: todas las pantallas de los módulos pendientes, sin escritura, claro y oscuro, 1920/1366/820/390 px, accesibilidad, contraste y sesión intacta |
| `tests/e2e/auditoria-ui.js` | Auditorías de accesibilidad y contraste WCAG AA compartidas por las pruebas en navegador |
| `tests/soporte/alias-frontend*.mjs` | Resolución de los alias del frontend en Node (mismo origen que Vite: `apps/web/alias.js`) |
| `instituciones/pediatria/tests/` | Pruebas de Pediatría ([detalle](instituciones/pediatria/README.md#3-pruebas-de-la-institución)) |

## 5. Comandos

| Comando | Qué hace |
|---|---|
| `npm ci` · `npm run web:ci` | Instala las dependencias exactas (raíz · aplicación web) |
| `npm start` · `npm run dev` | Servidor de Pediatría en el puerto 3001 (también sirve `apps/web/dist`) |
| `npm run build` · `npm run web:dev` | Compila la aplicación web · servidor de desarrollo en el puerto 5173 (incluye `/vista-previa`) |
| `npm run db:*` · `npm run seed` · `npm run token:dev` | Operación de MongoDB y token de desarrollo de Pediatría (ver su README) |
| `npm run web:install` | Agrega o actualiza dependencias de la aplicación web |

## 6. Seguridad y configuración

- La configuración se lee de `.env`, que se crea a partir de [`.env.example`](.env.example) (§3.3). `.env.example` solo contiene valores de ejemplo; **nunca** suba un `.env`, secretos JWT, URIs con contraseña ni tokens.
- `.gitignore` excluye `.env`, `node_modules/`, `dist/`, `respaldos/`, volcados (`*.bson`, `*.archive`, `*.gz`, `*.zip`), bases locales, registros, cachés y configuraciones personales del editor.
- Los respaldos de MongoDB (aunque contengan datos ficticios) se comparten solo por un medio privado, nunca por el repositorio.
- El acceso de desarrollo (`POST /auth/dev-login`) se desactiva con `NODE_ENV=production`. El navegador nunca decide la institución ni los permisos: los decide el backend en cada petición.

## 7. Trabajo en equipo con Git

Cada responsable trabaja en su carpeta (`instituciones/<carpeta>/`). Los cambios en `apps/web/`, `tests/` o `docs/` afectan a todas las instituciones y se acuerdan antes ([`docs/FRONTEND_EQUIPO.md`](docs/FRONTEND_EQUIPO.md) §11).

```powershell
git switch main; git pull                      # partir siempre de main actualizado
git switch -c hospital/pacientes               # una rama por tarea: <institucion>/<tema>
# ... cambios dentro de instituciones/hospital/ ...
npm test; npm run build                        # antes de subir (y los E2E si tocó algo compartido)
git add instituciones/hospital
git commit -m "feat(hospital): listado de pacientes"
git push -u origin hospital/pacientes          # luego, abrir un pull request hacia main
```

No se usa `git push --force` sobre `main`, y `main` se actualiza solo mediante pull requests revisados.
