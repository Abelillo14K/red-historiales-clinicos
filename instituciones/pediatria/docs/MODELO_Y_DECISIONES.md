# Centro Médico Pediátrico — modelo documental, consistencia y seguridad (MongoDB)

Insumo del integrante 2 para el documento comparativo de la Entrega II. Conserva el diseño de la Fase I y marca como **extensión Fase II** lo agregado.

## 1. Asignación del motor

El centro pediátrico consulta casi siempre **un paciente completo** (datos, tutores, consultas, crecimiento y vacunas), registra **consultas frecuentes y cortas** y acumula **series históricas** (mediciones y dosis). La estructura varía poco entre pacientes, pero crece con el tiempo y no requiere joins complejos. MongoDB permite leer el historial en una sola operación y agregar cada atención con una actualización atómica sobre ese documento.

## 2. Colecciones, campos y relaciones

| Colección | Rol | Campos |
|---|---|---|
| `pacientes` | Principal (Fase I) | `id_paciente`, `nombres`, `apellidos`, `fecha_nacimiento`, `sexo`, `estado_historial`, `tutores[]`, `consultas[]`, `controles_crecimiento[]`, `esquema_vacunacion[]` · **Fase II:** `fecha_registro`, `registrado_por`, `ultima_actualizacion`, `fecha_archivado`, `motivo_archivado`, `archivado_por`, `bitacora_pendiente[]` (interna) |
| `medicos` | Catálogo referenciado (Fase I) | `id_medico`, `colegiado`, `nombres`, `apellidos`, `especialidad{id_especialidad, nombre}` |
| `vacunas` | Catálogo referenciado (Fase I) | `id_vacuna`, `nombre`, `descripcion` |
| `bitacora_acceso` | Auditoría (**extensión Fase II**) | `id_evento`, `id_usuario`, `rol`, `id_paciente`, `accion`, `recurso`, `referencia`, `resultado`, `fecha_hora`, `detalle` |

Subdocumentos:
- `tutores[]`: `id_tutor`, `dpi`, `nombres`, `apellidos`, `telefono`, `correo`, `direccion`, `parentesco`, `es_principal`.
- `consultas[]`: `id_consulta`, `id_medico` → `medicos`, `fecha_hora`, `motivo`, `observaciones` · **Fase II:** `diagnosticos[{codigo, descripcion}]`, `tratamiento{descripcion, recomendaciones}`, `tratamientos_anteriores[]`, `prescripciones[{id_prescripcion, fecha_emision, indicaciones_generales, medicamentos[{id_medicamento, nombre, dosis, frecuencia, duracion, via_administracion}]}]`, `registrado_por`.
- `controles_crecimiento[]`: `id_control`, `id_consulta` → consulta del mismo documento, `fecha`, `peso_kg`, `talla_cm`, `perimetro_cefalico_cm` (opcional, "si corresponde").
- `esquema_vacunacion[]`: `id_esquema`, `id_vacuna` → `vacunas`, `numero_dosis`, `fecha_programada`, `estado` (`Pendiente`/`Aplicada`/`Cancelada`; Cancelada equivale a la "omitida" de la Fase I), `fecha_aplicacion`, `lote`, `id_medico` → `medicos` · **Fase II:** `motivo_cancelacion`, `programado_por`, `aplicado_por`, `cancelado_por`.

Todas las fechas se guardan como **BSON Date** (UTC). `fecha_nacimiento` y `fecha_programada` son fechas sin hora: se guardan a medianoche UTC y la interfaz las muestra en UTC; las fechas con hora se muestran en hora local.

## 3. Embebido frente a referenciado

| Dato | Decisión | Justificación |
|---|---|---|
| Tutores | Embebido | Pertenecen al paciente, son pocos (máximo 10) y se muestran con él. Un tutor de hermanos se repite; se acepta porque su contacto puede diferir por paciente, y `tutores.dpi` se indexa para búsquedas. |
| Consultas, con diagnósticos, tratamiento y prescripciones | Embebido | Se consultan siempre dentro del historial. Registrar una consulta completa (con receta y control) es **un solo `$push` atómico**. Una prescripción no tiene sentido fuera de su consulta. |
| Controles de crecimiento | Embebido | Serie histórica corta que se grafica completa; cada control referencia una consulta del mismo documento (validado en la misma operación). |
| Esquema de vacunación | Embebido con referencias | Estado propio por paciente, modificado con el operador posicional `$`; vacuna y médico se referencian por id. |
| Médicos | Referenciado | Un médico atiende a muchos pacientes; embebido duplicaría datos y obligaría a actualizar muchos documentos si cambia su especialidad. |
| Vacunas | Referenciado | Catálogo compartido por todos los esquemas. |
| Bitácora | Colección separada | Crece sin límite y se consulta por usuario, fecha o paciente. Solo se embebe **temporalmente** un evento pendiente de entrega (outbox, §6). |

