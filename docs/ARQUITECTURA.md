# Arquitectura del repositorio y organización del equipo

Cómo está organizado el monorepositorio, por qué, y cómo trabajan en paralelo los **tres integrantes** sobre **cuatro instituciones**. Es el lugar único para la estructura, las responsabilidades y la asignación del equipo. Los contratos técnicos están en [`GUIA_INTEGRACION_EQUIPO.md`](GUIA_INTEGRACION_EQUIPO.md) y el trabajo de frontend en [`FRONTEND_EQUIPO.md`](FRONTEND_EQUIPO.md).

> **Estado real (25/10/2026).** Solo el Centro Médico Pediátrico tiene backend (MongoDB). Hospital General, Clínica Odontológica y Laboratorio Clínico tienen su módulo React preparado y pendiente de integración. No hay carpetas vacías para backends ni bases que aún no existen.

## 1. Principios

1. **Una sola aplicación web** (`apps/web`): una interfaz, un sistema visual, una sesión y un registro de módulos.
2. **Cada institución aporta módulos React**, no un frontend propio: no tienen `package.json`, Vite ni dependencias propias.
3. **Cada institución tiene su backend y su motor.** Solo se comparte el contrato HTTP; el esquema de persistencia es de cada una.
4. **El backend decide** la institución y los permisos de la sesión (`GET /api/sesion`); el frontend solo decide qué mostrar.
5. **Un lugar por responsabilidad** (§2) y **sin carpetas vacías**: una carpeta se crea cuando tiene contenido real.

## 2. Qué va en cada carpeta

| Carpeta | Contenido | Responsable |
|---|---|---|
| `apps/web/` | Aplicación React + Vite: `src/plataforma/` (sesión, permisos, cliente HTTP, contrato y registro de módulos, layout, componentes, tema, vista previa), `src/styles.css`, `alias.js`, `vite.config.js`, su `package.json` | **Compartida**: cambios acordados por el equipo |
| `instituciones/<x>/frontend/` | Módulo React: `modulo.js` (manifiesto), `api.js`, `paginas/`, `componentes/` | Responsable de la institución |
| `instituciones/<x>/backend/` | Backend de la institución (hoy solo Pediatría) | Responsable de la institución |
| `instituciones/<x>/tests/` | Pruebas propias de la institución (hoy solo Pediatría) | Responsable de la institución |
| `instituciones/<x>/scripts/`, `mongodb/`, `docs/` | Operación de su motor, scripts históricos y documentación propia (hoy solo Pediatría) | Responsable de la institución |
| `instituciones/<x>/README.md` | Estado, contenido y pendientes de la institución | Responsable de la institución |
| `tests/` | Pruebas de la plataforma: contrato de módulos, módulos pendientes, cliente HTTP, proxy de Vite, vista previa en navegador y sus utilidades | Compartida |
| `docs/` | Arquitectura, contratos de integración, guía de frontend, sistema visual y capturas de la vista previa | Compartida |
| `scripts/` | Herramientas comunes (hoy: `preparar_auditoria_pediatria.ps1`, empaqueta el código para revisión) | Compartida |
| `respaldos/` | Respaldos locales, excluidos de Git (incluye el respaldo verificado de MongoDB en `respaldos/mongodb/`) | Integrante 2 (Pediatría) |
| `package.json` (raíz) | Dependencias del backend y de las pruebas; **todos** los comandos `npm` | Compartido |

Pediatría hoy:

```
instituciones/pediatria/
├── backend/     server.js, app.js, security.js, permisos.js, schema.js, db.js, domain/, application/, ports/, adapters/mongo/, api/
├── frontend/    modulo.js, api.js, paginas/, componentes/
├── scripts/     seed.js, validadores.js, dev-token.js, respaldo/
├── mongodb/     scripts mongosh históricos (bloqueados)
├── tests/       *.test.js, helpers.js, doubles/, soporte/, e2e/
└── docs/        modelo, operación, respaldo, trazabilidad, demostración, informe, capturas, histórico
```

## 3. Alias de importación

Definidos **una sola vez** en `apps/web/alias.js`:

