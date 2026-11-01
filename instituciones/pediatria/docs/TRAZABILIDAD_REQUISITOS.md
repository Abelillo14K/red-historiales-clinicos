# Matriz de requisitos — Centro Médico Pediátrico (MongoDB)

Revisada el 31/10/2026 contra los documentos oficiales, leídos directamente, y contra el código de `main` (commit `cd34848`). Corrige la versión del 24/10/2026, que atribuía a Pediatría operaciones del catálogo del Hospital General (auditoría, defecto D-09).

| Clave | Documento | Páginas usadas (numeración física del PDF) |
|---|---|---|
| **[P]** | `Proyecto final bases II.pdf` (enunciado del profesor, 4 páginas) | p. 1: objetivo, arquitectura hexagonal, criterio de evaluación y contexto (Pediatría) · p. 1–2: restricciones de motores · p. 2–3: Entrega I · p. 3: Entrega II (instrucciones, motores, resultados: aplicación funcional, conexión cliente-servidor, modelado corregido) · p. 4: resto de resultados de la Entrega II |
| **[F1]** | `Documentacion fase 1 base de datos 2.pdf` (Fase I del grupo, 48 páginas), sección **Centro Médico Pediátrico** | p. 41 portada de sección · p. 42 motor y justificación · p. 43 entidades y atributos · p. 44 clasificación de la información · p. 45 modelo documental · p. 46 embebido/referenciado y operaciones · p. 47 operación de archivo, seguridad y diferencia con el modelo relacional · p. 48 conclusión |
| **[F1-H]** | Misma Fase I, sección **Hospital General** | p. 24–25 «8. Catálogo de operaciones» · p. 25 «9. Implementación en motor relacional» (MySQL). **No son requisitos de Pediatría**: solo se citan como origen de las extensiones de §3 y de la inconsistencia de motores |

**Estados.** **Cumplido**: implementado y verificado con la evidencia indicada. **Parcial**: existe una parte; se dice qué falta. **Adaptado**: implementado con un cambio justificado respecto a la Fase I. **No verificable**: falta información para comprobarlo. **Pendiente grupal**: no le corresponde al módulo individual. Algo que solo está *preparado* para la integración futura **no** se marca como cumplido.

**Responsable.** **Individual**: módulo Centro Médico Pediátrico con MongoDB. **Grupal**: otras instituciones, autenticación común definitiva, comparación conjunta.

**Evidencia.** **U** = pruebas con el doble en memoria · **I** = MongoDB real desechable (`mongo.integration.test.js`, `identificador-paciente.test.js`; standalone y replica set) · **E** = `npm run test:e2e` (Edge real + API + MongoDB desechable, 27 pasos) · **R** = verificación de solo lectura contra `centro_pediatrico_db` (31/10/2026: 4 colecciones con validador de Fase II idéntico al código y 0 documentos que lo incumplen). Verificación del 31/10/2026 sobre `cd34848`: **148/148 pruebas** (`npm test`: plataforma 30 + Pediatría 118), **27/27 pasos E2E** y **12/12 pasos de vista previa**. Las pruebas usan bases desechables o en memoria.

No se dispone de la retroalimentación escrita del profesor sobre la Entrega I ni de una rúbrica adicional.

## 1. Requisitos de la Entrega II [P]