**Límite de 16 MiB:** una consulta con receta ocupa aproximadamente 1–2 KB; un paciente con 2 000 consultas rondaría 4 MB, suficiente para un centro pediátrico (pacientes hasta la adolescencia). Si se superara, `consultas` pasaría a una colección propia (patrón *subset*: las últimas N embebidas); con la arquitectura hexagonal solo cambiaría el adaptador.

## 4. Índices

| Colección | Índice | Propósito |
|---|---|---|
| pacientes | `id_paciente` único | Identificador y unicidad |
| pacientes | `tutores.dpi` | Búsqueda por DPI (solo roles administrativos) |
| pacientes | `estado_historial, apellidos, nombres` | Listado y filtros |
| pacientes | `bitacora_pendiente.id_evento` (sparse) | Localizar eventos de auditoría pendientes |
| medicos | `id_medico` único, `colegiado` único | Referencias y unicidad profesional |
| vacunas | `id_vacuna` único | Referencias |
| bitacora_acceso | `id_paciente, fecha_hora`; `fecha_hora` | Consulta de auditoría |
| bitacora_acceso | `id_evento` único parcial (solo si es texto) | Entrega idempotente del outbox; no afecta eventos anteriores |

Todos se crean con `createIndex` (idempotente, no destructivo) al iniciar la API o con `npm run db:indices`.

### 4.1 Índice único de identidad de pacientes (evaluado, **no implementado**)

**Situación actual.** Al registrar, la API rechaza (409) un paciente con los mismos nombres, apellidos y fecha de nacimiento que otro, sin distinguir mayúsculas. Desde la auditoría del 24/10/2026, las altas con la misma clave se ejecutan una tras otra dentro del proceso de la API, así que dos peticiones simultáneas ya no crean duplicados. La base no tiene ninguna restricción sobre esos campos.

**Premisa.** Dos pacientes distintos **pueden** compartir nombres, apellidos y fecha de nacimiento: homónimos con nombres frecuentes, o gemelos inscritos con el mismo nombre por error. Esa combinación sirve para detectar un *posible* duplicado, no para identificar a una persona. La regla actual ya tiene ese límite: hoy el segundo homónimo no se puede registrar sin cambiar algún dato.

| Opción | Ventajas | Riesgos y costes |
|---|---|---|
| A. Mantener la exclusión en el proceso (actual) | Sin cambios de esquema ni de datos; ya está probada con mongod real | Solo protege a una instancia de la API; no cubre escrituras desde mongosh ni varias instancias |
| B. Índice único con *collation* (`nombres, apellidos, fecha_nacimiento`, `locale: 'es'`, `strength: 2`) | La base lo garantiza ante cualquier instancia o cliente; no requiere campo nuevo; hoy hay 0 duplicados, así que se podría crear | **Convierte la heurística en una prohibición definitiva**: un homónimo real no podría registrarse nunca. Abarca también a los archivados. Un error 11000 se mostraría como "Identificador duplicado" si no se adapta el mensaje. Cualquier diferencia de espacios o tildes deja pasar duplicados aparentes |
| C. Campo normalizado (`clave_identidad`) + índice único | Normalización controlada: tildes, espacios, mayúsculas | Las mismas restricciones que B, además de un campo nuevo en documentos existentes, cambio de validador (`collMod`, rol dbAdmin) y migración de datos |
| D. Identificador oficial del paciente (p. ej. CUI de RENAP) con índice único **parcial** (solo cuando existe) | Identifica a la persona: los homónimos no chocan; un recién nacido sin CUI no queda bloqueado | Requiere capturar un dato nuevo (cambio del modelo de la Fase I y de los formularios) y decidir cómo tratarlo, porque es un dato personal sensible |
| E. Detección con confirmación: posible duplicado → advertencia; el usuario confirma con un motivo auditado | Respeta a los homónimos reales y conserva la protección contra registros dobles por error | Cambia la regla de negocio y la interfaz; para que la confirmación sea segura entre instancias se necesita además A, D o un documento de reserva con clave única |

Notas:
- **Las transacciones no lo resuelven por sí solas.** Con replica set, dos transacciones que leen "no existe" e insertan documentos distintos no entran en conflicto de escritura, y ambas se confirman.
- Un índice sobre `tutores.dpi` tampoco sirve: hermanos y gemelos comparten tutor.

**Recomendación.** No crear un índice único sobre nombres + apellidos + fecha de nacimiento (B o C), porque bloquearía de forma permanente a pacientes reales distintos. Mantener A mientras la API sea una sola instancia. Si el proyecto necesita una garantía en la base, la opción adecuada es D, y E si se quiere admitir homónimos sin identificador. Cualquiera de las dos cambia la política de identidad: debe decidirla el equipo.

## 5. Reglas de negocio (dominio, independientes del motor)

