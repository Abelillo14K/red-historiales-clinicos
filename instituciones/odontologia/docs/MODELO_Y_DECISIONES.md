# Clínica Odontológica — modelo documental, consistencia y seguridad (Cloud Firestore)

Insumo de la clínica para el documento comparativo de la Entrega II. El adaptador está en [`backend/adapters/firestore/repositorios.js`](../backend/adapters/firestore/repositorios.js).

## 1. Asignación del motor

La clínica trabaja con **expedientes que se leen completos**: datos del paciente, antecedentes, odontograma y la lista de consultas, cada una con sus diagnósticos, tratamientos y recetas. La estructura varía: no todas las consultas traen receta, los tratamientos pueden o no referirse a una pieza, y el odontograma solo guarda las piezas con registros. Firestore guarda cada expediente y cada consulta como documentos con mapas y arreglos anidados, se lee sin joins y ofrece transacciones ACID entre documentos. Además es un servicio administrado (Firebase), y el docente puede revisar la base desde la consola web.

## 2. Colecciones y documentos

| Ruta | Contenido | Id |
|---|---|---|
| `pacientes/{id}` | Datos generales, mapas `contacto`, `antecedentes`, `atencion_inicial`; estado del historial; `total_consultas`, `ultima_consulta`; mapa `piezas`; `terminos[]` de búsqueda | `OD000001` (contador transaccional) |
| `pacientes/{id}/consultas/{auto}` | Fecha, odontólogo (id y nombre copiado), motivo, mapa `evaluacion`, arreglos `diagnosticos[]`, `tratamientos[]`, `prescripciones[]` (cada una con `medicamentos[]`), `id_cita` | automático |
| `citas/{auto}` | Paciente y odontólogo (id y nombre copiados), fecha, duración, motivo, estado, `id_consulta` | automático |
| `odontologos/{colegiado}` | Nombres, apellidos, especialidad, activo | número de colegiado |
| `procedimientos/{codigo}` | Nombre, descripción, precio | código |
| `documentos_paciente/{documento}` | `id_paciente`: guarda de unicidad del documento de identidad | documento sin espacios |
| `contadores/pacientes` | `valor`: último número de expediente | fijo |
| `bitacora/{auto}` | Usuario, rol, acción, paciente, recurso, resultado, detalle, fecha | automático |

El odontograma es un **mapa** `piezas` dentro del paciente, con numeración FDI como clave (`piezas.46 = { estado, observaciones, ultimo_tratamiento, actualizado, actualizado_por }`). Cada pieza se actualiza por ruta de campo (`update({'piezas.46.estado': …})`) sin reescribir las demás.

## 3. Embebido frente a referenciado

| Dato | Decisión | Justificación |
|---|---|---|
| Contacto, antecedentes, atención inicial | Mapas embebidos | Pertenecen al paciente y se muestran con él |
| Odontograma | Mapa embebido | Como máximo 52 piezas; se lee con el expediente |
| Consultas | **Subcolección** del paciente | Crecen sin límite; el documento del paciente tiene un tope de 1 MiB |
| Diagnósticos, tratamientos y recetas | Arreglos embebidos en la consulta | Pocos por consulta (máximo 50 de cada uno, validado); no tienen sentido fuera de ella |
| Citas | Colección propia | La agenda se consulta por fechas para todos los pacientes |
| Nombre del odontólogo y del paciente en consultas y citas | Copiado (desnormalizado) | La agenda y el historial se muestran sin leer otros documentos; queda el nombre vigente al momento de la atención |
| Odontólogos y procedimientos | Colecciones referenciadas por id | Catálogos compartidos; el tratamiento guarda el id y el nombre del procedimiento |
| Bitácora | Colección separada | Crece sin límite y se consulta por fecha, paciente o acción |

## 4. Consistencia

