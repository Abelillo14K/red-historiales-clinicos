# Centro Médico Pediátrico · MongoDB (Integrante 2)

Institución **implementada** de la *Red de Historiales Clínicos*: historiales clínicos pediátricos sobre la base documental **`centro_pediatrico_db`** (MongoDB 9.0, servidor standalone). Incluye su backend (Node.js + Express, arquitectura hexagonal), su módulo React (cargado por la aplicación común `apps/web`), sus scripts de operación de MongoDB, sus pruebas y su documentación.

Instalación, comandos y estructura general del repositorio: [README principal](../../README.md). Todos los datos son **ficticios** y el sistema **no genera indicaciones clínicas**.

## 1. Contenido de esta carpeta

```
instituciones/pediatria/
├── backend/           API: dominio, casos de uso, puertos, adaptador MongoDB, rutas, seguridad JWT,
│                      permisos y composición del servidor (server.js, app.js)
├── frontend/          módulo React: modulo.js (manifiesto), api.js, paginas/, componentes/
├── scripts/           índices, validadores, diagnóstico, respaldo y restauración aislada, token de desarrollo
├── mongodb/           scripts mongosh históricos (bloqueados para no ejecutarse por accidente)
├── tests/             pruebas del backend, integración con mongod desechable y E2E de la interfaz
│   ├── doubles/       doble en memoria de los puertos
│   ├── soporte/       mongod desechable y copia del validador instalado
│   └── e2e/           flujo completo en navegador (capturas en e2e/capturas/, ignoradas por Git)
└── docs/              modelo, operación de MongoDB, respaldo, trazabilidad, demostración, informe, capturas e histórico
```

> **Servidor común.** Mientras Pediatría sea el único backend, `backend/server.js` también sirve la aplicación web compilada (`apps/web/dist`) y aloja el enrutador por institución (`backend/api/enrutadorInstituciones.js`) y la validación de JWT (`backend/security.js`). Cuando exista el segundo backend, el equipo decidirá cómo compartir esa capa (ver `docs/ARQUITECTURA.md` §5).

| Documento | Contenido |
|---|---|
| [`docs/MODELO_Y_DECISIONES.md`](docs/MODELO_Y_DECISIONES.md) | Modelo documental, embebido/referenciado, índices, reglas de negocio, consistencia y seguridad |
| [`docs/OPERACION_MONGODB.md`](docs/OPERACION_MONGODB.md) | Validadores (verificar, respaldar, aplicar, revertir), base de pruebas, outbox, plan de replica set |
| [`docs/RESPALDO_Y_RESTAURACION.md`](docs/RESPALDO_Y_RESTAURACION.md) | Respaldo BSON con mongodump, restauración verificada en una instancia aislada, salvaguardas |
| [`docs/TRAZABILIDAD_REQUISITOS.md`](docs/TRAZABILIDAD_REQUISITOS.md) | Matriz de requisitos del enunciado y de la Fase I |
| [`docs/DEMOSTRACION.md`](docs/DEMOSTRACION.md) | Guion para presentar al profesor |
| `docs/Informe_Fase2_Centro_Pediatrico.pdf` | Informe técnico completo |
| [`docs/capturas/`](docs/capturas) | Capturas de la interfaz con datos ficticios (claro/oscuro, escritorio, tablet y móvil) |
| `docs/historico/` | Instrucciones de etapas anteriores (no ejecutar) |

## 2. Comandos de Pediatría (desde la raíz)

```powershell
npm start · npm run dev              # servidor (API + aplicación compilada) en http://localhost:3001
npm run test:pediatria               # pruebas de backend e integración con MongoDB desechable
npm run test:e2e                     # compila y recorre la interfaz en Edge/Chrome con MongoDB desechable
npm run db:diagnostico               # solo lectura: colecciones, documentos, índices y validadores
npm run db:validadores               # solo lectura: documentos frente a los validadores de Fase II
npm run db:indices                   # crea índices que falten (idempotente, no borra)
npm run db:respaldo                  # respaldo BSON en respaldos/mongodb/<fecha>/ (raíz del repositorio)
npm run db:restaurar-aislado -- <carpeta>   # restaura en un mongod temporal y compara
npm run token:dev -- <rol> <usuario>        # JWT de desarrollo
```