- Exactamente **un tutor principal**; sin `id_tutor` ni DPI repetidos en un paciente.
- Paciente duplicado (mismos nombres, apellidos y fecha de nacimiento) → 409.
- Fechas de consulta, control, receta y aplicación: **no futuras** (tolerancia de 5 min) ni **anteriores al nacimiento**; la receta no puede ser anterior a su consulta.
- Un control de crecimiento debe asociarse a una **consulta existente** del paciente.
- Una vacuna y número de dosis solo puede estar **programada o aplicada una vez** (una cancelada permite reprogramar).
- Solo una dosis **Pendiente** puede aplicarse o cancelarse; aplicar exige fecha, lote y médico existente.
- **Historial archivado = solo lectura** para cualquier rol; solo el administrador puede leerlo.
- Modificar un tratamiento **conserva la versión anterior** en `tratamientos_anteriores`.
- Médico y vacuna referenciados deben **existir** (422 si no).
- El sistema **no** genera dosis, calendarios ni recomendaciones clínicas: solo registra lo que captura el personal.

## 6. Consistencia

- **Atomicidad por documento:** cada caso de uso clínico se traduce en un único `updateOne` (o `insertOne`) con la condición de negocio en el filtro, así que verificación y cambio son indivisibles. Ejemplo: aplicar una dosis exige `estado: 'Pendiente'` en el filtro; con dos aplicaciones simultáneas, una responde 200 y la otra 409 (probado contra MongoDB real).
- **Concurrencia optimista:** reemplazar tutores o un tratamiento solo procede si el valor no cambió desde la lectura.
- **Auditoría sin transacciones (servidor actual, standalone):** *outbox* embebido. El evento viaja en el mismo `updateOne` que el cambio clínico (campo `bitacora_pendiente`), después se copia a `bitacora_acceso` de forma idempotente (`id_evento` único) y se retira. Si la copia falla, se reintenta al arrancar, cada 60 s y al consultar la auditoría. **Garantía:** ningún evento de una escritura confirmada se pierde ni se duplica. **No garantiza** que la bitácora se actualice en el mismo instante; las lecturas y los accesos denegados se insertan directamente (sin outbox).
- **Con replica set:** `UnidadDeTrabajo` usa `session.withTransaction`: escritura clínica y bitácora se confirman o revierten juntas. Verificado con un replica set desechable; el servidor del proyecto no lo es (plan en `instituciones/pediatria/docs/OPERACION_MONGODB.md`).
- **Integridad referencial:** MongoDB no tiene claves foráneas; los casos de uso verifican `id_medico`, `id_vacuna` e `id_consulta` antes de escribir. Los catálogos no exponen borrado, por lo que no quedan referencias colgantes.
- **Validación en dos niveles:** Zod en la API y `$jsonSchema` en MongoDB con las mismas reglas (`instituciones/pediatria/backend/adapters/mongo/validadores.js`). Hoy solo `pacientes` tiene validador instalado (la versión inicial); la de Fase II está lista y verificada (0 documentos incumplen), y su aplicación requiere un administrador.

## 7. Seguridad

| Medida | Aplicación |
|---|---|
| Autenticación | JWT HS256 con `iss`, `aud`, `exp` obligatorios y `institucion = centro_pediatrico`; se rechazan `alg: none`, firmas ajenas, tokens alterados y vencidos |
| Enrutamiento | La institución del token selecciona el módulo y su motor; otra institución → 403 |
| Autorización | Médico: lectura y escritura clínica. Secretaría: registro, datos generales y tutores, sin información clínica. Administrador: lectura completa, archivados, archivar, catálogos y auditoría |
| Clasificación de la Fase I | Datos restringidos (motivo, observaciones, crecimiento, vacunas) solo para médico y administrador. **DPI del tutor** (restringido): completo para secretaría y administración (lo capturan), **enmascarado** para el médico, y la búsqueda por DPI solo para roles administrativos |
| Auditoría | `bitacora_acceso`: lecturas, escrituras, accesos denegados e inicios de sesión de desarrollo, más trazas embebidas (`registrado_por`, `aplicado_por`, `archivado_por`, `reemplazado_por`) |
| Acceso de desarrollo | `/auth/dev-login` solo en `development`/`test` y solo para peticiones del propio equipo (127.0.0.1/::1), según `req.ip` con `trust proxy = loopback`. El proxy de Vite usa `xfwd: true`, así que con `vite --host` un equipo remoto se sigue viendo como remoto y un `X-Forwarded-For` manipulado no lo elude (`tests/vite-proxy.test.js`) |
| Archivado | No existe ninguna ruta de borrado |
| Base de datos | Usuario `app_pediatrica` con `readWrite` solo sobre `centro_pediatrico_db` (mínimo privilegio); credenciales solo en `.env` |
| Entrada | Zod estricto (rechaza campos desconocidos y operadores `$`), límites de tamaño, parámetros de ruta con patrón, JSON de 100 KB como máximo |
| Errores y cabeceras | Errores 500 sin detalles internos; `nosniff`, `X-Frame-Options: DENY`, `no-referrer`, `no-store` en la API |
