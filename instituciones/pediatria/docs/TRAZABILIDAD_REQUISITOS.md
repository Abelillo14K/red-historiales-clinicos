# Matriz de requisitos — Centro Médico Pediátrico (MongoDB)

Auditoría del 24/10/2026 contra los documentos oficiales, leídos directamente:

| Clave | Documento | Ubicación usada |
|---|---|---|
| **[P]** | `Proyecto final bases II.pdf` (enunciado del profesor, 4 páginas) | p. 1 contexto · p. 2 restricciones de motores y Entrega I · p. 3–4 Entrega II |
| **[F1]** | `Documentacion fase 1 base de datos 2.pdf` (Fase I del grupo) | p. 24–25 catálogo general de operaciones · p. 40–48 sección Centro Médico Pediátrico (numeración de páginas del PDF) |

**Estados.** **Cumplido**: implementado y verificado con la evidencia indicada. **Parcial**: existe una parte; se dice qué falta. **Pendiente**: no existe todavía. Algo que solo está *preparado* para la integración futura **no** se marca como cumplido.

**Responsable.** **Individual**: módulo Centro Médico Pediátrico con MongoDB (este repositorio). **Grupal**: otras instituciones, autenticación compartida definitiva, comparación conjunta.

**Evidencia.** **U** = pruebas con el doble en memoria · **I** = `instituciones/pediatria/tests/mongo.integration.test.js` (MongoDB real desechable, standalone y replica set) · **E** = `npm run test:e2e` (Edge real + API + MongoDB desechable, 27 pasos) · **R** = verificación histórica de solo lectura contra `centro_pediatrico_db` el 24/10/2026 (`npm run db:validadores`: 4 colecciones con validador de Fase II y 0 documentos que lo incumplen). Verificación del 29/10/2026: **134/134 pruebas** (`npm test`: plataforma 30 + Pediatría 104), **27/27 pasos E2E** y **12/12 pasos de vista previa**. Esta verificación utiliza bases desechables; no actualiza la evidencia histórica R.

## 1. Requisitos de la Entrega II [P]