- **Transacciones (`runTransaction`)**: cada escritura lee lo que necesita y escribe todo junto, incluido su evento de bitácora. Ejemplos: el alta lee el contador y la guarda del documento, y crea el paciente, la guarda y el evento. La consulta crea la consulta, actualiza el paciente (contador, última consulta, odontograma) y marca la cita como atendida. Si algo falla, no se confirma nada.
- **Lecturas antes que escrituras**: Firestore lo exige dentro de una transacción. El adaptador acumula las escrituras y las aplica al final, así los casos de uso no dependen de ese orden.
- **Concurrencia**: Firestore reintenta la transacción si otra cambió los mismos documentos (hasta 5 veces). Las altas simultáneas reciben números distintos (prueba con 5 altas en paralelo).
- **Unicidad sin índices únicos**: Firestore no tiene restricción UNIQUE. Se usa el id del documento como clave: colegiado, código de procedimiento y la guarda `documentos_paciente/{documento}`, creada con `create()` en la misma transacción.
- **Citas sin cruces**: dentro de la transacción se leen las citas cercanas del odontólogo y se rechaza un horario que se cruce con una cita programada.
- **Disponibilidad**: cada operación tiene un tiempo máximo (15 s). Si Firestore no responde o rechaza la conexión, la API responde `503 MOTOR_NO_DISPONIBLE` sin afectar a las demás instituciones.

## 5. Consultas e índices

Firestore no tiene búsqueda por subcadena ni consultas sin índice. Todas las consultas del adaptador usan solo los **índices automáticos de un campo** (verificado en el proyecto real), y el resto se filtra en memoria:

| Necesidad | Consulta |
|---|---|
| Buscar por nombre | `terminos array-contains '<prefijo>'`; `terminos` guarda prefijos normalizados (sin tildes ni mayúsculas) de nombres y apellidos |
| Buscar por documento | `documento_identidad == x` |
| Listar por estado | `estado_historial == x` |
| Consultas del paciente | subcolección `orderBy('fecha_hora', 'desc')` |
| Agenda | `fecha_hora` entre dos fechas con `orderBy('fecha_hora')`; el estado se filtra en memoria |
| Citas del paciente | `id_paciente == x` |
| Panel | `count()` por estado y `collectionGroup('consultas').count()` |

Limitación aceptada: listados y búsquedas leen hasta 1 000 documentos y paginan en memoria, suficiente para una clínica. Para volúmenes mayores se crearían índices compuestos y paginación con cursores; con la arquitectura hexagonal solo cambiaría el adaptador.

## 6. Seguridad

- **Solo el servidor accede a Firestore**, con la cuenta de servicio (Admin SDK). Las reglas de seguridad quedan cerradas (modo de producción), así que ningún navegador puede leer ni escribir directo.
- **La llave nunca está en el repositorio**: `.env` guarda solo su ruta, y `.gitignore` excluye `.env` y `credentials*.json`.
- **Autenticación**: JWT común HS256 con issuer, audience y expiración; solo se aceptan tokens de `clinica_odontologica` con un rol de la clínica.
- **Autorización por permiso** en cada ruta, con la misma tabla que recibe la interfaz. Recepción no ve antecedentes, odontograma ni consultas, y solo el administrador consulta historiales archivados.
- **Bitácora**: las lecturas de pacientes se entregan solo después de registrarse (si falla: `503`). Las escrituras registran su evento en la misma transacción, y los accesos denegados también quedan.
- **Validación estricta** de toda entrada (zod): campos desconocidos rechazados, piezas FDI, fechas y longitudes.

## 7. Arquitectura hexagonal

`domain` y `application` no conocen Firestore; dependen de los puertos (`ports/index.js`). El adaptador `adapters/firestore` los implementa con `firebase-admin`, y `tests/doubles/memoria.js` los implementa en memoria con la misma semántica de transacción. La misma batería de pruebas corre sobre ambos y sobre el emulador oficial. El router HTTP (`app.js`) se monta en el enrutador por institución del servidor común, que elige el módulo (y con él el motor) a partir del claim `institucion` del token.
