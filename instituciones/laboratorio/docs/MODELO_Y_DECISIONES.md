# Laboratorio Clínico — modelo relacional, consistencia y seguridad (PostgreSQL)

Insumo del laboratorio para el documento comparativo de la Entrega II. El esquema completo está en [`backend/adapters/postgres/esquema.sql`](../backend/adapters/postgres/esquema.sql).

## 1. Asignación del motor

El laboratorio trabaja con **estructuras fijas y muy relacionadas**: un paciente tiene solicitudes, cada solicitud tiene exámenes, cada examen tiene un resultado y cada resultado tiene un valor por parámetro, y todo apunta a catálogos (tipos de examen, parámetros, rangos, médicos y personal). Las operaciones importantes tocan varias tablas a la vez (crear una solicitud con sus exámenes, registrar los valores de un resultado y actualizar estados) y no pueden quedar a medias.

PostgreSQL ofrece justo eso: integridad referencial declarada, restricciones `CHECK`, transacciones ACID con bloqueo por fila, triggers y privilegios por rol. La «estructura variable» de los resultados no requiere un modelo documental: la define el catálogo (`tipo_examen_parametro`), de modo que un examen nuevo es una fila más, no un cambio de esquema.

## 2. Tablas (3FN)

| Tabla | Rol | Claves y relaciones |
|---|---|---|
| `paciente` | Datos generales, contacto y estado del historial | PK `id_paciente`; `documento_identidad` UNIQUE (opcional) |
| `medico_solicitante` | Catálogo de médicos que solicitan | `numero_colegiado` UNIQUE |
| `personal_laboratorio` | Quién valida; `usuario` = `sub` del JWT | `usuario` UNIQUE |
| `tipo_muestra` | Catálogo (sangre, orina…) | `nombre` UNIQUE |
| `tipo_examen` | Catálogo de exámenes | FK `id_tipo_muestra`; `nombre` UNIQUE |
| `parametro` | Catálogo de parámetros medibles | `nombre` UNIQUE; `tipo_dato` Numérico o Texto |
| `tipo_examen_parametro` | Parámetros de cada examen con su referencia y orden | PK (`id_tipo_examen`, `id_parametro`) |
| `solicitud` | La «consulta» del laboratorio | FK paciente y médico (opcional); `registrado_por` |
| `examen` | Examen dentro de una solicitud, con su muestra | FK solicitud y tipo; UNIQUE (`id_solicitud`, `id_tipo_examen`); `codigo_muestra` UNIQUE |
| `resultado` | Resultado del examen (1 a 1) | `id_examen` UNIQUE; FK `id_personal_valida` |
| `resultado_detalle` | Valor de cada parámetro | PK (`id_resultado`, `id_parametro`) |
| `bitacora` | Accesos y cambios (solo se agrega) | Sin FK: conserva el evento aunque el registro cambie |

Normalización: los nombres de examen, parámetro, unidad y rangos viven solo en los catálogos; `resultado_detalle` guarda solo el valor y la marca `fuera_de_rango` calculada al registrar (la referencia puede cambiar después sin alterar resultados ya emitidos). El estado de la solicitud se deriva del de sus exámenes en la capa de dominio.

## 3. Integridad declarada en el motor

| Regla | Cómo |
|---|---|
| Nunca se borra un historial | Todas las FK son `ON DELETE RESTRICT`; `app_laboratorio` no tiene `DELETE` ni `TRUNCATE` |
| Archivado coherente | `CHECK`: Activo sin fecha ni motivo; Archivado con ambos |
| Historial archivado en solo lectura | Trigger `trg_solicitud_paciente_activo` rechaza solicitudes nuevas aunque se escriba SQL directo |
| Resultado validado tiene responsable | `CHECK`: Validado exige `id_personal_valida` y `fecha_emision` |
| Un valor por parámetro, de un solo tipo | PK compuesta y `CHECK (num_nonnulls(valor_numerico, valor_texto) = 1)` |
| Rangos válidos | `CHECK (valor_ref_min <= valor_ref_max)` |
| Fechas razonables | `CHECK (fecha_nacimiento <= CURRENT_DATE)` y validación de fechas futuras en el dominio |