| ID | Origen | Requisito | Estado | Implementación | Evidencia | Observaciones / acción necesaria | Responsable |
|---|---|---|---|---|---|---|---|
| P-01 | [P] p. 3 | Aplicación cliente-servidor: el cliente consulta y administra el historial | **Cumplido** (módulo) | API Express (`instituciones/pediatria/backend/app.js`) + React/Vite (`frontend/`) servidos desde el mismo origen | E (27 pasos), U | — | Individual |
| P-02 | [P] p. 1 y 3 | Arquitectura hexagonal como punto de partida común | **Cumplido** (módulo) | `instituciones/pediatria/backend/domain` → `instituciones/pediatria/backend/application` → `instituciones/pediatria/backend/ports` ← `instituciones/pediatria/backend/adapters/mongo`; doble en memoria con los mismos puertos | U «el adaptador MongoDB y el doble de prueba implementan los mismos puertos» | Los otros motores deben implementar los mismos puertos o su equivalente (guía §6) | Individual / Grupal |
| P-03 | [P] p. 2–3 | Cuatro instituciones con cuatro motores distintos (PostgreSQL, MySQL, MongoDB, Firebase), sin repetir | **Pendiente** (grupal) | Solo existe el Centro Pediátrico con MongoDB | — | La Fase I asigna Laboratorio→PostgreSQL (p. 39–40) y Odontología→MySQL (p. 40), pero la sección del Hospital dice «implementado en Mysql» con llaves `SERIAL` (p. 25), y Firebase no aparece asignado. **El equipo debe confirmar la asignación** | Grupal |
| P-04 | [P] p. 3 | Justificar por escrito por qué cada institución encaja con su motor | **Parcial** | MongoDB justificado en [F1] p. 42 y `instituciones/pediatria/docs/MODELO_Y_DECISIONES.md` | — | Falta la justificación de las otras tres en el documento comparativo | Individual (hecho) / Grupal |
| P-05 | [P] p. 3 | Modelado corregido a partir de la retroalimentación de la Entrega I | **Parcial** | Cambios de Fase II documentados en `instituciones/pediatria/docs/MODELO_Y_DECISIONES.md` (diagnósticos, tratamiento con versiones, prescripciones, trazas, archivado, perímetro opcional) | I, E | No se tuvo acceso a la retroalimentación escrita del profesor; no se puede afirmar que cubra cada observación. **Acción:** contrastar con esa retroalimentación cuando esté disponible | Individual |
| P-06 | [P] p. 4 | Consultas funcionando de forma equivalente en los cuatro motores | **Pendiente** (grupal) | Preparado: puertos (`instituciones/pediatria/backend/ports/index.js`) y contrato de operaciones comunes (guía §5) | U (contrato de puertos) | Requiere los otros tres motores | Grupal |
| P-07 | [P] p. 4 | Modelo documental MongoDB: qué se embebe y qué se referencia, justificado | **Cumplido** (MongoDB) | `pacientes` embebe tutores, consultas, controles y esquema; `medicos` y `vacunas` referenciados ([F1] p. 45–46; `instituciones/pediatria/docs/MODELO_Y_DECISIONES.md` §3) | I «registros heredados compatibles», R | La parte de Firebase es de otro integrante | Individual |
| P-08 | [P] p. 4 | Visualización ordenada sin que la interfaz cambie según el motor activo | **Parcial** | Interfaz común (`apps/web/src/plataforma`) que solo consume la API; el módulo no muestra el motor | E «la interfaz no muestra el motor» | Solo se demuestra con una institución; la equivalencia visual entre motores se comprobará al integrar las demás | Individual (hecho) / Grupal |
| P-09 | [P] p. 4 | Registro de paciente nuevo | **Cumplido** | `POST /api/pacientes` · pantalla Registrar paciente (con tutores y validación) | U, I, E paso 4 | — | Individual |
| P-10 | [P] p. 4 | Mantenimiento: nuevas consultas, diagnósticos, tratamientos y medicamentos recetados | **Cumplido** | Rutas `…/consultas`, `…/diagnosticos`, `…/tratamiento`, `…/prescripciones`; pantalla Nueva consulta y diálogos del historial | U, I, E pasos 7–8 y 14 | El tratamiento conserva sus versiones anteriores | Individual |
| P-11 | [P] p. 4 | Desactivación o archivo por baja (traslado, fallecimiento u otra causa) | **Cumplido** | `PATCH …/archivar` con motivo; el documento no se elimina; solo lectura | U, I, E pasos 15–16 | — | Individual |
| P-12 | [P] p. 4 | Enrutamiento por usuario al motor de su institución, sin reescribir la lógica | **Parcial** | `instituciones/pediatria/backend/api/enrutadorInstituciones.js` despacha por el claim `institucion`; registro de módulos del frontend | U «despacha cada usuario al módulo de su institución…» (dos instituciones simuladas) | El mecanismo funciona; solo hay una institución real registrada | Individual (hecho) / Grupal |
| P-13 | [P] p. 4 | Documento comparativo: modelado, consistencia (transacciones SQL y NoSQL) y seguridad por motor | **Parcial** | Parte MongoDB: `instituciones/pediatria/docs/MODELO_Y_DECISIONES.md` y `instituciones/pediatria/docs/OPERACION_MONGODB.md` | — | Falta el documento conjunto de los cuatro motores | Individual (hecho) / Grupal |
| P-14 | [P] p. 4 | Consistencia en NoSQL | **Cumplido con limitación** | Atomicidad por documento + bandeja `bitacora_pendiente` (servidor standalone); `withTransaction` si hay replica set (`instituciones/pediatria/backend/adapters/mongo/unidadDeTrabajo.js`) | I (standalone y replica set desechables) | El servidor real es standalone: **no** hay transacciones multi-documento allí. La migración a replica set requiere autorización del administrador (`instituciones/pediatria/docs/OPERACION_MONGODB.md`) | Individual |
| P-15 | [P] p. 4 | Seguridad aplicada al motor | **Cumplido** (módulo) | JWT HS256 con emisor/audiencia/expiración, permisos por rol en cada ruta, validadores `$jsonSchema`, usuario de base solo `readWrite`, sin operadores MongoDB en entradas | U (seguridad, permisos), I, R | — | Individual |
| P-16 | [P] p. 2 | Entrega I: modelos ER/relacionales y normalización de instituciones relacionales | No aplica a este módulo | — | — | Corresponde a las instituciones relacionales (ya entregado en Fase I) | Grupal |