Ninguna prueba toca `centro_pediatrico_db`: las de integración y de interfaz inician un proceso `mongod` propio (puerto libre, carpeta temporal, solo `127.0.0.1`) con `tests/soporte/mongodTemporal.js` y lo eliminan al terminar.

## 3. Pruebas de la institución

| Archivo | Qué prueba |
|---|---|
| `tests/api.test.js` | Pacientes, tutores, consultas, diagnósticos, prescripciones, crecimiento, vacunación (doble aplicación simultánea), archivado, permisos, auditoría y **contrato de errores común** (`{ error, codigo }`) |
| `tests/seguridad.test.js` | JWT (`alg: none`, sin `exp`, emisor/audiencia ajenos, token alterado), DPI enmascarado, búsqueda por DPI, rutas clínicas para secretaría, parámetros malformados, perímetro opcional/obligatorio, historial de tratamientos, entrega de eventos pendientes |
| `tests/enrutamiento.test.js` | Despacho por institución, motor en la sesión, consultas por rango de fechas |
| `tests/permisos.test.js` | La sesión informa institución y permisos; cada permiso anunciado coincide con la autorización real de las rutas (12 permisos × 3 roles) |
| `tests/mongo.integration.test.js` | **MongoDB real**: validador instalado y de Fase II (respaldo, aplicación, reversión), rechazo de escrituras directas inválidas, flujo clínico completo, datos heredados, outbox con bitácora caída, archivado; transacciones reales en replica set |
| `tests/dominio.test.js`, `tests/schema.test.js` | Reglas de dominio, contratos de puertos y esquemas Zod |
| `tests/hallazgos-auditoria.test.js` | Regresión de los cinco hallazgos de la auditoría técnica: `/auth/dev-login` solo local, altas concurrentes del mismo paciente, fecha de nacimiento frente a la vacunación registrada, regla temporal de prescripciones y auditoría de altas de catálogo |
| `tests/e2e/flujo-ui.e2e.js` | Interfaz real: inicio de sesión, panel, búsqueda, registro, edición, consulta, diagnóstico, tratamiento, receta, crecimiento y gráficas, vacunación, archivado, auditoría, permisos (también rechazo directo del backend), migas de pan, institución, motor oculto, persistencia en MongoDB, tema claro predeterminado, oscuro y según el sistema (persistentes y sin parpadeo), teclado y foco visible, menú contraído, menú de usuario con teclado y dentro de la ventana, panel de seis indicadores según el ancho, escritorio 1920 px, portátil 1366 px, tablet 820 px y móvil 390 px (claro y oscuro) sin desbordes, caída de la API, accesibilidad básica y **contraste WCAG AA medido** en claro y oscuro. Capturas comparativas en `tests/e2e/capturas/` |

## 4. Arquitectura hexagonal

```
React ──HTTP──▶ api/ (rutas, Zod, enrutador por institución) ──▶ application/ (casos de uso) ──▶ ports/ ◀── adapters/mongo
                                                                        │                         ◀── instituciones/pediatria/tests/doubles/memoria
                                                                        └──▶ domain/ (reglas)
```
Los casos de uso solo conocen los puertos. El mismo conjunto de casos de uso funciona con el adaptador MongoDB y con el doble en memoria (`verificarRepositorios` comprueba el contrato). Otro motor solo necesitaría un adaptador que cumpla los mismos puertos.

## 5. API REST