| ID | Origen | Requisito | Estado | Implementación | Evidencia | Observaciones / acción necesaria | Responsable |
|---|---|---|---|---|---|---|---|
| P-01 | [P] p. 3 | Aplicación funcional y conexión cliente-servidor: el cliente consulta y administra el historial | **Cumplido** | API Express (`instituciones/pediatria/backend/app.js`) + módulo React (`instituciones/pediatria/frontend/`) en la aplicación común `apps/web`, servidos desde el mismo origen | E (27 pasos), U | — | Individual |
| P-02 | [P] p. 1 y 3 | Arquitectura hexagonal como punto de partida común | **Cumplido** (módulo) | `backend/domain` → `backend/application` → `backend/ports` ← `backend/adapters/mongo`; doble en memoria con los mismos puertos | U (contrato de puertos), I (mismo resultado en el doble y en MongoDB) | Los otros motores deben implementar los mismos puertos o su equivalente | Individual / Grupal |
| P-03 | [P] p. 1–3 | Cuatro instituciones con cuatro motores distintos (PostgreSQL, MySQL, MongoDB, Firebase), sin repetir | **Pendiente grupal** | Solo existe el Centro Pediátrico con MongoDB | — | La Fase I asigna Laboratorio → PostgreSQL y Odontología → MySQL ([F1] p. 40), pero el Hospital dice «implementado en Mysql» con `SERIAL` ([F1-H] p. 25) y Firebase no aparece asignado. **El equipo debe confirmar la asignación** | Grupal |
| P-04 | [P] p. 2 y 3 | Justificar por escrito por qué cada institución encaja con su motor | **Parcial** | MongoDB justificado en [F1] p. 42, `MODELO_Y_DECISIONES.md` §1 y el informe de Fase II §3 | — | Falta la justificación de las otras tres en el documento comparativo | Individual (hecho) / Grupal |
| P-05 | [P] p. 3 | Modelado corregido a partir de la retroalimentación de la Entrega I | **No verificable** | Cambios de Fase II documentados en `MODELO_Y_DECISIONES.md` | I, E | Sin la retroalimentación escrita no se puede afirmar que cubra cada observación. **Acción:** contrastarla cuando esté disponible | Individual |
| P-06 | [P] p. 4 | Consultas funcionando de forma equivalente en los cuatro motores | **Pendiente grupal** | Preparado: puertos (`backend/ports/index.js`) y contrato de operaciones comunes (`docs/GUIA_EQUIPO.md` §5) | U (contrato de puertos) | Requiere los otros tres motores | Grupal |
| P-07 | [P] p. 4 | Modelo documental: qué se embebe y qué se referencia, justificado | **Cumplido** | `pacientes` embebe tutores, consultas, controles y esquema; `medicos` y `vacunas` referenciados ([F1] p. 45–46; `MODELO_Y_DECISIONES.md` §3) | I, R | La parte de Firebase es de otro integrante | Individual |
| P-08 | [P] p. 4 | Visualización ordenada sin que la interfaz cambie según el motor | **Parcial** | Interfaz común (`apps/web/src/plataforma`) que solo consume la API; el módulo no muestra el motor | E («la interfaz no muestra el motor») | Solo se puede demostrar con una institución | Individual (hecho) / Grupal |
| P-09 | [P] p. 4 | Registro de paciente nuevo | **Cumplido** | `POST /api/pacientes` · pantalla Registrar paciente (con tutores y validación); id automático `P###` robusto (D-01) | U, I, E | — | Individual |
| P-10 | [P] p. 4 | Mantenimiento: nuevas consultas, diagnósticos, tratamientos y medicamentos recetados | **Cumplido** | Rutas `…/consultas`, `…/diagnosticos`, `…/tratamiento`, `…/prescripciones`; pantalla Nueva consulta y diálogos del historial | U, I, E | El tratamiento conserva sus versiones anteriores | Individual |
| P-11 | [P] p. 4 | Desactivación o archivo por baja (traslado, fallecimiento u otra causa) | **Cumplido** | `PATCH …/archivar` con motivo; el documento no se elimina; queda de solo lectura | U, I, E | — | Individual |
| P-12 | [P] p. 3 y 4 | Enrutamiento por usuario al motor de su institución, sin reescribir la lógica | **Parcial** | `backend/api/enrutadorInstituciones.js` despacha por el claim `institucion`; registro de módulos del frontend | U (dos instituciones simuladas); token de otra institución → 403 | El mecanismo funciona; solo hay una institución real | Individual (hecho) / Grupal |
| P-13 | [P] p. 2 y 4 | Documento comparativo: modelado, consistencia (transacciones SQL y NoSQL), seguridad y justificación por motor | **Parcial** | Parte MongoDB: `Informe_Fase2_Centro_Pediatrico.pdf` (y `.docx`), `MODELO_Y_DECISIONES.md`, `OPERACION_MONGODB.md` | — | Falta el documento conjunto de los cuatro motores | Individual (hecho) / Grupal |
| P-14 | [P] p. 1 y 4 | Consistencia en NoSQL | **Cumplido con limitación** | Atomicidad por documento, filtros condicionales y outbox `bitacora_pendiente` (standalone); `withTransaction` con replica set (`backend/adapters/mongo/unidadDeTrabajo.js`) | I (standalone y replica set desechables) | El servidor real es standalone: **no** tiene transacciones multidocumento. Migrar a replica set requiere autorización (`OPERACION_MONGODB.md`) | Individual |
| P-15 | [P] p. 1 y 4 | Seguridad aplicada al motor | **Cumplido** (alcance académico) | JWT HS256 con emisor, audiencia y expiración; permisos por rol en cada ruta; validadores `$jsonSchema`; usuario de base `readWrite`; sin operadores MongoDB en las entradas | U (seguridad, permisos), I, R | La autenticación es de desarrollo; el inicio de sesión real es grupal | Individual |
| P-16 | [P] p. 2–3 | Entrega I: modelos ER/relacionales y normalización de instituciones relacionales | **No aplica** a este módulo | — | — | Corresponde a las instituciones relacionales (Fase I entregada) | Grupal |