## 2. Diseño de la Fase I del Centro Pediátrico [F1]

| ID | Origen | Requisito | Estado | Implementación | Evidencia | Observaciones | Responsable |
|---|---|---|---|---|---|---|---|
| F1-01 | p. 42 | MongoDB orientado a documentos; colección principal `pacientes`, apoyo `medicos` y `vacunas` | **Cumplido** | `instituciones/pediatria/backend/adapters/mongo` | R, I | — | Individual |
| F1-02 | p. 43 | Entidades y atributos (paciente, tutor, médico, especialidad, consulta, control, vacuna, esquema) | **Cumplido** | `instituciones/pediatria/backend/schema.js` (Zod) y `instituciones/pediatria/backend/adapters/mongo/validadores.js` con los mismos campos; extensiones de Fase II marcadas | U «schema», I | Ningún campo de Fase I se renombra ni elimina | Individual |
| F1-03 | p. 44 | Clasificación: datos del paciente y tutor confidenciales; motivo, observaciones, crecimiento, vacunas y DPI restringidos | **Cumplido** | Secretaría recibe la proyección administrativa; datos clínicos solo médico y administrador; DPI enmascarado al médico | U «la secretaría no accede a ninguna ruta clínica», «DPI enmascarado», E pasos 5 y 7 | — | Individual |
| F1-04 | p. 45–46 | Tutores, consultas, controles y esquema embebidos; médicos y vacunas referenciados | **Cumplido** | Ver P-07 | I, R | — | Individual |
| F1-05 | p. 46 | Registrar una consulta corta (`$push` en `consultas`) | **Cumplido** | `POST …/consultas` | U, I, E paso 7 | — | Individual |
| F1-06 | p. 46 | Actualizar peso, talla y, si corresponde, perímetro cefálico sin reemplazar mediciones | **Cumplido** | `POST …/crecimiento` y control dentro de la consulta; perímetro opcional según el validador instalado | U, I, E pasos 7 y 9–10, R | — | Individual |
| F1-07 | p. 46 | Marcar una vacuna como aplicada (fecha, lote, médico) | **Cumplido** | `PATCH …/vacunacion/:id/aplicar`; doble aplicación rechazada también con peticiones simultáneas | U, I, E pasos 11–13 | — | Individual |
| F1-08 | p. 42 y 46 | Esquema por paciente: programadas, pendientes, aplicadas u omitidas | **Cumplido** | Estados `Pendiente` / `Aplicada` / `Cancelada` (Cancelada = «omitida») | U | Equivalencia documentada en `MODELO_Y_DECISIONES.md` | Individual |
| F1-09 | p. 46 | Consultar historial de crecimiento ordenado por fecha | **Cumplido** | `GET …/crecimiento`, tabla y gráficas (solo mediciones registradas; no son curvas de referencia) | U, E pasos 9–10 | — | Individual |
| F1-10 | p. 46 | Consultar el historial clínico completo | **Cumplido** | `GET /api/pacientes/:id` · Expediente con pestañas | U, E | — | Individual |
| F1-11 | p. 46–47 | Archivar el historial sin eliminar el documento | **Cumplido** | Ver P-11 | U, I, E | — | Individual |
| F1-12 | p. 47 | Solo personal autorizado; permisos por rol (médico, secretaría, administrador) | **Cumplido** | `instituciones/pediatria/backend/permisos.js` (única fuente para rutas y navegación) | U «cada permiso anunciado coincide con la autorización real», E | — | Individual |
| F1-13 | p. 47 | Conservar quién actualiza consultas, vacunas o controles | **Cumplido** | Trazas embebidas (`registrado_por`, `aplicado_por`, `cancelado_por`, `archivado_por`) + `bitacora_acceso` | I, E paso 17–18 | — | Individual |
| F1-14 | p. 47 | No eliminar historiales físicamente | **Cumplido** | La API no tiene rutas de borrado | U | — | Individual |
| F1-15 | p. 24 | Buscar si una persona ya existe como paciente | **Cumplido** | Búsqueda por nombre, código y tutor; DPI exacto solo para roles administrativos; duplicado → 409 | U, E pasos 3 y 6 | — | Individual |
| F1-16 | p. 24 | Historial de medicamentos recetados | **Cumplido** | `GET …/prescripciones` · pestaña Prescripciones | U, E paso 14 | — | Individual |
| F1-17 | p. 25 | Registrar en bitácora cada acceso o modificación a información restringida | **Cumplido** | Lecturas clínicas, escrituras y accesos denegados auditados | U, I, E paso 17 | — | Individual |
| F1-18 | p. 24 | Alertar medicamento frente a alergia | No aplica | — | — | El modelo pediátrico de la Fase I no registra alergias (catálogo general, sección del Hospital) | — |