Todas las rutas `/api/*` requieren `Authorization: Bearer <JWT>`. **M** = médico, **S** = secretaría, **A** = administrador.

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/salud` | público | Estado de la API |
| GET | `/auth/config` | público | Indica si el acceso de desarrollo está habilitado |
| POST | `/auth/dev-login` | público (solo desarrollo) | Emite un JWT de desarrollo `{rol, usuario}` |
| GET | `/api/sesion` | M S A | Usuario, rol, institución, motor, expiración y `capacidades` |
| GET | `/api/panel` | M S A | Contadores (S solo ve pacientes; dosis pendientes solo de historiales activos), consultas recientes, próximas dosis |
| GET | `/api/pacientes?q=&estado=&sexo=&limite=&pagina=` | M S A | Listado y búsqueda (`Archivado`/`Todos` solo A; DPI solo S y A) |
| POST | `/api/pacientes` | S A | Registrar paciente con tutores (id automático `P###`) |
| GET | `/api/pacientes/:id` | M A | Historial completo (archivados solo A; DPI enmascarado para M) |
| GET | `/api/pacientes/:id/administrativo` | M S A | Datos generales y tutores, sin información clínica |
| PATCH | `/api/pacientes/:id` | S A | Actualizar nombres, apellidos, fecha de nacimiento o sexo |
| PATCH · POST · PUT | `/api/pacientes/:id/tutores[/:idTutor]` | S A | Reemplazar, agregar o actualizar tutores |
| PATCH | `/api/pacientes/:id/archivar` | A | Archivo lógico con motivo |
| GET | `/api/pacientes/:id/consultas?desde=&hasta=` | M A | Consultas con médico; rango ISO 8601 opcional |
| POST | `/api/pacientes/:id/consultas` | M | Consulta con diagnósticos, tratamiento, recetas y control opcional |
| POST | `/api/pacientes/:id/consultas/:c/diagnosticos` | M | Agregar diagnóstico |
| PUT | `/api/pacientes/:id/consultas/:c/tratamiento` | M | Agregar o actualizar tratamiento (conserva la versión anterior) |
| POST | `/api/pacientes/:id/consultas/:c/prescripciones` | M | Registrar prescripción |
| GET | `/api/pacientes/:id/prescripciones` · `/diagnosticos` | M A | Medicamentos y diagnósticos históricos |
| GET · POST | `/api/pacientes/:id/crecimiento` | M A · M | Controles cronológicos con `edad_meses` · registrar control |
| GET · POST | `/api/pacientes/:id/vacunacion?estado=` | M A · M | Esquema · programar dosis |
| PATCH | `/api/pacientes/:id/vacunacion/:e/aplicar` · `/cancelar` | M | Aplicar (fecha, lote, médico) o cancelar una dosis pendiente |
| GET | `/api/vacunacion/pendientes` | M A | Dosis pendientes de historiales activos |
| GET | `/api/medicos?especialidad=` · `/api/medicos/:id` · `/api/especialidades` · `/api/vacunas` | M S A | Catálogos |
| POST | `/api/medicos` · `/api/vacunas` | A | Altas de catálogo |
| GET | `/api/auditoria?id_paciente=&accion=&limite=` · `/api/auditoria/:id` | A | Bitácora |

Errores con el formato común `{ error, codigo, detalles? }` (tabla completa de códigos en [`docs/GUIA_INTEGRACION_EQUIPO.md`](../../docs/GUIA_INTEGRACION_EQUIPO.md) §4): `400` datos inválidos (con `detalles` por campo), `401` sin token, inválido o vencido, `403` rol sin permiso o institución no registrada, `404` inexistente, `409` duplicado, historial archivado o dosis no pendiente, `413` cuerpo mayor a 100 KB, `422` referencia inexistente o rechazo del validador de MongoDB.

## 6. Roles y permisos

La tabla rol → permisos está en `backend/permisos.js`: la usan las rutas para autorizar y `GET /api/sesion` la entrega al frontend, que solo decide qué mostrar.


| Operación | Médico | Secretaría | Administrador |
|---|:-:|:-:|:-:|
| Panel (contadores clínicos) | ✔ | solo pacientes | ✔ |
| Registrar paciente, editar datos y tutores | — | ✔ | ✔ |
| Ver datos generales y tutores | ✔ (DPI enmascarado) | ✔ | ✔ |
| Ver historial clínico | ✔ (activos) | — | ✔ (incluidos archivados) |
| Consultas, diagnósticos, tratamiento, recetas, crecimiento, vacunación | ✔ | — | solo lectura |
| Archivar historial | — | — | ✔ |
| Auditoría, historiales archivados, altas de catálogo | — | — | ✔ |

## 7. Seguridad y consistencia (resumen)