## 4. Consistencia y concurrencia

- **Transacciones:** cada escritura (y su evento de bitácora) corre en una unidad de trabajo `BEGIN … COMMIT`. Si algo falla, incluida la bitácora, `ROLLBACK` deshace todo: no quedan solicitudes sin exámenes ni cambios sin registro.
- **Bloqueo por fila:** registrar o validar un resultado bloquea el examen (`FOR UPDATE`) y comparte el paciente (`FOR SHARE`). Dos técnicos sobre el mismo examen se serializan, y nadie archiva al paciente a mitad de la operación. Archivar bloquea al paciente (`FOR UPDATE`) y luego actualiza con `WHERE estado_historial = 'Activo'`.
- **Unicidad sin carreras:** las claves únicas (documento, colegiado, código de muestra) las garantiza el índice. El adaptador traduce `23505` a `409 CONFLICTO` con un mensaje legible.
- **Pruebas:** registros simultáneos sobre un mismo examen y archivar mientras se crea una solicitud (`tests/postgres.integration.test.js`).

## 5. Índices

| Índice | Consulta que atiende |
|---|---|
| `paciente (estado_historial, apellidos, nombres)` | Listado y búsqueda de activos o archivados |
| `solicitud (id_paciente, fecha_solicitud DESC)` | Expediente: solicitudes del paciente, más reciente primero |
| `solicitud (estado, fecha_solicitud DESC)` | Bandeja de solicitudes por estado |
| `examen (id_tipo_examen)`, `resultado_detalle (id_parametro)` | Catálogos en uso e historial por parámetro |
| `bitacora (id_paciente, fecha_hora DESC)`, `bitacora (fecha_hora DESC)` | Auditoría por paciente y reciente |

Más los índices implícitos de cada PK y UNIQUE.

## 6. Seguridad

- **Mínimo privilegio:** la aplicación se conecta como `app_laboratorio` (`SELECT, INSERT, UPDATE`; sin `DELETE`, `TRUNCATE` ni DDL; sin `UPDATE` sobre la bitácora). El esquema se aplica con un usuario administrador.
- **Sin credenciales en el repositorio:** el esquema no crea usuarios ni contraseñas; `LABORATORIO_DB_URL` vive en `.env`, que no se sube.
- **SQL parametrizado** en todas las consultas; las búsquedas escapan `%` y `_`.
- **Autenticación:** JWT común HS256 con issuer, audience y expiración; solo se aceptan tokens de `laboratorio_clinico` con un rol del laboratorio.
- **Autorización por permiso** en cada ruta, con la misma tabla que recibe la interfaz. Recepción no ve valores de resultados y solo el administrador consulta historiales archivados.
- **Bitácora:** toda lectura de datos de pacientes se entrega solo después de quedar registrada (si la bitácora falla: `503`). Las escrituras se registran en la misma transacción, los accesos denegados también, y la validación la registra un trigger del propio motor.
- **Errores sin filtraciones:** ni SQL, ni trazas, ni datos clínicos en las respuestas o en los registros del servidor.

## 7. Arquitectura hexagonal

`domain` (reglas) y `application` (casos de uso) no conocen PostgreSQL; dependen de los puertos (`ports/index.js`). El adaptador `adapters/postgres` los implementa con `pg`, y `tests/doubles/memoria.js` los implementa en memoria. La misma batería de pruebas corre sobre ambos para que no se desvíen. El router HTTP (`app.js`) recibe los servicios ya construidos y se monta en el enrutador por institución del servidor común, que decide el módulo (y con él el motor) a partir del claim `institucion` del token.