## 3. Correcciones aplicadas en esta auditoría

| Defecto | Corrección | Evidencia |
|---|---|---|
| El contador «Dosis pendientes» del panel incluía historiales archivados, mientras la lista y la página Vacunación a las que enlaza solo muestran activos | El contador usa el mismo criterio (solo activos); cada indicador explica qué incluye | I «archivado: solo lectura…» (comparación con `vacunacion.pendientes`) |
| Varias respuestas de error no traían `codigo` (validación, ruta inexistente, 409 por índice, 413, 429, 500) | Se agregó `codigo` estable sin cambiar estados ni mensajes (cambio aditivo) | U «toda respuesta de error trae { error, codigo } estable» |
| La edición podía crear una identidad que el alta rechazaría por duplicada | Exclusión compartida para altas/ediciones, búsqueda excluyendo el propio paciente y comparación atómica de identidad previa | U `integridad-auditoria.test.js`, I standalone y replica set |
| Un cambio de nacimiento intercalado con una escritura clínica podía dejar una fecha incompatible | Filtros atómicos de nacimiento vigente en consulta, crecimiento, programación y aplicación de vacunas | U e I: cuatro carreras deterministas; sin escritura clínica parcial ni evento de éxito |
| Panel y pendientes no registraban lectura; una lectura podía devolverse con la bitácora caída | Se auditan panel, listado y pendientes; lecturas y acceso de desarrollo responden `503` sin datos/token si no se persiste el evento | U (HTTP y recuperación), I (fallo real de validador de bitácora), E (filtros de nuevas acciones) |
| La API podía arrancar aunque fallara un índice esencial | Los índices únicos son indispensables para el arranque; `db:indices` devuelve error ante cualquier fallo | U (clasificación) e I (duplicado que impide crear índice, sin borrar documentos) |

## 4. Pendientes que no son del módulo individual

Asignación definitiva de motores (P-03), módulos y backends de las otras tres instituciones, consultas equivalentes (P-06), inicio de sesión común con usuarios reales, documento comparativo conjunto (P-13). La forma de integrarlos está en [`GUIA_INTEGRACION_EQUIPO.md`](../../../docs/GUIA_INTEGRACION_EQUIPO.md).