## 2. Diseño de la Fase I del Centro Pediátrico [F1]

| ID | Origen | Requisito | Estado | Implementación | Evidencia | Observaciones | Responsable |
|---|---|---|---|---|---|---|---|
| F1-01 | p. 42 y 45 | MongoDB orientado a documentos; colección principal `pacientes`, apoyo `medicos` y `vacunas` | **Cumplido** | `backend/adapters/mongo` | R, I | Más `bitacora_acceso` (extensión de Fase II) | Individual |
| F1-02 | p. 43 | Entidades y atributos (paciente, tutor, médico, especialidad, consulta, control, vacuna, esquema) | **Cumplido** | `backend/schema.js` (Zod) y `backend/adapters/mongo/validadores.js` con los mismos campos; extensiones de Fase II marcadas | U («schema»), I, R | Ningún campo de Fase I se renombra ni elimina | Individual |
| F1-03 | p. 44 | Clasificación: datos del paciente y del tutor confidenciales; DPI, motivo, observaciones, crecimiento y vacunas restringidos | **Cumplido** | Secretaría recibe la proyección administrativa; datos clínicos solo para médico y administrador; DPI enmascarado al médico | U («la secretaría no accede a ninguna ruta clínica», «DPI enmascarado»), E | Comprobado también con peticiones HTTP directas (auditoría del 31/10) | Individual |
| F1-04 | p. 45–46 | Tutores, consultas, controles y esquema embebidos; médicos y vacunas referenciados | **Cumplido** | Ver P-07 | I, R | — | Individual |
| F1-05 | p. 46 | Registrar una consulta corta (nuevo elemento en `consultas`) | **Cumplido** | `POST …/consultas` (`$push` atómico) | U, I, E | — | Individual |
| F1-06 | p. 46 | Actualizar peso, talla y, si corresponde, perímetro cefálico sin reemplazar mediciones | **Cumplido** | `POST …/crecimiento` y control dentro de la consulta; perímetro opcional según el validador instalado | U, I, E, R | — | Individual |
| F1-07 | p. 46 | Marcar una vacuna como aplicada (fecha, lote, médico) | **Cumplido** | `PATCH …/vacunacion/:id/aplicar`; doble aplicación rechazada también con peticiones simultáneas | U, I, E | — | Individual |
| F1-08 | p. 42 | Esquema por paciente con vacunas «programadas, pendientes, aplicadas u omitidas» | **Adaptado** | Estados `Pendiente` / `Aplicada` / `Cancelada` | U | «Programada» y «pendiente» se unifican en `Pendiente`; «omitida» se registra como `Cancelada`, con motivo obligatorio. Documentado en `MODELO_Y_DECISIONES.md` | Individual |
| F1-09 | p. 46 | Consultar el historial de crecimiento ordenado por fecha | **Cumplido** | `GET …/crecimiento`, tabla y gráficas (solo mediciones registradas; no son curvas de referencia) | U, E | — | Individual |
| F1-10 | p. 46 | Consultar el historial clínico completo | **Cumplido** | `GET /api/pacientes/:id` · Expediente con pestañas | U, E | — | Individual |
| F1-11 | p. 47 | Archivar el historial cambiando `estado_historial`, sin eliminar el documento | **Cumplido** | Ver P-11 | U, I, E | — | Individual |
| F1-12 | p. 47 | Solo personal autorizado; permisos por rol (médico, secretaría, administrador) | **Cumplido** | `backend/permisos.js` (única fuente para rutas y navegación) | U («cada permiso anunciado coincide con la autorización real»), E | — | Individual |
| F1-13 | p. 47 | Conservar quién actualiza consultas, vacunas o controles | **Cumplido** | Trazas embebidas (`registrado_por`, `aplicado_por`, `cancelado_por`, `archivado_por`, `reemplazado_por`) y `bitacora_acceso` | I, E | Algunos registros anteriores a la Fase II no tienen traza (válidos para el validador) | Individual |
| F1-14 | p. 47 | Archivado en lugar de eliminación | **Cumplido** | La API no tiene rutas ni operaciones de borrado | Revisión de código, U | — | Individual |
| F1-15 | p. 44 y 47 | Proteger datos personales y clínicos y registrar los cambios | **Cumplido** | Ver F1-03 y F1-13; lecturas clínicas auditadas (503 si no se puede registrar el evento) | U, I | — | Individual |

## 3. Extensiones implementadas (no exigidas por la Fase I pediátrica)

