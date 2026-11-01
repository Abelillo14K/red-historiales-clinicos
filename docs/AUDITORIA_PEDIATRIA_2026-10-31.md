# Auditoría técnica y académica — Centro Médico Pediátrico (MongoDB)

Fecha: 31/10/2026. Código auditado: commit `467f050` (rama `preview/redisenio-clinico`, PR #1 pendiente de aprobación; `main` sigue en `a367d2a` y **no** contiene todavía las correcciones de integridad y auditoría de este commit).

Alcance: `instituciones/pediatria/` (backend, frontend, pruebas, scripts y documentación) y su integración con `apps/web/`. No se evaluaron Hospital, Odontología ni Laboratorio, salvo para separar responsabilidades.

Etapa de diagnóstico: **no se modificó código, ni la base de datos, ni `.env`, ni los respaldos**. Este informe es el único archivo nuevo.

> **Actualización del 31/10/2026 (corrección posterior).** **D-01 está corregido** en el commit que sigue a `467f050` en la misma rama. Detalle, pruebas y limitaciones restantes en §12 (D-01 y D-06). Con la corrección, `npm test` pasa **148/148** (30 de plataforma + 118 de Pediatría). El resto del informe describe el estado auditado; donde D-01 cambia una conclusión, se indica.

---

## 1. Resumen ejecutivo

La parte pediátrica es **sólida, funcional y defendible**. Cumple los requisitos de la Entrega II que corresponden a una institución individual y respeta el diseño documental de su Fase I. La comprobación se hizo con evidencia directa: código, la base real en modo de solo lectura, 20 000 documentos ficticios en un `mongod` desechable, peticiones HTTP directas y las pruebas del proyecto.

- **No se encontraron defectos CRÍTICOS.** No hay pérdida ni exposición de datos, fallos de autorización ni corrupción.
  - Ninguna petición directa a la API permitió a Secretaría leer información clínica, ni a un rol hacer algo fuera de sus permisos.
- **Hay un defecto ALTO confirmado (D-01), ya corregido.** Un alta con un `id_paciente` manual de 10 o más dígitos, permitida por la propia API, rompía para siempre la generación automática de identificadores. Desde ese momento ninguna alta sin identificador funcionaba (500). Ver §12.
- **Hay defectos MEDIOS:**
  - La detección de duplicados no cubre varias instancias ni variantes con dobles espacios o sin tildes.
  - El informe PDF de Fase II que está en el repositorio está desactualizado.
- **Lo que falta para el proyecto completo es grupal:**
  - los otros tres motores y sus backends;
  - las consultas equivalentes en los cuatro motores;
  - el documento comparativo conjunto;
  - la asignación de motores confirmada;
  - un inicio de sesión real.

**No es atribuible a Pediatría.**

**Dictamen breve:** la parte pediátrica está lista para defenderse una vez actualizado el informe PDF (D-03). D-01 ya está corregido. El resto son mejoras o limitaciones conocidas que conviene saber explicar.

---

## 2. Fuentes consultadas y requisitos originales

| Clave | Documento | Ubicación | Observación |
|---|---|---|---|
| **[P]** | `Proyecto final bases II (1).pdf` (enunciado del profesor) | `C:\Users\abela\Downloads\`; las tres copias tienen el mismo MD5 `ef803efc…` | Leído completo. Es la única fuente de requisitos del profesor encontrada |
| **[F1]** | `Documentacion fase 1 base de datos 2 (6).pdf` (entrega grupal de Fase I) | `C:\Users\abela\Downloads\`; las dos copias tienen el mismo MD5 `ec51cfad…` | Leída la sección «Centro Médico Pediátrico» y la sección 8 «Catálogo de operaciones», que pertenece al **Hospital General** |
| [M] | `Historial Clínico — Mockup.pdf` | Raíz del proyecto, sin seguimiento en Git | Solo es fuente de diseño visual, no de requisitos |
| [I] | `instituciones/pediatria/docs/*.md`, `docs/*.md` | Repositorio | Decisiones de implementación, **no** son requisitos del profesor |

**No se encontró la retroalimentación escrita del profesor sobre la Entrega I.** Por eso el requisito «modelado corregido a partir de la retroalimentación» **no es verificable**. Tampoco se encontraron rúbricas ni instrucciones adicionales del profesor. No se dan por obligatorios operadores ni consultas que el enunciado no pide: el enunciado no exige ningún operador ni agregación concreta de MongoDB.

### 2.1 Requisitos del profesor [P] (literal resumido)

1. Se evalúan las **decisiones de modelado, consistencia y seguridad de cada motor**; la arquitectura hexagonal es un medio, no el objetivo.
2. Hay cuatro instituciones y cuatro motores distintos, sin repetir ninguno (PostgreSQL, MySQL, MongoDB, Firebase). La asignación debe justificarse por escrito.
3. Pediatría: «historiales con seguimiento por paciente (control de crecimiento, esquema de vacunación), con consultas frecuentes y de corta duración».
4. Entrega II:
   - aplicación cliente-servidor funcional;
   - modelado corregido según la Entrega I;
   - consultas equivalentes en los cuatro motores;
   - modelo documental con una decisión justificada sobre qué se embebe y qué se referencia;
   - visualización ordenada que no cambie según el motor;
   - registro de paciente nuevo;
   - mantenimiento del historial (consultas, diagnósticos, tratamientos, medicamentos);
   - archivo por baja;
   - enrutamiento por usuario al motor de su institución;
   - documento comparativo (modelado, consistencia, seguridad y justificación del motor).

### 2.2 Requisitos de la Fase I para Pediatría [F1]

- Colección principal `pacientes`; colecciones de apoyo `medicos` y `vacunas`.
- Entidades y atributos: paciente, tutor, médico, especialidad, consulta, control de crecimiento, vacuna y esquema de vacunación.
- Clasificación de la información:
  - Pública: especialidad, vacuna, médico, colegiado.
  - Confidencial: datos del paciente y del tutor.
  - Restringida: DPI, motivo, observaciones, medidas y vacunas.
- Tutores, consultas, controles y esquema van embebidos; médicos y vacunas se referencian.
- Seis operaciones:
  1. registrar una consulta corta;
  2. agregar peso y talla, y el perímetro cefálico «si corresponde»;
  3. marcar una vacuna como aplicada (fecha, lote y médico);
  4. consultar el crecimiento ordenado por fecha;
  5. consultar el historial completo;
  6. archivar (cambiar `estado_historial`, sin eliminar).
- Seguridad:
  - solo personal autorizado;
  - roles médico, secretaría y administrador;
  - conservar quién actualiza;
  - no eliminar físicamente.
- Estados del esquema: «programadas, pendientes, aplicadas u omitidas».

### 2.3 Corrección necesaria en la trazabilidad interna

`instituciones/pediatria/docs/TRAZABILIDAD_REQUISITOS.md` cita en F1-15, F1-16, F1-17 y F1-18 «p. 24–25, catálogo general de operaciones». Ese catálogo es la **sección 8 del Hospital General**, no una lista común a todas las instituciones. Pediatría implementa esas operaciones como **extensión**: búsqueda de paciente, historial de medicamentos, bitácora de accesos y rango de fechas. Pero no son requisitos de la Fase I pediátrica. Ver D-09.

---

## 3. Estado de cumplimiento académico

### A. Fase I (Pediatría)

| Requisito | Estado |
|---|---|
| Entidades, atributos, clasificación de la información y operaciones en lenguaje sencillo | **Cumplido** (entregado en [F1]) |
| Modelo ER/relacional y normalización | **No aplica a Pediatría** (motor no relacional; [F1] lo justifica) |

### B. Fase II (Entrega II, parte individual)

| Requisito | Estado |
|---|---|
| Aplicación funcional, cliente-servidor, hexagonal | Cumplido |
| Registro, mantenimiento y archivo | Cumplido (D-01 en el registro con id automático, ya corregido) |
| Modelo documental justificado | Cumplido |
| Consistencia y seguridad del motor | Cumplido, con las limitaciones de §7 |
| Modelado corregido según retroalimentación | No verificable |

### C. Específicos de Pediatría

| Requisito | Estado |
|---|---|
| Crecimiento (serie histórica, gráfica, perímetro opcional) | Cumplido |
| Esquema de vacunación por paciente | Cumplido |
| Consultas frecuentes y cortas (un `$push` atómico) | Cumplido |

### D. MongoDB

| Requisito | Estado |
|---|---|
| Colecciones, embebido/referenciado, índices, validadores `$jsonSchema` instalados e idénticos al código | Cumplido |
| Transacciones | Solo en replica set desechable; el servidor real es standalone y usa outbox embebido |

### E. Integración compartida

| Requisito | Estado |
|---|---|
| Enrutamiento por institución, contrato de módulo y sesión desde el backend | Implementado (probado con dos instituciones simuladas) |
| Interfaz igual entre motores | Solo demostrable con un motor |

### F. Pendientes que dependen de otros integrantes

1. **Asignación definitiva de motores.** La [F1] asigna MySQL al Hospital («implementado en Mysql», con `SERIAL`) y también a Odontología, y deja Firebase sin asignar. Eso incumple la regla de no repetir motores.
2. Backends de Hospital, Odontología y Laboratorio.
3. Consultas equivalentes en los cuatro motores.
4. Documento comparativo conjunto.
5. Inicio de sesión común con usuarios reales.

---

## 4. Matriz de trazabilidad requisito por requisito

Pruebas: **U** = API real sobre el doble en memoria · **I** = `mongo.integration.test.js` sobre `mongod` desechable · **E** = `npm run test:e2e` (Edge real + MongoDB desechable) · **X** = experimento de esta auditoría sobre `mongod` desechable · **L** = lectura de la base real.

| Requisito | Fuente | Implementación | Prueba | Estado | Observaciones |
|---|---|---|---|---|---|
| Aplicación cliente-servidor funcional | [P] p. 3 | `backend/app.js`, `server.js`; `apps/web` + `frontend/` | E 27/27, U | Cumplido y verificado | El mismo origen sirve la API y el frontend |
| Arquitectura hexagonal como base común | [P] p. 1, 3 | `domain/` → `application/` → `ports/` ← `adapters/mongo`, `tests/doubles/memoria.js` | U «adaptador y doble implementan los mismos puertos» | Cumplido y verificado | El doble divergía en `siguienteId` (D-01/D-06); corregido: ambos aplican la misma regla del dominio y se comparan en 8 escenarios |
| Motor distinto por institución (4 motores) | [P] p. 2–3 | — | — | No aplica a Pediatría | Grupal: no implementado; asignación de la [F1] inconsistente |
| Justificar la asignación institución → motor | [P] p. 3 | [F1] sección pediátrica; `MODELO_Y_DECISIONES.md` §1 | — | Implementado parcialmente | La justificación de MongoDB existe; falta el documento conjunto |
| Modelado corregido según la Entrega I | [P] p. 3 | Extensiones de Fase II documentadas | — | No verificable con la información disponible | No hay retroalimentación del profesor |
| Consultas equivalentes en los cuatro motores | [P] p. 4 | Puertos y contrato de operaciones (`GUIA_INTEGRACION_EQUIPO.md` §5) | U (contrato) | No aplica a Pediatría | Grupal; Pediatría aporta el contrato de referencia |
| Modelo documental: qué se embebe y qué se referencia | [P] p. 4 | `MODELO_Y_DECISIONES.md` §3; colecciones reales | L (estructura real = diseño), I | Cumplido y verificado | Incluye el análisis del límite de 16 MiB |
| Visualización ordenada que no cambie según el motor | [P] p. 4 | Plataforma común; el motor no se muestra | E «motor oculto» | Implementado parcialmente | Solo hay un motor para comparar |
| Registro de paciente nuevo | [P] p. 4 | `POST /api/pacientes`, `PacienteNuevo.jsx` | U, I, E, `identificador-paciente.test.js` | Cumplido y verificado | **D-01** (el id automático podía quedar inutilizable): corregido |
| Nuevas consultas | [P] p. 4; [F1] | `POST …/consultas` (`$push`) | U, I, E | Cumplido y verificado | Consulta, diagnósticos, tratamiento, receta y control en un solo `updateOne` |
| Diagnósticos | [P] p. 4 | `POST …/diagnosticos` (`$push` posicional) | U, I, E | Cumplido y verificado | Código libre (sin catálogo CIE); no lo pide el enunciado |
| Tratamientos | [P] p. 4 | `PUT …/tratamiento` con versiones | U, I, E | Cumplido y verificado | Concurrencia optimista |
| Medicamentos recetados | [P] p. 4 | `POST …/prescripciones`, `GET …/prescripciones` | U, I, E | Cumplido y verificado | — |
| Archivo por baja (traslado, fallecimiento, otra) | [P] p. 4; [F1] | `PATCH …/archivar` | U, I, E, X | Cumplido y verificado | Sin borrado físico (no hay `delete*` en el backend) |
| Enrutamiento por usuario al motor de su institución | [P] p. 4 | `api/enrutadorInstituciones.js` | U (dos instituciones simuladas), X (token de otra institución → 403) | Implementado parcialmente | Solo hay una institución real |
| Documento comparativo (modelado, consistencia, seguridad) | [P] p. 4 | `MODELO_Y_DECISIONES.md`, `OPERACION_MONGODB.md` | — | Implementado parcialmente | Falta el documento conjunto; el PDF de Fase II está desactualizado (D-03) |
| Consistencia (transacciones SQL y NoSQL) | [P] p. 4 | `unidadDeTrabajo.js` (transacción u outbox) | I (standalone y replica set) | Cumplido y verificado | El servidor real no tiene transacciones (§7) |
| Seguridad del motor | [P] p. 4 | JWT, permisos, `$jsonSchema`, usuario `readWrite` | U, I, X | Cumplido y verificado | Para el alcance académico; la autenticación es de desarrollo |
| Colecciones `pacientes`, `medicos`, `vacunas` | [F1] | Adaptador MongoDB | L | Cumplido y verificado | Más `bitacora_acceso` (extensión) |
| Entidades y atributos de la Fase I | [F1] | `schema.js`, `validadores.js` | L (validadores idénticos), U | Cumplido y verificado | Ningún atributo eliminado ni renombrado |
| Clasificación pública / confidencial / restringida | [F1] | Proyección administrativa, DPI enmascarado, permisos | U, X (12 rutas clínicas → 403 para Secretaría) | Cumplido y verificado | — |
| Embebido / referenciado de la Fase I | [F1] | Igual al diseño | L | Cumplido y verificado | — |
| Registrar consulta corta | [F1] | `agregarConsulta` | U, I, E | Cumplido y verificado | — |
| Peso, talla y perímetro «si corresponde» | [F1] | `agregarControl`; perímetro opcional | U, I, E, L (validador lo permite) | Cumplido y verificado | — |
| Marcar vacuna aplicada (fecha, lote, médico) | [F1] | `aplicarDosis` (filtro `Pendiente`) | U, I (doble aplicación simultánea), E | Cumplido y verificado | — |
| Historial de crecimiento ordenado por fecha | [F1] | `crecimientoService.historial` | U, E | Cumplido y verificado | El orden se aplica en Node, no en MongoDB |
| Historial clínico completo | [F1] | `GET /api/pacientes/:id` | U, E | Cumplido y verificado | — |
| Estados programada / pendiente / aplicada / omitida | [F1] | `Pendiente` / `Aplicada` / `Cancelada` | U | Implementado parcialmente | Adaptación justificada: «programada» y «pendiente» se unen y «omitida» pasa a llamarse «Cancelada»; hay que explicarlo en la defensa |
| Solo personal autorizado; roles | [F1] | `permisos.js` | U (12 permisos × 3 roles), X | Cumplido y verificado | — |
| Conservar quién actualiza | [F1] | Trazas `registrado_por`, `aplicado_por`, etc., y bitácora | I, E | Cumplido y verificado | Datos heredados reales sin traza (D-10) |
| No eliminar físicamente | [F1] | No hay rutas ni operaciones de borrado | Revisión de código | Cumplido y verificado | — |
| Operaciones del catálogo del Hospital (buscar, rango, medicamentos, bitácora) | [F1] §8 Hospital | Implementadas como extensión | U, E | No aplica a Pediatría | La matriz interna las atribuye mal (D-09) |
| Mantener catálogos (crear / editar / desactivar) | [F1] §8 Hospital | Solo altas por API (administrador) | U, I | No aplica a Pediatría | Sin edición, desactivación ni interfaz de altas |

---

## 5. Evaluación del diseño MongoDB

### 5.1 Estado real de `centro_pediatrico_db` (solo lectura, 31/10/2026)

- **Servidor:** MongoDB 9.0.4 standalone.
- **Contenido:** 4 colecciones y 104 documentos.
  - `pacientes`: 5 (3 activos y 2 archivados).
  - `medicos`: 3.
  - `vacunas`: 5.
  - `bitacora_acceso`: 91.
- **Validadores:** los cuatro instalados son **idénticos** (comparación profunda) a `adapters/mongo/validadores.js`, en modo `strict/error`.
- **Cumplimiento del validador:** `npm run db:validadores` informa 0 documentos que lo incumplen.
- **Integridad:** no hay referencias rotas.
  - `id_medico` e `id_vacuna` existen en sus catálogos.
  - Todos los controles apuntan a una consulta del mismo paciente.
- **Coherencia:**
  - no hay dosis activas duplicadas;
  - las dosis aplicadas tienen fecha, lote y médico;
  - no hay consultas, controles ni recetas fuera del orden temporal;
  - no hay identidades duplicadas;
  - las fechas de nacimiento están a medianoche UTC.
- **Outbox:** 0 eventos pendientes.
- **Datos heredados (D-10):**
  - P003 está archivado sin `archivado_por`.
  - La consulta C001 de P001 no tiene `registrado_por`.
  - 44 de 91 eventos de bitácora no tienen `id_evento`; son anteriores a Fase II.

### 5.2 Modelo documental

| Aspecto | Evaluación |
|---|---|
| Documento centrado en el paciente | Adecuado al acceso dominante (expediente completo) y al «seguimiento por paciente» del enunciado |
| Consultas embebidas | Adecuado. Cada consulta añade diagnósticos, tratamiento con versiones y recetas. El límite de 16 MiB está analizado (unas 2 000 consultas ≈ 4 MB) y hay un plan *subset* documentado |
| Controles y esquema embebidos | Adecuado: series cortas, graficadas completas y modificadas con el operador posicional |
| `medicos` y `vacunas` referenciados | Adecuado. MongoDB no tiene claves foráneas: la integridad la verifican los casos de uso, y como no hay borrado de catálogos no quedan referencias colgantes |
| Bitácora separada y outbox temporal | Buena decisión para standalone |
| Identificadores | `id_*` legibles con patrón validado; `_id` interno no se expone. Ids embebidos generados con prefijo + UUID de 10 hex |
| Fechas | BSON Date en UTC. Las fechas sin hora se guardan a medianoche UTC y la interfaz las muestra en UTC (`formato.js`); las fechas con hora, en hora local |
| Nulos, vacíos y faltantes | `limpiar()` elimina `null` y `undefined` antes de guardar. En las dosis se guardan explícitamente `fecha_aplicacion`, `lote` e `id_medico` como `null`. El validador acepta `['string','null']` en los opcionales |
| Historial de modificaciones | Trazas embebidas, `tratamientos_anteriores` y bitácora. No hay versiones de datos generales ni de tutores: solo `ultima_actualizacion` y el evento con los nombres de los campos cambiados |

**Conclusión:** el modelo es adecuado para un sistema pediátrico académico y coincide con la Fase I.

---

## 6. Inventario de consultas y operaciones MongoDB

Archivo base: `instituciones/pediatria/backend/adapters/mongo/repositorios.js` (**R**). Las validaciones previas están en `application/*Service.js` (**S**) y en `schema.js` (Zod estricto). Todo error 11000 se traduce a `409 CONFLICTO` y todo error 121 a `422 VALIDACION_MOTOR` (`traducir`).

Las escrituras devuelven `modifiedCount === 1`; si es 0, la respuesta es `409`. En standalone, cada escritura clínica añade además un `$push` del evento a `bitacora_pendiente` (outbox).

| # | Operación | Función | Colección y comando | Filtro / proyección / orden | Índice (verificado con `explain`) | Validaciones previas y errores | Prueba | Cumple |
|---|---|---|---|---|---|---|---|---|
| 1 | Registrar paciente | S `registrar` → R `buscarDuplicado`, `siguienteId`, `crear` | `pacientes`: `findOne` + `aggregate` + `insertOne` | Duplicado: `nombres`/`apellidos` con regex anclada `i` y `fecha_nacimiento`. Id: `$match` `^P[0-9]+$`, `$toInt`, `$sort n:-1`, `$limit 1` | Duplicado: **COLLSCAN**. `siguienteId`: recorrido completo | Nacimiento no futuro; un tutor principal; DPI e id de tutor únicos; exclusión por identidad (una instancia). 409 duplicado; reintento si choca el id | U, I (5 altas simultáneas), E; tras D-01, `identificador-paciente.test.js` | Sí, salvo D-04 (D-01 corregido: el id cuenta solo `P` + 1–9 dígitos con `$group`/`$max`) |
| 2 | Listar pacientes | S `listar` → R `listar` | `pacientes`: `find` + `countDocuments` | `estado_historial`, `sexo`; proyección con `$filter`/`$first` (tutor principal sin DPI), `$size`, `$max`; orden `apellidos, nombres, id_paciente`; `skip`/`limit` ≤ 100 | IXSCAN `estado_historial_1_apellidos_1_nombres_1` **+ SORT en memoria** (D-07); `Todos` → COLLSCAN + SORT | Archivado/Todos solo administrador (403). Secretaría sin contadores clínicos. Auditado (`LISTAR_*`) | U, E, X | Sí |
| 3 | Buscar por criterios permitidos | R `listar` (`texto`) | Ídem, con `$or` | Regex escapada `i` sobre id, nombres, apellidos y nombres/apellidos del tutor; DPI **exacto** solo para Secretaría y administrador | IXSCAN por estado y luego filtro; el índice `tutores.dpi` no se usa dentro del `$or` | `q` ≤ 80 caracteres; regex escapada (sin ReDoS ni inyección) | U «solo roles administrativos buscan por DPI», E | Sí |
| 4 | Consultar expediente | S `leerHistorial` → R `obtener` | `pacientes.findOne` | `{id_paciente}`, proyección sin `_id` ni `bitacora_pendiente` | EXPRESS_IXSCAN `id_paciente_1` | Archivado solo administrador (403 auditado); DPI enmascarado para Médico; auditado antes de responder (503 si falla) | U, I, E, X | Sí |
| 4b | Datos administrativos | R `obtenerAdministrativo` | `pacientes.findOne` | Proyección sin datos clínicos | `id_paciente_1` | Archivado → 403 (**la denegación no se audita**, D-11) | U, X | Sí |
| 5 | Actualizar datos administrativos | S `actualizarDatos` → R `actualizarDatos` | `pacientes.updateOne` `$set` | Activo + identidad previa + `{'consultas.fecha_hora','controles_crecimiento.fecha','esquema_vacunacion.fecha_programada','esquema_vacunacion.fecha_aplicacion': {$not:{$lt:nacimiento}}}` | `id_paciente_1` | El nuevo nacimiento no puede quedar después de registros clínicos ni vacunas; duplicado excluyendo el propio paciente; 409 si hay cambio concurrente | U, I (carreras en standalone y replica set) | Sí |
| 6 | Gestionar tutores (reemplazar, agregar, actualizar) | S `guardarTutores` → R `reemplazarTutores` | `pacientes.updateOne` `$set tutores` | Activo + `tutores: previos` (igualdad exacta, concurrencia optimista) | `id_paciente_1` | Un tutor principal; ≤ 10; DPI e id únicos; 409 si cambió | U | Sí. Reemplazo completo (`PATCH`) solo por API |
| 7 | Registrar consulta | S `consultas.registrar` → R `agregarConsulta` | `pacientes.updateOne` `$push consultas` (y `controles_crecimiento`) | Activo, `fecha_nacimiento ≤ fecha_hora`, `consultas.id_consulta ≠`, `controles.id_control ≠` | `id_paciente_1` | Médico existe (422); no futura (±5 min); no antes del nacimiento; códigos de diagnóstico únicos; recetas no anteriores a la consulta | U, I, E | Sí |
| 8 | Registrar diagnóstico | R `agregarDiagnostico` | `updateOne` `$push consultas.$.diagnosticos` | `$elemMatch {id_consulta, diagnosticos.codigo ≠}` | `id_paciente_1` | Consulta existe (404); código repetido (409) | U, I, E | Sí |
| 9 | Registrar o actualizar tratamiento | R `establecerTratamiento` | `updateOne` `$set consultas.$.tratamiento` + `$push tratamientos_anteriores` | `$elemMatch {id_consulta, tratamiento: previo ?? null}` | `id_paciente_1` | 409 si cambió desde la lectura | U «conserva versión anterior», I, E | Sí |
| 10 | Registrar prescripción | R `agregarPrescripcion` | `updateOne` `$push consultas.$.prescripciones` | `$elemMatch {id_consulta, id_prescripcion ≠}` | `id_paciente_1` | Emisión no futura ni anterior a la consulta; 1–20 medicamentos | U, hallazgos-auditoría, E | Sí |
| 10b | Historial de medicamentos y diagnósticos | S `listarPrescripciones`, `listarDiagnosticos` | `findOne` + aplanado en Node | — | `id_paciente_1` | Auditado | U, E (medicamentos); diagnósticos solo por API | Sí |
| 10c | Consultas por rango de fechas | S `consultas.listar` | `findOne` + filtro y orden en Node | `desde ≤ hasta` (Zod) | `id_paciente_1` | Auditado | U «historial de consultas filtrado por rango» | Sí (filtro en la aplicación, D-12) |
| 11 | Registrar control de crecimiento | R `agregarControl` | `updateOne` `$push controles_crecimiento` | Activo, `fecha_nacimiento ≤ fecha`, `consultas.id_consulta` existe, `id_control ≠` | `id_paciente_1` | Consulta existe (422); medidas > 0 y ≤ máximos; perímetro opcional según el validador | U, I, E | Sí |
| 11b | Consultar crecimiento | S `crecimiento.historial` | `findOne` + orden y `edad_meses` en Node | — | `id_paciente_1` | Auditado | U, E | Sí |
| 12 | Programar vacuna | R `programarDosis` | `updateOne` `$push esquema_vacunacion` | Activo, `fecha_nacimiento ≤ programada`, `id_esquema ≠`, `$not $elemMatch {id_vacuna, numero_dosis, estado ≠ Cancelada}` | `id_paciente_1` | Vacuna existe (422); estado inicial `Pendiente`; dosis duplicada (409) | U, I, E | Sí |
| 13 | Aplicar dosis | R `aplicarDosis` | `updateOne` `$set esquema_vacunacion.$.*` | `$elemMatch {id_esquema, estado:'Pendiente'}`, `fecha_nacimiento ≤ aplicación` | `id_paciente_1` | Médico existe; no futura; solo una aplicación (la simultánea → 409) | U, I, E | Sí |
| 14 | Cancelar dosis | R `cancelarDosis` | `updateOne` `$set estado:'Cancelada'` | `$elemMatch {id_esquema, estado:'Pendiente'}` | `id_paciente_1` | Motivo obligatorio | U, E | Sí. No hay reprogramación directa: se cancela y se programa otra |
| 15 | Archivar | R `archivar` | `updateOne` `$set estado, fecha, motivo, archivado_por` | `activo(id)` | `id_paciente_1` | Solo administrador; un segundo archivado → 409 | U, I, E, X | Sí |
| 16 | Expedientes archivados | R `listar` (`estado:'Archivado'`) y `obtener` | `find` / `findOne` | — | IXSCAN + SORT | Solo administrador; lectura auditada `*_ARCHIVADO` | U, E, X | Sí |
| 17 | Médicos y vacunas | R `medicos.listar/obtener`, `vacunas.listar/obtener` | `find` / `findOne` | `especialidad.nombre` opcional; orden por id | `id_medico_1`, `id_vacuna_1` (especialidad sin índice: FETCH completo) | Las lecturas de catálogo no se auditan (información pública según la [F1]) | U, E | Sí |
| 18 | Indicadores del panel | R `resumen`, `dosisPendientes` | `aggregate` (`$group` con `$size`/`$filter`; `$unwind` + `$sort` + `$limit`) | Activo en consultas recientes y pendientes | `$match` por estado; `$unwind` en memoria. 20 000 pacientes: 185 ms + 104 ms | Secretaría solo recibe dos contadores; auditado (LEER_PANEL + LEER_VACUNACION_PENDIENTE) | U, I, E, X | Sí (D-13) |
| 19 | Registrar y consultar auditoría | R `auditoria.registrar/listar`; outbox `unidadDeTrabajo.entregar/reenviarPendientes` | `bitacora_acceso.insertOne`, `find`; `pacientes.updateOne $pull bitacora_pendiente` | Por `id_paciente` y/o `accion`, `fecha_hora:-1`, límite ≤ 500 | `id_paciente_1_fecha_hora_-1`; por acción usa `fecha_hora_-1` y filtra (91 claves para 11 resultados) | Entrega idempotente (11000 ignorado); reenvío al arrancar, cada 60 s y al consultar | U, I (bitácora caída, replica set) | Sí (la lectura de la bitácora no se audita, D-11) |
| 20 | Crear catálogos | S `crearMedico`, `crearVacuna` | `insertOne` | — | Únicos `id_medico`, `colegiado`, `id_vacuna` | Solo administrador; en standalone el evento es posterior y no atómico | I (transacción), hallazgos-auditoría | Parcial: sin interfaz, sin edición ni desactivación |

No se encontraron errores silenciosos en las escrituras clínicas: todo `modifiedCount = 0` se informa como 409.

Sí hay dos casos en que la operación **se completa aunque la auditoría falle**, y el fallo solo queda en el registro del servidor:
- las altas de catálogo en standalone;
- la copia del outbox a la bitácora. En este caso el evento no se pierde: queda pendiente y se entrega después.

---

## 7. Integridad referencial y concurrencia

| Escenario | Resultado | Evidencia | ¿Vale en standalone? |
|---|---|---|---|
| Dos altas con los mismos datos en la **misma** instancia | Una 201 y otra 409 | X, I | Sí |
| Dos altas con los mismos datos en **dos instancias** del servicio | **Se crean dos pacientes** | X (E2: dos documentos) | No hay garantía; limitación documentada (D-04) |
| Variantes «Ana  María» (doble espacio) y «Ana Maria / Lopez» (sin tildes) | **Aceptadas como pacientes nuevos**; solo se detectan diferencias de mayúsculas | X (E3) | D-05 |
| Actualizaciones simultáneas de tutores o tratamiento | Concurrencia optimista: la segunda → 409 | U, I | Sí |
| Lectura mientras se actualiza | Consistente: lectura y escritura afectan a un solo documento | Diseño | Sí |
| Cambio de nacimiento con historial clínico | Rechazado (400); con una carrera, 409 sin escritura parcial | U, I (4 carreras deterministas) | Sí |
| Médico o vacuna inexistente | 422 | U, I | Sí. No hay borrado de catálogos que deje referencias colgantes |
| Aplicación repetida de la misma dosis (también simultánea) | Una 200 y otra 409 | I | Sí |
| Modificar un archivado | 409 en datos y tutores; las escrituras clínicas fallan por el filtro `Activo` | X, U | Sí |
| Fallo durante una actualización | `updateOne` es atómico: no hay escritura parcial | Diseño + I | Sí |
| Fallo de conexión con MongoDB | 500 `ERROR_INTERNO` tras el tiempo de selección del servidor (8 s en `db.js`); no hay mensaje específico | X (E7) | D-08 |
| Error al registrar auditoría (escritura clínica) | El evento queda en el outbox y se entrega después, sin pérdida ni duplicado | I | Sí |
| Error al registrar auditoría (lectura) | 503 sin datos | U, I | Sí |
| Error al registrar auditoría (alta de catálogo) | El alta queda hecha y el evento puede perderse | Código | Solo replica set lo garantiza |
| Reintentos | Entrega idempotente por `id_evento` único; alta con id automático reintenta 5 veces | I | Sí |
| Varios procesos de la API | Exclusión de identidad y limitador de peticiones en memoria por proceso; el reenvío del outbox es idempotente | Código | Solo duplicados de identidad sin garantía |

**Transacciones.** `withTransaction` solo se usa si `hello.setName` existe (replica set). El servidor real es standalone, así que **no hay transacciones multidocumento en producción**. Lo que garantiza la consistencia es la atomicidad por documento, los filtros condicionales y el outbox.

**Índices únicos esenciales.** La API no arranca sin ellos (`exigirIndicesEsenciales`), y eso está probado. Advertencia: `npm start` ejecuta `createIndex` en la base configurada. Es idempotente y no destructivo, pero es una escritura de metadatos que conviene mencionar.

---

## 8. Seguridad

| Aspecto | Evaluación |
|---|---|
| Autenticación | **De desarrollo**: `POST /auth/dev-login` sin contraseña, solo desde loopback y deshabilitado en producción. JWT HS256 con `iss`, `aud` y `exp` obligatorios. Rechaza `alg:none`, tokens alterados, ajenos y sin `exp` (pruebas). **No hay inicio de sesión real (grupal).** |
| Roles y permisos | Una sola tabla (`permisos.js`) para las rutas y la sesión. Prueba de 12 permisos × 3 roles y verificación HTTP directa (X-E5): **Secretaría recibe 403 en las 12 rutas clínicas y de auditoría**; Médico 403 en archivados, datos administrativos y altas de catálogo |
| Expedientes archivados | Médico 403 en el historial y en los datos administrativos; administrador 200; escrituras 409 |
| Validación de entradas | Zod `.strict()` en cuerpos y consultas; `q[$ne]` → 400; `$set` o `estado_historial` en el cuerpo → 400; parámetros de ruta con patrón; JSON ≤ 100 KB; regex escapadas |
| Datos sensibles | DPI enmascarado para Médico; el listado no incluye el DPI; la búsqueda por DPI solo es exacta y administrativa; los 500 no dan detalles; los cuerpos no se registran |
| Errores HTTP | Formato `{error, codigo}` estable (prueba U) |
| Separación de instituciones | Un token de otra institución → 403 `INSTITUCION_NO_REGISTRADA` (X) |
| Auditoría | Lecturas, escrituras, denegaciones y dev-login auditados (10 eventos DENEGADO en X-E5). **No se audita la lectura de la bitácora** (D-11) |
| CORS | Desactivado por defecto; lista blanca explícita con `CORS_ORIGIN`, sin credenciales |
| Cabeceras | `nosniff`, `X-Frame-Options: DENY`, `no-referrer`, COOP, `no-store`. **Sin Content-Security-Policy** (D-14) |
| Token en el frontend | `sessionStorage` (se borra al cerrar la pestaña); expuesto a XSS si existiera (React escapa la salida; no hay `dangerouslySetInnerHTML` en Pediatría) |
| Base de datos | Usuario `readWrite` limitado a la base; credenciales solo en `.env`, que está fuera de Git |
| Riesgo al publicar en GitHub | Se revisó el diff de `467f050`: no hay secretos, URIs con contraseña, tokens ni respaldos. `.gitignore` cubre `.env`, `respaldos/` y los volcados. Los datos de pacientes son ficticios. Mantener el repositorio privado |

**Conclusión:** la seguridad es adecuada para el alcance académico. No debe presentarse como autenticación productiva.

---

## 9. Integración frontend → backend → MongoDB

Se recorrieron todas las páginas de `instituciones/pediatria/frontend/`. Cada llamada de `api.js` corresponde a una ruta real del backend, y las páginas solo usan ese cliente. El flujo es:

Interfaz → `@plataforma/api/http.js` (Bearer, 401 → cierre de sesión, `ApiError`) → `enrutadorInstituciones` → `requireAuth` → `roles(permiso)` → Zod → servicio → repositorio → MongoDB → JSON.

| Funcionalidad | Página | Endpoint | Conectada | Recarga tras guardar | Errores y permisos |
|---|---|---|---|---|---|
| Panel | `Panel.jsx` | `GET /api/panel` | Sí | — | Contadores según el rol |
| Listado, búsqueda y filtros | `Pacientes.jsx`, `Archivados.jsx` | `GET /api/pacientes` (+ `/api/panel` para métricas) | Sí | — | Archivados solo con permiso |
| Registro | `PacienteNuevo.jsx` | `POST /api/pacientes` | Sí | Navega al expediente | Validación previa equivalente; muestra `detalles` del 400 |
| Expediente | `Expediente.jsx` | `GET /:id` (clínico) o `/:id/administrativo` (Secretaría) | Sí | `recargar()` | Pestañas según permisos |
| Datos y tutores | `expediente/Resumen.jsx` | `PATCH /:id`, `POST`/`PUT` tutores | Sí | Sí | 409 visible |
| Consultas, diagnósticos, tratamiento y receta | `NuevaConsulta.jsx`, `expediente/Consultas.jsx` | `POST`/`PUT` correspondientes; rango de fechas | Sí | Sí | — |
| Prescripciones | `expediente/Prescripciones.jsx` | `GET …/prescripciones` | Sí | — | — |
| Crecimiento y gráficas | `expediente/Crecimiento.jsx` | `GET`/`POST …/crecimiento` | Sí | Sí | — |
| Vacunación por paciente | `expediente/VacunacionPaciente.jsx` | programar, aplicar y cancelar | Sí | Sí | Confirmaciones |
| Vacunación global y médicos | `Vacunacion.jsx`, `Medicos.jsx` | pendientes y catálogos | Sí (solo lectura) | — | — |
| Auditoría | `Auditoria.jsx`, `expediente/AuditoriaPaciente.jsx` | `GET /api/auditoria` | Sí | — | Solo administrador |
| Archivar | Diálogo en `Expediente.jsx` | `PATCH …/archivar` | Sí | Sí | Solo administrador |

- **Pantallas decorativas en Pediatría:** no hay. Los únicos controles no funcionales del recorrido pediátrico son los **campos de «Acceso institucional» del Login común**: están deshabilitados y rotulados como pendientes.
- **Disponible solo por API:**
  - altas de médicos y vacunas;
  - reemplazo completo de tutores (`PATCH /tutores`);
  - `GET /diagnosticos`;
  - `GET /api/medicos/:id`.
- **No existen ni por API:**
  - edición o desactivación de catálogos;
  - corrección de una consulta registrada (inmutabilidad deliberada);
  - reprogramar una dosis sin cancelarla.
- **Estado tras un fallo:** cuando el envío falla, los formularios conservan lo capturado y muestran el error. Las métricas pueden seguir mostrando datos anteriores durante una recarga fallida, como ya señalaba la revisión del 29/10.
- **Validación:** el frontend repite las reglas principales (fechas futuras y anteriores al nacimiento, campos obligatorios, medicamentos completos) y el servidor sigue siendo la autoridad. No se comprobó campo por campo que todas las reglas de Zod tengan su equivalente en la interfaz.

---

## 10. Funcionalidades implementadas

- Registro de pacientes con tutores y búsqueda; edición administrativa.
- Expediente completo con pestañas.
- Consulta compuesta: diagnósticos, tratamiento con versiones, recetas y control, en una sola operación atómica.
- Crecimiento con gráfica.
- Vacunación: programar, aplicar, cancelar y ver pendientes.
- Archivo lógico con motivo; vista de archivados.
- Catálogos de consulta.
- Bitácora con outbox.
- Panel por rol.
- Permisos por rol y DPI enmascarado.
- Respaldo y restauración aislada (scripts).
- Validadores `$jsonSchema` con verificación, respaldo, aplicación y reversión.
- Temas claro y oscuro, diseño adaptable y accesibilidad básica verificada.

## 11. Funcionalidades incompletas

| Funcionalidad | Qué falta | ¿De quién? |
|---|---|---|
| Inicio de sesión real | Usuarios, contraseñas o proveedor de identidad; el Login institucional es decorativo | Grupal |
| Gestión de catálogos | Interfaz de altas; edición y desactivación | Pediatría (opcional; no lo exige la Fase I pediátrica) |
| Reprogramar dosis | Solo cancelar y volver a programar | Pediatría (opcional) |
| Garantía de identidad entre instancias | Índice o identificador oficial (ver `MODELO_Y_DECISIONES.md` §4.1) | Pediatría / decisión del equipo |
| Transacciones en el servidor real | Replica set (requiere autorización) | Pediatría / administrador |
| Equivalencia entre motores y documento comparativo | Los otros tres motores | Grupal |

---

## 12. Defectos encontrados (con evidencia reproducible)

Scripts de esta auditoría, fuera del repositorio:
- Experimentos sobre `mongod` desechable: `C:\Users\abela\AppData\Local\Temp\claude\C--Users-abela-OneDrive-Pictures-BASES-DE-DATOS-PROYECTO-centro-pediatrico-fase2\e7a70414-5e2a-4bd4-9cab-e412a193124b\scratchpad\experimentos-desechable.js`
- Inspección de solo lectura de la base real: `C:\Users\abela\AppData\Local\Temp\claude\C--Users-abela-OneDrive-Pictures-BASES-DE-DATOS-PROYECTO-centro-pediatrico-fase2\e7a70414-5e2a-4bd4-9cab-e412a193124b\scratchpad\inspeccion-lectura.js`

### CRÍTICO

Ninguno confirmado.

### ALTO

**D-01. Un `id_paciente` manual grande inutiliza la generación automática de identificadores.**
- **Ubicación:** `backend/adapters/mongo/repositorios.js:51-58` (`siguienteId`: `$toInt` sobre `$substrCP`); `schema.js:31` acepta cualquier `id` de 1 a 40 caracteres en el alta.
- **Evidencia (X-E1):**
  1. alta automática → `P001`;
  2. alta con `id_paciente: "P99999999999"` → 201;
  3. siguiente alta automática → error `241` `Failed to parse number '99999999999' in $convert … Overflow`, que por HTTP llega como 500 `ERROR_INTERNO`.

  Lo mismo pasa con `P1234567890123456789`.
- **Reproducir:** Secretaría o administrador hace `POST /api/pacientes` con `id_paciente` = `P` + 10 o más dígitos (> 2 147 483 647) y después un alta normal desde la interfaz.
- **Impacto:**
  - El registro de pacientes sin identificador manual (el único que ofrece la interfaz) queda **bloqueado para todos** hasta corregir ese documento a mano.
  - No hay pérdida de datos.
  - Las pruebas no lo detectan porque el doble en memoria usa `Number()` (`tests/doubles/memoria.js:20-23`).
- **Recomendación** (una de estas):
  - restringir el `id_paciente` manual al patrón `^P\d{1,9}$`, o eliminar el id manual del contrato de alta;
  - usar `$convert` con `onError`/`onNull`, o `$toLong`/`$toDecimal`, y excluir ids fuera de rango;
  - o mejor, un contador atómico (`findOneAndUpdate` con `$inc` en una colección `contadores`).

  Añadir una regresión en `mongo.integration.test.js` y alinear el doble.
- **Estado: CORREGIDO (31/10/2026).**
  - **Causa raíz:** `siguienteId` aplicaba `$toInt` a la parte numérica de cualquier id `P<dígitos>`. Por encima de 2 147 483 647 desbordaba int32 (error 241), que llegaba como 500. Además, la API aceptaba ids manuales con esa forma, así que un alta manual podía adelantar, agotar o romper la secuencia. El doble usaba `Number()` y con 40 dígitos habría generado `P1e+39`.
  - **Problema relacionado encontrado al probar:** con 8 altas automáticas simultáneas en MongoDB, una agotaba sus 5 reintentos («No fue posible asignar un identificador», 409).
  - **Corrección:**
    - La regla está en `backend/domain/reglas.js` (`ID_PACIENTE_AUTOMATICO`, `esIdPacienteReservado`, `siguienteIdPaciente`).
    - La secuencia solo cuenta `P` + 1–9 dígitos; la conversión cabe siempre en int32 y los ids heredados más largos se ignoran.
    - La forma `P` + dígitos queda reservada al sistema: un id manual con esa forma → **400 `REGLA_NEGOCIO`**.
    - Secuencia agotada (`P999999999`) → **409** controlado, sin insertar ni reintentar en bucle.
    - En una instancia, las altas automáticas toman el correlativo de una en una (`pacientesService.js`). Entre instancias, el índice único impide duplicados y el alta se recalcula hasta 5 veces.
    - El doble en memoria aplica la misma regla.
  - **Pruebas:** `tests/identificador-paciente.test.js`, 14 pruebas en doble y `mongod` desechable. Con el código anterior fallaban 9, entre ellas la reproducción del error 241. Cubren alta normal, id manual válido y duplicado, ids reservados e inválidos, ids heredados de 11, 19 y 40 dígitos, ceros a la izquierda y huecos, secuencia agotada, 8 altas simultáneas y dos instancias, con el mismo resultado en el doble y en MongoDB. Se adaptaron dos casos de `api.test.js` que usaban el id manual `P001`.
  - **Compatibilidad con la base real (solo lectura):** ids `P001`–`P005`; el siguiente sigue siendo `P006`. No hay migración ni colecciones nuevas.
  - **Limitaciones restantes:**
    - Entre varias instancias se reintenta hasta 5 veces: con mucha concurrencia entre procesos puede responder 409 «vuelva a intentarlo», nunca un duplicado ni un 500. Una garantía completa requeriría un contador atómico (colección nueva).
    - Un `P999999999` cargado directamente en la base agotaría la secuencia (409 controlado).
    - Los ids manuales `P…` existentes antes de la corrección se conservan; los que superan 9 dígitos se ignoran.
    - Cambio de contrato: un `id_paciente` manual `P###` ahora da 400. La interfaz no envía id.

### MEDIO

**D-03. El informe de Fase II versionado está desactualizado.**
- **Ubicación:** `instituciones/pediatria/docs/Informe_Fase2_Centro_Pediatrico.pdf`. Además, no coincide con la copia de Descargas (MD5 distinto).
- **Evidencia:** cita «61 pruebas» y rutas `src/domain`, `src/ports`, `frontend/src`, anteriores al monorepositorio. Hoy hay 148 pruebas y otras rutas, y no aparecen las correcciones de integridad y auditoría.
- **Impacto:** es un entregable académico que contradice el código y el README.
- **Recomendación:** regenerarlo a partir del estado actual y decidir cuál es la copia oficial.

**D-04. La unicidad de identidad no cubre varias instancias.**
- **Ubicación:** `application/pacientesService.js:105-115`.
- **Evidencia (X-E2):** dos instancias de servicio sobre la misma base → las dos altas responden 201 y quedan **2 documentos**. En la misma instancia, 201 y 409.
- **Impacto:** la API real corre como un solo proceso, así que hoy no ocurre. Pero es una limitación que el profesor puede preguntar.
- **Recomendación:** está documentada en `MODELO_Y_DECISIONES.md` §4.1. Si se quiere una garantía en la base, la opción D (identificador oficial con índice único parcial) o una reserva con clave única normalizada.

**D-05. La detección de duplicados no normaliza espacios ni tildes.**
- **Ubicación:** `repositorios.js:60-65` (regex anclada `i` sobre el texto recortado).
- **Evidencia (X-E3):** con «Ana María López» registrada, «Ana  María López» y «Ana Maria Lopez» se aceptan como pacientes nuevos; «ANA MARÍA LÓPEZ» → 409.
- **Impacto:** duplicados aparentes por errores de digitación.
- **Recomendación:** colapsar espacios internos en Zod y comparar con *collation* `es` `strength:1`, o con una clave normalizada. En caso de coincidencia aproximada, advertir y pedir confirmación (opción E).

**D-06. Las pruebas no detectan diferencias entre el doble en memoria y MongoDB en la generación de ids.**
- Es la causa de que D-01 no se detectara.
- **Recomendación:** que `siguienteId` también se pruebe contra el `mongod` desechable.
- **Estado: CORREGIDO** junto con D-01. `identificador-paciente.test.js` compara el doble y MongoDB en los mismos escenarios.

### BAJO

**D-07. El listado usa SORT en memoria.**
- **Ubicación:** `repositorios.js:89`.
- **Evidencia:** con 20 000 pacientes, `explain` muestra `SORT ← FETCH ← IXSCAN` y **18 006 documentos examinados** para devolver 25. Sin el desempate por `id_paciente`, el mismo plan examina 25. `estado=Todos` → COLLSCAN + SORT. `buscarDuplicado` → COLLSCAN.
- **Tiempos medidos:** 45–66 ms por página con 20 000 pacientes.
- **Recomendación:** añadir `id_paciente` al índice compuesto (`estado_historial, apellidos, nombres, id_paciente`), en un cambio autorizado, y un índice que incluya `fecha_nacimiento` para la detección de duplicados. Sin urgencia para el volumen académico.

**D-08. Si MongoDB no está disponible, la respuesta es 500 genérico.**
- Tras unos 8 s (el tiempo de selección del servidor) llega `ERROR_INTERNO`; no hay `503` ni mensaje claro.
- **Recomendación:** traducir `MongoServerSelectionError`/`MongoNetworkError` a `503 BASE_DATOS_NO_DISPONIBLE`.

**D-09. La matriz de trazabilidad cita mal su fuente.**
- F1-15 a F1-18 atribuyen a la Fase I pediátrica las operaciones del catálogo del Hospital General (§2.3).
- **Recomendación:** reclasificarlas como «extensión» y citar la sección correcta.

**D-10. Hay datos heredados sin trazas en la base real.**
- P003 archivado sin `archivado_por`; C001 de P001 sin `registrado_por`; 44 eventos sin `id_evento`.
- Son válidos para el validador. Es mejor **explicarlos** en la defensa (son de antes de la Fase II) que «corregirlos» a mano.

**D-11. Hay lecturas sensibles que no se auditan.**
- `GET /api/auditoria` (no hay eventos de lectura de la bitácora: X-E5).
- La denegación de `obtenerAdministrativo` sobre un archivado (`pacientesService.js:169-177`, a diferencia de `leerHistorial`).
- **Recomendación:** auditarlas igual que las demás.

**D-12. Filtros y ordenamientos en la aplicación.**
- El rango de fechas de consultas, la vista plana de diagnósticos y prescripciones, y el orden del crecimiento se calculan en Node tras leer el documento completo.
- Es correcto mientras el documento sea pequeño. Si el profesor pide «consultas en MongoDB», conviene saber mostrar la alternativa: `$filter`/`$unwind` en `aggregate`.

**D-13. Trabajo y auditoría duplicados en el panel.**
- Para Secretaría, `GET /api/panel` calcula todas las agregaciones clínicas aunque solo devuelve dos contadores.
- Para los roles clínicos registra `LEER_PANEL` y además `LEER_VACUNACION_PENDIENTE`.
- `Pacientes.jsx` también llama al panel.

**D-14. Falta una Content-Security-Policy.**
- Además, el JWT se guarda en `sessionStorage`. Es aceptable en el alcance académico; para producción convendría CSP y valorar cookies `HttpOnly`.

**D-15. El validador `$jsonSchema` no expresa la coherencia de estados.**
- Evidencia (X-E4): por escritura directa se aceptan una dosis `Aplicada` sin fecha ni lote, un `Archivado` sin motivo, dos tutores principales y un `id_vacuna` inexistente.
- Las reglas están en el dominio y en los filtros, así que la API no lo permite. Es una limitación conocida de JSON Schema para referencias. Podría reforzarse con `oneOf` o `if`/`then`.

**D-16. Las altas de catálogo en standalone no son atómicas con su auditoría.**
- Está documentado. Solo un replica set lo resuelve.

---

## 13. Riesgos técnicos

1. **`main` todavía no contiene `467f050`** (PR #1 pendiente de aprobación). Si se entrega desde `main`, faltan las correcciones de integridad y auditoría.
2. **La API escribe índices al arrancar.** Si se arranca contra una base equivocada, crea índices en ella. Es idempotente y no destructivo.
3. **Si falla la bitácora, se bloquean las lecturas** (decisión deliberada: hay que operarla).
4. **El limitador de peticiones y la exclusión de identidad están en memoria**: no son válidos con varios procesos.
5. **La seguridad depende de `JWT_SECRET`**: no hay rotación ni revocación de tokens; el token de desarrollo dura 8 h.
6. **El documento crece**: con muchas consultas por paciente se acercaría a 16 MiB; hay un plan *subset* documentado.
7. **La asignación de motores sigue sin confirmar** y la [F1] repite MySQL (riesgo académico grupal).

---

## 14. Pruebas ejecutadas y resultados

Todas sobre el commit `467f050`, el 31/10/2026. Las escrituras se hicieron solo en memoria o en `mongod` desechable.

| Comando / experimento | Resultado |
|---|---|
| `npm test` | 134/134 (30 de plataforma + 104 de Pediatría), 0 fallidas, 0 omitidas. **Tras corregir D-01: 148/148 (30 + 118)** |
| `npm run build` | Correcta |
| `npm run test:e2e` | 27/27; accesibilidad básica y contraste WCAG AA sin problemas |
| `npm run test:e2e:vista-previa` | 12/12; consola sin errores |
| `git diff --check` | Sin errores |
| `npm run db:diagnostico` (solo lectura, base real) | 4 colecciones, 104 documentos, índices esperados |
| `npm run db:validadores` (solo lectura, base real) | 4 validadores, perímetro opcional, 0 documentos que incumplen |
| Inspección de solo lectura de la base real (script de §12) | Validadores idénticos al código; integridad sin hallazgos salvo D-10; `explain` de 10 consultas |
| Experimentos sobre `mongod` desechable (script de §12) | E1 confirma D-01 · E2 D-04 · E3 D-05 · E4 D-15 · E5 autorización correcta en todas las rutas · E6 volumen de 20 000 (D-07) · E7 caída de MongoDB (D-08) |
| `npm run db:restaurar-aislado` | **No ejecutado:** escribe un registro dentro de la carpeta del respaldo, y la consigna prohíbe modificar respaldos. El último simulacro documentado es del 25/10/2026 |

---

## 15. Cobertura de pruebas que falta

1. ~~`siguienteId` contra MongoDB real con ids grandes o no numéricos (D-01 y D-06).~~ Cubierto por `identificador-paciente.test.js`.
2. Duplicados con dos instancias del servicio y variantes de espacios y tildes (D-04 y D-05).
3. Caída de MongoDB durante una petición: código y mensaje esperados (D-08).
4. Auditoría de `GET /api/auditoria` y de la denegación administrativa sobre archivados (D-11).
5. Paginación con volumen y estabilidad del orden entre páginas; `explain` como prueba de regresión de índices (D-07).
6. Validador frente a estados incoherentes, si se decide reforzarlo (D-15).
7. Fallo **entre** el `updateOne` y la entrega del outbox con el proceso detenido (hoy se prueba la bitácora caída, no la caída del proceso).
8. Equivalencia campo por campo entre las validaciones del frontend y las de Zod.
9. Simulacro completo de respaldo y restauración en una carpeta de prueba separada, para no escribir en `respaldos/`.

---

## 16. Recomendaciones priorizadas

**Indispensables antes de la entrega**

1. ~~Corregir D-01 y su regresión en MongoDB real (D-06).~~ Hecho (31/10/2026).
2. Regenerar `Informe_Fase2_Centro_Pediatrico.pdf` con el estado actual (D-03).
3. Integrar el PR #1 en `main` cuando esté aprobado y entregar desde `main`.
4. Corregir la cita de fuentes en `TRAZABILIDAD_REQUISITOS.md` (D-09).
5. Preparar la justificación de los estados `Pendiente`/`Aplicada`/`Cancelada` frente a los de la Fase I, y la de standalone frente a replica set.

**Recomendables**

6. Normalizar la identidad al detectar duplicados (D-05) y decidir la política de identidad del equipo (D-04).
7. Responder 503 cuando MongoDB no esté disponible (D-08).
8. Auditar la lectura de la bitácora y la denegación administrativa (D-11).

**Opcionales**

9. Índice compuesto con `id_paciente` (D-07), filtros en `aggregate` (D-12), optimizar el panel (D-13), CSP (D-14), validador de estados (D-15), gestión de catálogos desde la interfaz, reprogramación de dosis y replica set en el servidor real.

---

## 17. Preguntas probables del profesor en la defensa

1. ¿Por qué MongoDB para Pediatría y no para el Laboratorio, cuyos resultados varían en estructura?
2. ¿Qué embebió y qué referenció, y por qué? ¿Qué pasa al llegar a 16 MiB?
3. ¿Cómo garantiza la consistencia sin transacciones? Explique el outbox embebido y qué pasa si falla la copia a la bitácora.
4. ¿Probó transacciones reales? ¿Por qué el servidor no es un replica set?
5. ¿Cómo evita la doble aplicación de una vacuna con dos peticiones simultáneas? (filtro `estado:'Pendiente'` en `updateOne`).
6. ¿Cómo evita duplicar pacientes? ¿Y con dos servidores a la vez? (D-04, §4.1)
7. ¿Qué índices creó y cuáles usa cada consulta? Muestre un `explain()`.
8. ¿Qué valida `$jsonSchema` y qué valida la aplicación? ¿Por qué en los dos niveles?
9. ¿Cómo aplica la clasificación de la información de la Fase I? Demuestre que Secretaría no ve datos clínicos ni siquiera por la API.
10. ¿Cómo funciona el enrutamiento por usuario hacia el motor de la institución?
11. ¿Dónde está la arquitectura hexagonal? ¿Qué cambiaría para usar PostgreSQL?
12. ¿Por qué «Cancelada» en lugar de «omitida»? ¿Dónde quedó «programada»?
13. ¿Cómo se archiva un historial y quién puede verlo después?
14. ¿El inicio de sesión es real? ¿Qué falta para producción?
15. ¿Cómo respalda y restaura la base sin riesgo?
16. ¿Cómo maneja las fechas y las zonas horarias (nacimiento a medianoche UTC)?

---

## 18. Dictamen final

1. **¿Mi parte cumple los requisitos originales del profesor?** Sí, en todo lo que corresponde a una institución individual con MongoDB, según el enunciado y la Fase I pediátrica. Dos puntos no son verificables o no le corresponden: la «corrección según la retroalimentación», porque no hay retroalimentación, y los requisitos grupales (cuatro motores, equivalencia y documento comparativo conjunto).
2. **¿MongoDB está correctamente diseñada e integrada?** Sí:
   - el modelo documental está justificado y coincide con la Fase I;
   - los validadores instalados son idénticos al código;
   - la integridad de la base real es correcta;
   - los índices únicos son esenciales para el arranque.

   Mejoras menores: el orden de listado (D-07) y la coherencia de estados en el validador (D-15).
3. **¿Funcionan todas las consultas y operaciones requeridas?** Sí, las 20 inventariadas. La excepción encontrada, el bloqueo del id automático (D-01), ya está corregida.
4. **¿Hay problemas de integridad o concurrencia?** Dentro de una instancia no se encontraron. Las carreras de dosis, tratamiento, tutores, nacimiento e identidad están protegidas y probadas en standalone y replica set. Entre instancias, los duplicados de identidad no están garantizados (D-04). Además, las variantes de nombre se aceptan como pacientes distintos (D-05).
5. **¿El frontend pediátrico está realmente conectado al backend?** Sí. Todas sus pantallas usan endpoints reales sobre MongoDB y no hay pantallas decorativas en el módulo. Lo único decorativo son los campos de acceso institucional del Login común.
6. **¿La seguridad es adecuada para el alcance académico?** Sí. La autorización se verificó por HTTP directo, la entrada se valida de forma estricta y los datos sensibles están protegidos. La autenticación sigue siendo de desarrollo.
7. **¿Qué funcionalidades faltan?**
   - De Pediatría, opcionales: gestión de catálogos desde la interfaz, edición y desactivación de catálogos, reprogramación de dosis, garantía de identidad entre instancias y replica set.
   - Grupales: inicio de sesión real, los otros tres motores, consultas equivalentes y documento comparativo.
8. **Los cinco problemas más importantes:**
   1. D-01 (id automático), ya corregido.
   2. D-03 (informe PDF desactualizado).
   3. `main` sin las correcciones (PR #1).
   4. D-05 y D-04 (detección de duplicados).
   5. D-08 (fallo de MongoDB como 500 genérico).
9. **¿Está lista para entregarse y defenderse?** Casi. D-01 ya está corregido; falta regenerar el informe y entregar desde un `main` actualizado. Con eso, la parte pediátrica es defendible con evidencia. Las limitaciones restantes (standalone sin transacciones, identidad entre instancias, autenticación de desarrollo) están documentadas y deben explicarse, no ocultarse.
10. **Indispensables y opcionales:**
    - **Indispensables:** recomendaciones 1 a 5 de §16.
    - **Recomendables:** 6 a 8.
    - **Opcionales:** 9.