- **Entrada:** Zod estricto (rechaza campos desconocidos y operadores `$…`), límites de longitud y rango, parámetros de ruta con patrón, JSON de 100 KB como máximo. El mismo conjunto de reglas está en los validadores `$jsonSchema`.
- **Autenticación y autorización:** JWT HS256 (issuer, audience, expiración obligatoria, `institucion`); permisos por rol en cada ruta; enrutamiento por institución.
- **Datos personales:** DPI del tutor enmascarado para el médico; búsqueda por DPI solo para roles administrativos; datos clínicos nunca expuestos a secretaría.
- **Auditoría:** `bitacora_acceso` registra lecturas, escrituras, accesos denegados e inicios de sesión de desarrollo. En escrituras clínicas el evento se guarda **en el mismo `updateOne`** que el cambio (outbox) y se entrega de forma idempotente: no se pierde ni se duplica. Ver la limitación 1.
- **Consistencia:** cada operación clínica es un único `updateOne` condicional (p. ej., aplicar dosis exige `estado: 'Pendiente'` en el filtro); concurrencia optimista en tutores y tratamiento; referencias verificadas antes de escribir; índices únicos.
- **Secretos:** credenciales solo en `.env`; el navegador solo guarda el JWT en `sessionStorage`; errores 500 sin detalles internos.

## 8. Mejoras respecto a la Fase I

| Fase I | Fase II (implementado y probado) |
|---|---|
| 6 operaciones descritas | Todas en API e interfaz, más búsqueda, edición administrativa, tutores, programación y cancelación de dosis, filtro de consultas por fecha y panel |
| Consulta: fecha, médico, motivo, observaciones | **Extensión:** diagnósticos, tratamiento (con historial de versiones) y prescripciones con medicamentos |
| Archivar = cambiar estado | Además `fecha_archivado`, `motivo_archivado` (con la causa de baja) y `archivado_por`; historial de solo lectura |
| "Conservar quién actualiza" | `bitacora_acceso` con outbox atómico y trazas embebidas |
| Estados programada/pendiente/aplicada/omitida | `Pendiente`/`Aplicada`/`Cancelada` (Cancelada = omitida, como exige el validador instalado) |
| Perímetro cefálico "si corresponde" | Opcional en Zod, en la interfaz y en el validador de Fase II instalado; la API detecta el validador y lo pediría si se volviera a uno anterior |
| DPI del tutor restringido | Enmascarado para el médico y búsqueda solo para roles administrativos |

## 9. Limitaciones reales

1. **Sin transacciones multidocumento** (servidor standalone). La escritura clínica y su evento son atómicos dentro del documento del paciente, pero la copia a `bitacora_acceso` es posterior y puede retrasarse. Las lecturas, los accesos denegados y las altas de catálogo se auditan sin outbox. La ruta transaccional está **verificada con un replica set desechable**; migrar el servidor real requiere autorización (plan en `docs/OPERACION_MONGODB.md`).
2. **Validadores de Fase II:** aplicados por el administrador en `centro_pediatrico_db` (comprobado el 24/10/2026 con `npm run db:validadores`: las 4 colecciones tienen validador, el perímetro cefálico es opcional y 0 documentos incumplen). Si hubiera que revertirlos, el procedimiento está en `docs/OPERACION_MONGODB.md` §2.3 (requiere el respaldo creado al aplicarlos).
3. **Autenticación de desarrollo:** `/auth/dev-login` y `scripts/dev-token.js` no son un inicio de sesión real (sin contraseñas). `/auth/dev-login` solo responde a peticiones del propio equipo, también detrás de `vite --host`; desde otro dispositivo, un token generado con `npm run token:dev` se pega en «Usar un token institucional». El inicio de sesión común corresponde al equipo.
4. La unicidad de identificadores dentro de arreglos (consultas, controles, dosis) se garantiza con filtros condicionales por documento, no con índices.
5. Crecimiento del documento: el límite de 16 MiB se considera suficiente para el volumen pediátrico (análisis en `docs/MODELO_Y_DECISIONES.md`).
6. Los límites de peso, talla y perímetro son de captura (evitan errores de digitación), no criterios clínicos. El limitador de solicitudes funciona en memoria (un solo proceso).
7. Las gráficas de crecimiento representan solo las mediciones registradas; no son curvas de referencia clínica (OMS) ni calculan percentiles.
8. La interfaz se probó automáticamente en Edge (Chromium). No se probó en Firefox ni Safari, ni con lectores de pantalla reales; la auditoría de accesibilidad automática es básica (etiquetas, nombres accesibles, un `h1`, idioma, contraste).
9. Integración multiinstitución: el enrutador, el contrato de sesión, el contrato de módulos y el formato de errores están listos y probados con instituciones simuladas, pero ninguna otra institución está conectada y la asignación de motores del equipo no está confirmada (ver la matriz, P-03).
