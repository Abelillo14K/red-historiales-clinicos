# Guía del equipo — Red de Historiales Clínicos

Guía única para trabajar en el proyecto: estructura, responsables, contratos comunes y pasos para conectar cada institución. La instalación y los comandos están en el [README](../README.md); el sistema visual, en [`DISENO.md`](DISENO.md).

## Índice

1. [Estado y responsables](#1-estado-y-responsables)
2. [Estructura del repositorio](#2-estructura-del-repositorio)
3. [Contrato de sesión](#3-contrato-de-sesión)
4. [Contrato HTTP y errores](#4-contrato-http-y-errores)
5. [Operaciones comunes y extensiones](#5-operaciones-comunes-y-extensiones)
6. [Backend de una institución](#6-backend-de-una-institución)
7. [Frontend de una institución](#7-frontend-de-una-institución)
8. [Componentes compartidos](#8-componentes-compartidos)
9. [Permisos](#9-permisos)
10. [Verificación y problemas frecuentes](#10-verificación-y-problemas-frecuentes)
11. [Forma de trabajo](#11-forma-de-trabajo)

---

## 1. Estado y responsables

| Institución | Carpeta | Identificador (claim `institucion`) | Motor | Responsable | Estado |
|---|---|---|---|---|---|
| Centro Médico Pediátrico | `instituciones/pediatria` | `centro_pediatrico` | MongoDB | Abel (propietario) | Implementado |
| Hospital General | `instituciones/hospital` | `hospital_general` | MySQL | Ely | Frontend en vista previa; backend pendiente |
| Clínica Odontológica | `instituciones/odontologia` | `clinica_odontologica` | Firebase (Cloud Firestore) | Eddy | Implementado |
| Laboratorio Clínico | `instituciones/laboratorio` | `laboratorio_clinico` | PostgreSQL | Eddy | Implementado |

El enunciado exige cuatro motores distintos (PostgreSQL, MySQL, MongoDB, Firebase). La Fase I asignaba MySQL a Odontología y no asignaba Firebase; el equipo la ajustó a la asignación de esta tabla, que es el único lugar donde se registra.

## 2. Estructura del repositorio

```
apps/web/                  ÚNICA aplicación web (React + Vite), compartida
  src/plataforma/          sesión, permisos, cliente HTTP, contrato y registro de módulos,
                           layout, componentes, tema, portal y vista previa (solo desarrollo)
  alias.js                 alias @plataforma y @instituciones (un solo lugar)
instituciones/<x>/
  frontend/                módulo React: presentacion.js, modulo.js, api.js, paginas/, componentes/
  backend/ tests/ docs/    solo cuando existen (hoy: Pediatría, Laboratorio y Odontología)
  README.md                estado y pendientes de la institución
tests/                     pruebas de la plataforma (contrato de módulos, portal, cliente, proxy, vista previa)
docs/                      esta guía y el sistema visual
package.json (raíz)        dependencias del backend y de las pruebas; todos los comandos npm
```

| Ruta | Quién la modifica |
|---|---|
| `instituciones/<x>/**` | Libremente su responsable. Nadie modifica la carpeta de otra institución |
| `apps/web/src/plataforma/modulos/registro.js` | Una línea por institución, al conectarla, avisando al equipo |
| Resto de `apps/web/**`, `tests/`, `docs/`, `package.json` y lockfiles | Cambios compartidos: se avisan al equipo porque afectan a las cuatro instituciones. Mejor agregar que cambiar comportamiento existente |

**Reglas técnicas** (las comprueba `tests/frontend-equipo.test.js`):
- Un módulo importa archivos de su carpeta con rutas relativas, la plataforma con `@plataforma/...`, y React o React Router. **Nunca** archivos de otra institución; lo común se propone para `apps/web/src/plataforma/`.
- Las instituciones no tienen `package.json`: el frontend usa las dependencias de `apps/web` y el backend las de la raíz. Para agregar una dependencia: `npm install <paquete>` (backend) o `npm --prefix apps/web install <paquete>` (frontend), avisando, porque modifica un lockfile compartido.
- El backend de Pediatría **aloja hoy el servidor común**: sirve `apps/web/dist`, monta el enrutador por institución y valida el JWT. Las demás instituciones se montan ahí con la opción `instituciones` de `crearApp` (§6). Si el servidor crece, el equipo puede extraer esa capa (por ejemplo, a `apps/api/`).

## 3. Contrato de sesión

**El backend es la única autoridad.** El navegador nunca elige la institución ni el motor, ni decodifica el token para decidir permisos.

### 3.1 Token (JWT)

| Claim | Valor | Validación (ver `instituciones/pediatria/backend/security.js`) |
|---|---|---|
| `alg` | `HS256` | Se rechaza `none` y cualquier otro algoritmo |
| `iss` / `aud` | `JWT_ISSUER` / `JWT_AUDIENCE` | Deben coincidir (mismos valores en todos los servicios) |
| `sub` | identificador del usuario (≤ 80 caracteres) | Obligatorio |
| `rol` | rol propio de la institución | Debe existir en su tabla de permisos |
| `institucion` | identificador de la institución (§1) | Decide el módulo y, con él, el motor |
| `exp` | expiración | **Obligatoria**; vencido → `401 TOKEN_EXPIRADO` |

El token viaja en `Authorization: Bearer <JWT>`. El frontend lo guarda en `sessionStorage` y nunca guarda credenciales de bases de datos.

### 3.2 `GET /api/sesion` (obligatorio en cada institución)

```json
{
  "usuario": "USUARIO-DEMO", "rol": "medico",
  "institucion": "centro_pediatrico", "institucion_nombre": "Centro Médico Pediátrico", "motor": "MongoDB",
  "permisos": ["panel.ver", "pacientes.listar", "historial.leer", "clinico.escribir"],
  "expira": "2026-10-24T07:56:21.000Z",
  "capacidades": { "perimetro_cefalico_opcional": true }
}
```

- `institucion`: el frontend carga **solo** el módulo con ese identificador.
- `permisos`: qué secciones se muestran. Si falta, la interfaz no muestra ninguna (`sesion_incompleta`).
- `motor`: solo informativo; **la interfaz no lo muestra**, porque no debe cambiar según el motor.
- `expira`: la interfaz cierra la sesión al vencer. `capacidades`: extensiones opcionales de cada institución.

### 3.3 Obtención del token

- **Inicio de sesión común (pendiente del equipo):** debe redirigir a `https://<host>/#access_token=<JWT>`. La interfaz lee el fragmento, lo borra de la URL y llama a `/api/sesion`.
- **Inicio de sesión actual:** `POST /auth/login` con `{ usuario, contrasena }`, contra la colección `usuarios` de la institución que atiende este backend. Devuelve el JWT de la sesión; el usuario nunca lo ve ni lo escribe.
- **Laboratorio y Clínica Odontológica (temporal):** todavía no tienen inicio de sesión con contraseña. Se entra generando un JWT con `npm run lab:token -- <rol> <usuario>` o `npm run odonto:token -- <rol> <usuario>` y abriendo `http://localhost:3001/#access_token=<JWT>`.
- **Varias instituciones por usuario (no implementado):** el backend tendría que informar las instituciones autorizadas y emitir un token por institución. El frontend solo cambiaría `sesionAutorizaA()` en `plataforma/portal/portal.js`.

## 4. Contrato HTTP y errores

- JSON en ambos sentidos, fechas ISO 8601 en UTC, `Cache-Control: no-store` en `/api` y `/auth`.
- Listados paginados: `?q=&limite=&pagina=` → `{ "items": [...], "total": n }`.
- Identificadores en la ruta: `^[A-Za-z0-9_-]{1,40}$` (otro formato → `400 VALIDACION`).
- Cada ruta vuelve a autorizar en el servidor: ocultar un botón no es seguridad.

### 4.1 Formato de error (obligatorio)

```json
{ "error": "Mensaje legible en español", "codigo": "CODIGO_ESTABLE", "detalles": [{ "campo": "tutores.0.dpi", "mensaje": "Obligatorio" }] }
```

`detalles` aparece solo en errores de validación. Nunca incluya trazas, consultas ni datos clínicos.

| Situación | Estado | `codigo` |
|---|---|---|
| Datos inválidos (esquema, JSON malformado, id en la ruta) | 400 | `VALIDACION` |
| Regla de negocio incumplida | 400 | `REGLA_NEGOCIO` |
| Sin token · token alterado o ajeno · sesión expirada | 401 | `NO_AUTENTICADO` · `TOKEN_INVALIDO` · `TOKEN_EXPIRADO` |
| Usuario o contraseña incorrectos | 401 | `CREDENCIALES_INVALIDAS` |
| Rol sin permiso | 403 | `ROL_SIN_PERMISO` |
| Institución no registrada en el servidor · token de otra institución en un módulo | 403 | `INSTITUCION_NO_REGISTRADA` · `INSTITUCION_NO_AUTORIZADA` |
| Acceso prohibido por regla (p. ej., historial archivado) | 403 | `PROHIBIDO` |
| Recurso inexistente · ruta inexistente | 404 | `NO_ENCONTRADO` · `RUTA_NO_ENCONTRADA` |
| Conflicto (duplicado, dosis ya aplicada, archivado) | 409 | `CONFLICTO` |
| Cuerpo demasiado grande | 413 | `SOLICITUD_DEMASIADO_GRANDE` |
| Referencia inexistente (médico, vacuna) · rechazo del motor (validador, CHECK) | 422 | `REFERENCIA_INVALIDA` · `VALIDACION_MOTOR` |
| El motor de la institución no responde (las demás siguen funcionando) | 503 | `MOTOR_NO_DISPONIBLE` |
| Demasiadas solicitudes | 429 | `DEMASIADAS_SOLICITUDES` |
| No se pudo registrar el acceso · autenticación sin configurar | 503 | `AUDITORIA_NO_DISPONIBLE` · `AUTENTICACION_NO_DISPONIBLE` |
| Error interno | 500 | `ERROR_INTERNO` (mensaje genérico) |

Pediatría cumple esta tabla (prueba «toda respuesta de error trae { error, codigo } estable»). El cliente común (`apps/web/src/plataforma/api/http.js`) convierte cualquier error en `ApiError { status, codigo, detalles }`, cierra la sesión ante un `401` y muestra `403` como «Acceso restringido».

## 5. Operaciones comunes y extensiones

Las reglas de negocio del enunciado (registrar consulta, agregar diagnóstico, recetar) son comunes, pero **cada institución conserva su propio modelo de persistencia**. El contrato común está en la frontera HTTP, no en la base de datos.

### 5.1 Rutas sugeridas

| Operación | Ruta | Datos comunes mínimos | Pediatría |
|---|---|---|---|
| Listar / buscar pacientes | `GET /api/pacientes?q=&estado=&limite=&pagina=` | `{ items: [{ id_paciente, nombres, apellidos, fecha_nacimiento, sexo, estado_historial }], total }` | ✔ (además filtro por `sexo`) |
| Registrar paciente | `POST /api/pacientes` | `nombres, apellidos, fecha_nacimiento, sexo` → `201 { id_paciente }` | ✔ exige `tutores[]` |
| Obtener expediente | `GET /api/pacientes/:id` | datos generales + `estado_historial` | ✔ |
| Registrar consulta | `POST /api/pacientes/:id/consultas` | `id_medico, fecha_hora, motivo, observaciones?` → `201 { id_consulta }` | ✔ admite diagnósticos, tratamiento, receta y control en la misma operación |
| Agregar diagnóstico | `POST …/consultas/:c/diagnosticos` | `{ codigo, descripcion }` | ✔ |
| Establecer tratamiento | `PUT …/consultas/:c/tratamiento` | `{ descripcion, recomendaciones? }` | ✔ conserva versiones |
| Recetar | `POST …/consultas/:c/prescripciones` | `{ indicaciones_generales?, medicamentos: [{ nombre, dosis, frecuencia, duracion, via_administracion }] }` | ✔ |
| Historial de medicamentos | `GET /api/pacientes/:id/prescripciones` | lista plana, más reciente primero | ✔ |
| Archivar | `PATCH /api/pacientes/:id/archivar` | `{ motivo_archivado }`; queda de solo lectura | ✔ |
| Auditoría | `GET /api/auditoria?id_paciente=&accion=&limite=` | eventos con actor, acción, fecha y resultado | ✔ |

### 5.2 Extensiones

Cada institución mantiene sus extensiones, con el prefijo de la institución en las rutas y permisos exclusivos (`/api/odontograma/...`, `odontologia.odontograma.editar`). Ejemplos:
- **Pediatría:** tutores, crecimiento, vacunación y DPI enmascarado.
- **Hospital:** citas, hospitalización, signos vitales y alergias.
- **Odontología:** piezas dentales y agenda.
- **Laboratorio:** solicitudes y resultados con estructura variable.

No se cambian los endpoints de Pediatría para «igualarlos». Si una vista necesita otro formato, se adapta en el `api.js` del módulo. Diferencias de Pediatría:
- El paciente se identifica con `id_paciente` (`P001`); el DPI pertenece al tutor.
- El registro exige tutores.
- `GET /api/pacientes/:id` solo con `historial.leer`; para los datos generales se usa `…/administrativo`.

## 6. Backend de una institución

```
petición /api/* ─▶ crearEnrutadorInstituciones (valida el JWT una vez)
                    └─▶ módulos[payload.institucion].router ─▶ casos de uso ─▶ puertos ─▶ adaptador de SU motor
```

1. **Carpeta propia**, creada al empezar a escribirla: `instituciones/<x>/backend/` (dominio, aplicación, puertos, adaptador del motor, rutas, permisos y conexión) y `instituciones/<x>/tests/`. No importe nada del adaptador MongoDB de Pediatría.
2. **Arquitectura hexagonal:** los casos de uso dependen de sus puertos; el adaptador los implementa con su motor (`pg`, `mysql2`, `firebase-admin`…). La consistencia la decide cada motor: transacciones en SQL; transacciones o lotes en Firebase.
3. **Conexión propia:** variables con prefijo (`HOSPITAL_DB_URL`…) documentadas en `.env.example`, sin valores reales. Nunca reutilice la conexión ni el usuario de MongoDB.
4. **Router** `crearRouter<Institucion>(servicios)`, que debe:
   - exigir su propia institución;
   - atender `GET /sesion` (§3.2);
   - autorizar cada ruta con su tabla de permisos;
   - responder los errores con el formato §4.1;
   - si su motor no está disponible, responder 503 sin afectar a las demás instituciones.
5. **Registro:** un `backend/index.js` que compone su conexión, adaptador, casos de uso y router, y unas líneas en `instituciones/pediatria/backend/server.js` que lo pasan a `crearApp(servicios, { instituciones })` solo si su variable de conexión existe. Hasta entonces, un token de esa institución recibe `403 INSTITUCION_NO_REGISTRADA`. Ejemplos reales: el Laboratorio y la Clínica Odontológica.
   ```js
   const laboratorio = process.env.LABORATORIO_DB_URL ? await crearModuloLaboratorio() : null;
   const instituciones = laboratorio ? { [laboratorio.institucion]: laboratorio } : {};   // { nombre, motor, router }
   const app = crearApp(crearServicios(repos), { instituciones });
   ```
6. **Pruebas:** un comando `test:<x>` en `package.json`, incluido en `npm test`, con un doble de sus puertos (como `instituciones/pediatria/tests/doubles/memoria.js`) y una base **desechable** de su motor.
7. **Documentación** en `instituciones/<x>/docs/`: modelo, consistencia, seguridad y justificación del motor. Es su parte del documento comparativo.

## 7. Frontend de una institución

Cada módulo pendiente ya tiene `presentacion.js`, `modulo.js`, `api.js` (sin operaciones), `paginas/` y `componentes/`. Se revisa sin backend con `npm run web:dev` → `http://localhost:5173/vista-previa/<identificador>`.

### 7.1 Manifiesto (`modulo.js`, sin JSX)

| Campo | Obligatorio | Descripción |
|---|---|---|
| `contrato` | sí | `1` |
| `institucion` | sí | **igual** al claim del JWT y a la clave del enrutador del backend |
| `nombre`, `sigla`, `descripcion`, icono | `nombre` | se toman de `presentacion.js` (también los usa el portal) |
| `roles` | sí | `{ clave: etiqueta }`; vacío hasta que su backend defina los roles |
| `crearApi(http)` | sí | operaciones del módulo sobre el cliente común |
| `rutas` | sí | `[{ path, titulo?, permiso?, cargar: () => import('./paginas/X.jsx') }]`, relativas, con una de inicio `''`; las fijas antes que las de parámetros |
| `navegacion` | no | `[{ to, etiqueta, icono, permiso?, grupo?, exacto? }]` |
| `accionRapida` | no | `{ to, etiqueta, permiso }` |

`validarModulo` rechaza rutas absolutas o duplicadas, navegación hacia rutas inexistentes, permisos mal formados y la falta de inicio.

### 7.2 Páginas

- Use `useModulo()` (`{ modulo, api, puede, enlace, vistaPrevia }`) en lugar de `useSesion()`. Los enlaces internos se arman con `enlace('/ruta')`, que funciona igual en la aplicación y en la vista previa.
- Use los componentes compartidos (§8): un solo `h1` (`PageHeader`), campos con `FormField`, solo tokens `--color-*` y nunca el motor en pantalla.
- Los componentes propios van en `componentes/`; si sirven a varias instituciones, se proponen para `apps/web/src/plataforma/ui/`.

### 7.3 Conectar la API real

```js
// instituciones/<x>/frontend/api.js — solo operaciones que su backend ya atiende
import { seg } from '@plataforma/api/http.js';
export function crearApiHospital({ get, post, put, patch }) {
  const P = id => `/api/pacientes/${seg(id)}`;
  return { pacientes: { listar: p => get('/api/pacientes', p), crear: d => post('/api/pacientes', d), obtener: id => get(P(id)) } };
}
```

```jsx
const { api } = useModulo();
const { datos, cargando, error, recargar } = useCarga(() => api.pacientes.listar({ limite: 20, pagina }), [api, pagina]);
const envio = useEnvio();
const r = await envio.enviar(() => api.pacientes.crear(datos));   // notificar solo después de la respuesta
```

El cliente común agrega el token, cierra la sesión ante `401` y entrega los errores de validación en `error.detalles`. Si la respuesta de su backend difiere de la ruta sugerida, adáptela en `api.js`, no en la plataforma.

### 7.4 De pendiente a conectado

1. Backend que atiende `GET /api/sesion` y sus rutas, registrado en el servidor (§6).
2. `modulo.js` con `roles` reales y los mismos permisos que su backend.
3. `api.js` con las operaciones reales.
4. Páginas sin `PendienteIntegracion`, `TablaPendiente` ni `FormularioVistaPrevia`: datos con `useCarga`, `DataTable` y `Pager`; formularios con `useEnvio`; expediente con el paciente real en lugar de `ID_VISTA_PREVIA`.
5. Una línea en `apps/web/src/plataforma/modulos/registro.js`.
6. Pruebas del manifiesto en `tests/frontend-modulos.test.js`. `tests/frontend-equipo.test.js` deja de aplicarle automáticamente las restricciones de «pendiente».
7. `npm test`, `npm run build`, `npm run test:e2e` y `npm run test:e2e:vista-previa` en verde; el `README.md` de su institución y la tabla §1, actualizados.

Al registrarse, el módulo sale de la vista previa y en el portal pasa a «Disponible» para su institución.

**Garantías de la vista previa** (comprobadas por las pruebas):
- Solo existe con `vite` (desarrollo) y solo desde el propio equipo; la compilación de producción no contiene ni la vista previa ni los módulos no registrados.
- No usa ni modifica la sesión, no construye la API (`api = null`) y deja los formularios deshabilitados.
- Muestra todas las secciones sin aplicar permisos y no tiene datos.

## 8. Componentes compartidos

Se importan desde `@plataforma/ui/index.js`.

| Componente | Uso |
|---|---|
| `PageHeader` · `Card` · `SectionIntro` · `MetricStrip` · `ContextPanel` | estructura de página (un solo `h1`), secciones, indicadores y contexto |
| `StatCard` | indicador con su explicación; sin backend, `valor="—"` (nunca un número inventado) |
| `DataTable` · `Pager` | tabla accesible (fichas en móvil) y paginación |
| `SearchBar` · `FilterBar` · `FormField` · `BotonEnviar` · `FormSteps` · `FormSummary` | búsqueda, filtros y formularios |
| `Tabs` · `KeyValue` · `StatusBadge` | pestañas con teclado, pares dato–valor y estados |
| `Dialogo` · `useConfirmar` · `useNotificar` | modales, confirmaciones y notificaciones |
| `LoadingState` · `EmptyState` · `ErrorState` · `Alerta` | carga, vacío y error (incluida la caída del servidor) |
| `useCarga` · `useEnvio` | carga con recarga y envío sin doble clic |
| `PendienteIntegracion` · `TablaPendiente` · `FormularioVistaPrevia` | módulos pendientes |
| `Icon` | iconos de trazo propios |

## 9. Permisos

Cada institución asigna **sus** roles a estos permisos comunes; la misma tabla autoriza sus rutas y se entrega en `/api/sesion` (Pediatría: `instituciones/pediatria/backend/permisos.js`).

| Permiso | Significado |
|---|---|
| `panel.ver` | Panel principal |
| `pacientes.listar` · `pacientes.ver_administrativo` | Buscar pacientes y ver datos generales |
| `pacientes.registrar` · `pacientes.editar` | Alta y edición administrativa |
| `historial.leer` | Información clínica de historiales activos |
| `historial.leer_archivados` · `historial.archivar` | Archivados y archivo lógico |
| `clinico.escribir` | Consultas, diagnósticos, tratamientos y recetas |
| `catalogos.ver` · `catalogos.editar` | Catálogos de la institución |
| `auditoria.leer` | Bitácora |

Formato `recurso.accion` en minúsculas. Los permisos exclusivos llevan el prefijo de la institución. Confirmados por el backend del Laboratorio: `laboratorio.solicitudes.ver`, `laboratorio.solicitudes.crear`, `laboratorio.resultados.ver`, `laboratorio.resultados.registrar` y `laboratorio.resultados.validar`. Confirmados por el backend de la Clínica Odontológica: `odontologia.citas.ver` y `odontologia.citas.gestionar`. Propuestos en el manifiesto del Hospital, a confirmar por su backend: `hospital.citas.ver` y `hospital.hospitalizacion.ver`. Replique `instituciones/pediatria/tests/permisos.test.js`: cada permiso anunciado debe coincidir con la autorización real.

## 10. Verificación y problemas frecuentes

Con un token de su institución, `GET /api/sesion` responde el contrato §3.2; con el de otra institución, 403. Antes de integrar: `npm test` y `npm run build`, y además los dos E2E si tocó algo compartido.

| Síntoma | Causa probable |
|---|---|
| «Institución no disponible en esta interfaz» | El backend aceptó el token, pero `registro.js` no tiene ese módulo |
| `403 INSTITUCION_NO_REGISTRADA` | Falta registrar su router en `crearEnrutadorInstituciones` |
| `401 TOKEN_INVALIDO` con un token recién emitido | `JWT_SECRET`, `JWT_ISSUER` o `JWT_AUDIENCE` distintos entre servicios |
| La interfaz no muestra ninguna sección | `/api/sesion` no devuelve `permisos` |
| `npm test` falla en el contrato | Ruta absoluta o duplicada, falta la ruta `''`, navegación hacia una ruta inexistente o permiso sin punto |
| Un botón visible devuelve 403 | La navegación usa un permiso distinto del que exige el backend |
| Colores incorrectos en tema oscuro | Colores fijos en lugar de tokens `--color-*` |
| CORS bloqueado con el frontend en otro origen | Configure `CORS_ORIGIN` |

## 11. Forma de trabajo

- Cada integrante trabaja en su carpeta y verifica con `npm test` y `npm run build` (y los E2E si tocó algo compartido) antes de integrar.
- **Ramas y pull requests cuando sean útiles** (cambios grandes o compartidos): `git switch -c <institucion>/<tema>`, push y PR hacia `main`. No se exige aprobación de otro integrante; quien integra es responsable de haber verificado.
- `main` está protegida: no admite force-push ni eliminación.
- Las credenciales (`.env`), respaldos y volcados de bases de datos nunca se suben al repositorio.