| Alias | Apunta a | Uso |
|---|---|---|
| `@plataforma/...` | `apps/web/src/plataforma/...` | módulos institucionales → componentes, sesión, contexto de módulo, cliente HTTP |
| `@instituciones/...` | `instituciones/...` | la plataforma → manifiestos de las instituciones (`registro.js`, vista previa) |

```jsx
// instituciones/hospital/frontend/paginas/Pacientes.jsx
import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
import { Card, PageHeader } from '@plataforma/ui/index.js';
import EncabezadoExpediente from '../componentes/EncabezadoExpediente.jsx';   // dentro de su carpeta: relativo
```

Reglas (las comprueba `tests/frontend-equipo.test.js`): un módulo importa archivos de **su** carpeta con rutas relativas, la plataforma con `@plataforma/`, y React o React Router; **nunca** archivos de otra institución.

Cómo funciona:

- **Vite** (`apps/web/vite.config.js`): `resolve.alias`; `resolve.dedupe` para que los módulos de `instituciones/` usen la única copia de React de `apps/web/node_modules`; `optimizeDeps.include` para que React Router se optimice desde el inicio (sin esto, en desarrollo se cargaban dos copias de React); `server.fs.allow` limitado a `apps/web` e `instituciones` (la raíz, con `.env`, no se sirve).
- **Node** (pruebas): `npm run test:plataforma` carga `tests/soporte/alias-frontend.mjs`, que resuelve los mismos alias leyendo `apps/web/alias.js` y trata como ESM los `.js` de `instituciones/*/frontend/`.
- El backend (CommonJS) usa rutas relativas cortas dentro de su carpeta; no necesita alias.

## 4. Dependencias

| `package.json` | Dependencias | Lockfile |
|---|---|---|
| raíz | backend (express, mongodb, zod, jsonwebtoken, dotenv) y pruebas (playwright-core) | `package-lock.json` |
| `apps/web/` | aplicación web (react, react-dom, react-router-dom, vite, @vitejs/plugin-react) | `apps/web/package-lock.json` |

- Las instituciones **no** tienen `package.json`: su frontend usa las dependencias de `apps/web` y su backend las de la raíz (Node las busca subiendo carpetas).
- **No se usan npm workspaces.** Unirían los dos lockfiles en uno nuevo (resolviendo otra vez versiones que hoy están fijadas) y cambiarían dónde se instala Vite, sin una ventaja práctica para dos paquetes. Si en el futuro un backend necesita dependencias propias, se agregan a la raíz (acordándolo) o se reevalúa esta decisión.
- Agregar una dependencia: `npm install <paquete>` en la raíz (backend) o `npm --prefix apps/web install <paquete>` (frontend), avisando al equipo, porque modifica un lockfile compartido.

## 5. Decisiones y deuda conocida

| Decisión | Motivo | Cuándo revisarla |
|---|---|---|
| El backend de Pediatría **aloja** hoy el servidor común: sirve `apps/web/dist`, monta el enrutador por institución (`backend/api/enrutadorInstituciones.js`) y valida el JWT (`backend/security.js`) | Es el único backend. Separar esa capa obligaba a modificar la seguridad y la composición del servidor sin un segundo backend que la use | Cuando el segundo backend esté listo: el equipo acuerda extraer la capa común (por ejemplo, a `apps/api/`) o montar los routers de las demás instituciones en `backend/app.js` de Pediatría |
| Las pruebas de plataforma usan la API de Pediatría (doble en memoria) | Es la única API que existe para probar el cliente HTTP, el proxy de Vite y la vista previa | Cuando haya otra API, las pruebas de plataforma pueden usar un backend mínimo propio |
| Sin npm workspaces ni herramientas de monorepositorio | §4 | Si aparecen más de dos paquetes con dependencias propias |
| Rutas relativas en el backend y alias solo en el frontend | El backend es CommonJS y sus rutas son cortas | — |

## 6. Responsabilidades y asignación

Son **tres integrantes para cuatro instituciones**: el propietario del proyecto (integrante 2) tiene Pediatría, **Ely** el Hospital General y **Eddy** la Clínica Odontológica y el Laboratorio Clínico. Nada en el código depende de esa asignación: cada institución es una carpeta independiente.

**Asignación (responsables confirmados; motores por confirmar; editar aquí, es el único lugar):**