Funcionalidades que Pediatría ofrece además de su diseño de Fase I. Varias coinciden con operaciones del catálogo del **Hospital General** ([F1-H] p. 24–25); se citan solo como origen. **No** se cuentan como requisitos de Pediatría.

| ID | Funcionalidad | Implementación | Evidencia | Relación con [F1-H] |
|---|---|---|---|---|
| X-01 | Buscar si una persona ya existe como paciente | Búsqueda por nombre, código y tutor; DPI exacto solo para roles administrativos; duplicado → 409 | U, E | Análoga a «Buscar si una persona ya existe» (p. 24) |
| X-02 | Historial de medicamentos recetados | `GET …/prescripciones` · pestaña Prescripciones | U, E | Análoga a «Consultar el historial de medicamentos» (p. 24) |
| X-03 | Historial de consultas en un rango de fechas | `GET …/consultas?desde=&hasta=` | U | Análoga a la operación del Hospital (p. 24) |
| X-04 | Bitácora de accesos | `bitacora_acceso` con lecturas, escrituras, denegaciones y outbox | U, I, E | Análoga a «Registrar en bitácora cada acceso» (p. 25) |
| X-05 | Diagnósticos, tratamiento con versiones y prescripciones dentro de la consulta | Ver P-10 | U, I, E | Exigido por [P] p. 4, no por la Fase I pediátrica |
| X-06 | Altas de catálogo (médicos y vacunas) | `POST /api/medicos`, `POST /api/vacunas` (solo administrador, solo API) | U, I | No hay edición ni desactivación |
| — | Alertar si un medicamento coincide con una alergia | **No aplica**: el modelo pediátrico de la Fase I no registra alergias | — | Operación del Hospital (p. 24) |

## 4. Correcciones aplicadas

| Defecto | Corrección | Evidencia |
|---|---|---|
| El contador «Dosis pendientes» del panel incluía historiales archivados, mientras la lista y la página Vacunación a las que enlaza solo muestran activos | El contador usa el mismo criterio (solo activos); cada indicador explica qué incluye | I «archivado: solo lectura…» (comparación con `vacunacion.pendientes`) |
| Varias respuestas de error no traían `codigo` (validación, ruta inexistente, 409 por índice, 413, 429, 500) | Se agregó un `codigo` estable sin cambiar estados ni mensajes (cambio aditivo) | U «toda respuesta de error trae { error, codigo } estable» |
| La edición podía crear una identidad que el alta rechazaría por duplicada | Exclusión compartida para altas y ediciones, búsqueda excluyendo el propio paciente y comparación atómica de la identidad previa | U `integridad-auditoria.test.js`, I standalone y replica set |
| Un cambio de nacimiento intercalado con una escritura clínica podía dejar una fecha incompatible | Filtros atómicos de nacimiento vigente en consulta, crecimiento, programación y aplicación de vacunas | U e I: cuatro carreras deterministas; sin escritura clínica parcial ni evento de éxito |
| Panel y pendientes no registraban la lectura; una lectura podía devolverse con la bitácora caída | Se auditan panel, listado y pendientes; las lecturas y el acceso de desarrollo responden `503` sin datos ni token si no se persiste el evento | U (HTTP y recuperación), I (fallo real del validador de la bitácora), E (filtros de las nuevas acciones) |
| La API podía arrancar aunque fallara un índice esencial | Los índices únicos son requisito de arranque; `db:indices` devuelve error ante cualquier fallo | U (clasificación) e I (duplicado que impide crear el índice, sin borrar documentos) |
| D-01 (auditoría del 31/10/2026): un `id_paciente` manual de 10 o más dígitos desbordaba `$toInt` y dejaba todas las altas automáticas en 500; con altas simultáneas se agotaban los reintentos | La secuencia solo cuenta `P` + 1–9 dígitos; la forma `P` + dígitos queda reservada al sistema (id manual → 400); secuencia agotada → 409; en una instancia las altas automáticas toman el correlativo de una en una | U e I `identificador-paciente.test.js` (14 pruebas; mismo resultado en el doble y en MongoDB desechable) |
| D-09 (auditoría del 31/10/2026): esta matriz atribuía a Pediatría operaciones del catálogo del Hospital | Se movieron a §3 como extensiones y se corrigieron las páginas citadas | Esta revisión |

## 5. Pendientes que no son del módulo individual

Asignación definitiva de motores (P-03), módulos y backends de las otras tres instituciones, consultas equivalentes (P-06), documento comparativo conjunto (P-13), visualización comparada entre motores (P-08) e inicio de sesión común con usuarios reales. La forma de integrarlos está en [`GUIA_EQUIPO.md`](../../../docs/GUIA_EQUIPO.md).