| Institución | Carpeta | Identificador | Motor | Responsable | Estado |
|---|---|---|---|---|---|
| Centro Médico Pediátrico | `instituciones/pediatria` | `centro_pediatrico` | MongoDB | Propietario del proyecto (integrante 2) | Implementado |
| Hospital General | `instituciones/hospital` | `hospital_general` | Por confirmar | Ely | Pendiente de integrar |
| Clínica Odontológica | `instituciones/odontologia` | `clinica_odontologica` | Por confirmar | Eddy | Pendiente de integrar |
| Laboratorio Clínico | `instituciones/laboratorio` | `laboratorio_clinico` | Por confirmar | Eddy | Pendiente de integrar |

El enunciado exige **un motor distinto por institución**; la Fase I tiene inconsistencias sobre la asignación (guía de integración §1 y matriz de requisitos de Pediatría, P-03). Confírmenla antes de iniciar los backends.

**Tareas compartidas** (las hace quien las necesite, avisando, y con revisión de otro integrante): `apps/web/**`, `tests/` de plataforma, `docs/` generales, `package.json` y lockfiles, `.gitignore`, la línea de cada institución en `registro.js` y la composición del servidor.

## 7. Cómo trabaja cada integrante

**Integrante 2 (Pediatría):** trabaja solo en `instituciones/pediatria/`. Ejecuta `npm run test:pediatria` y `npm run test:e2e`. Opera MongoDB con `npm run db:*` y mantiene `respaldos/mongodb/`. Atiende pedidos de los compañeros sobre el servidor común mientras se aloje en su backend (§5).

**Responsable de una institución pendiente (Ely en Hospital; Eddy en Odontología y Laboratorio):**

1. **Frontend:** completa `instituciones/hospital/frontend/` siguiendo [`FRONTEND_EQUIPO.md`](FRONTEND_EQUIPO.md) §4–§7 y lo revisa en `npm run web:dev` → `http://localhost:5173/vista-previa/hospital_general`, sin backend.
2. **Backend:** crea `instituciones/hospital/backend/` **cuando empiece a escribirlo** (no antes), con su router que atienda `GET /api/sesion`, sus puertos, su adaptador y su tabla de permisos (guía de integración §6). Sus variables van en `.env.example` con prefijo propio (`HOSPITAL_…`) y sin valores reales.
3. **Pruebas:** en `instituciones/hospital/tests/`, contra un doble de sus puertos y una base **desechable** de su motor. Se agrega a `package.json` un comando `test:hospital` y se incluye en `npm test` (cambio compartido, avisando).
4. **Documentación:** su modelo, consistencia, seguridad y justificación del motor en `instituciones/hospital/docs/`; su `README.md` al día.
5. **Integración:** registra su router en la composición del servidor y su módulo en `apps/web/src/plataforma/modulos/registro.js` (guía §6.2 y `FRONTEND_EQUIPO.md` §7), con `npm run test:todo` en verde.

**Un integrante con dos instituciones** repite el mismo flujo en cada carpeta, sin compartir código entre ellas: lo común se propone para `apps/web/src/plataforma/`.

**Reglas de convivencia:**

- Dentro de su carpeta de institución, cada uno trabaja libremente; fuera de ella, avisa antes de cambiar.
- Nadie modifica la carpeta de otra institución; los pedidos se hacen a su responsable.
- Antes de compartir cambios: `npm test` y `npm run build`; si se tocó algo compartido, `npm run test:todo`.
- El proyecto está en Git (repositorio privado `red-historiales-clinicos`): una rama por tarea, pull request hacia `main` y revisión cruzada de lo compartido (README §7).

## 8. Validar la estructura

```powershell
npm test                      # 134 pruebas (plataforma 30 + Pediatría 104), incluye aislamiento entre instituciones
npm run build                 # la aplicación compila con los módulos de instituciones/
npm run test:e2e              # Pediatría completa en navegador
npm run test:e2e:vista-previa # módulos pendientes en navegador (desarrollo)
```

La reorganización del 25/10/2026 (de `frontend/`, `src/`, `scripts/`, `mongodb/` y `tests/` en la raíz a esta estructura) se hizo por etapas validadas con estos comandos. El estado anterior se conserva en `respaldos/antes-monorepo-2026-10-25/`.
