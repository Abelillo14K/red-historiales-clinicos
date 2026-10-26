# Respaldo y restauración verificada — `centro_pediatrico_db`

Procedimiento para respaldar la base con `mongodump`, comprobar que el respaldo se puede recuperar restaurándolo en una instancia **aislada**, y saber qué garantiza y qué no en el servidor actual (MongoDB 9.0.4 standalone).

| Comando | Qué hace | Toca la base original |
|---|---|---|
| `npm run db:diagnostico` | Versión, topología, colecciones, conteos, índices y validadores | Solo lectura |
| `npm run db:respaldo` | `mongodump --archive --gzip` + manifiesto con huellas | Solo lectura |
| `npm run db:restaurar-aislado -- <carpeta> [--comparar-origen] [--conservar]` | Restaura en un mongod temporal y compara | Nunca escribe; `--comparar-origen` solo lee |

Los scripts están en `instituciones/pediatria/scripts/respaldo/`. Leen `MONGO_URI` y `MONGO_DB` de `.env` (las variables de la sesión tienen prioridad) y **nunca** imprimen la URI, credenciales ni contenido de documentos.

## 1. Requisitos

- **MongoDB Database Tools 100.19.x.** La 100.19.0–100.19.1 es la primera versión documentada para MongoDB Server 9.0 (tabla de compatibilidad del *changelog* oficial). No vienen con el servidor: el MSI de 9.0.4 solo trae `mongod.exe` y `mongos.exe`.
  - Instalación portátil, sin permisos de administrador ni cambios en el PATH: descargar `mongodb-database-tools-windows-x86_64-100.19.1.zip` desde el catálogo oficial `https://downloads.mongodb.org/tools/db/release.json` y extraerlo en `%USERPROFILE%\herramientas\`.
  - **Verificar el SHA-256 contra el catálogo antes de extraer.** Para 100.19.1: `527738a0f9ab2d80ea40cb8fc7a68f8e28664a2fd4e3b63626c2d4629aeb7f37`. Los `.exe` del ZIP no tienen firma Authenticode; el MSI de las Tools sí está firmado.
  - Los scripts buscan las Tools en `MONGODB_TOOLS_BIN`, luego en `%USERPROFILE%\herramientas\mongodb-database-tools-*\bin` y por último en el PATH.
- **`mongod.exe` de la misma versión mayor (9.0)** para la instancia temporal. Se detecta solo en `C:\Program Files\MongoDB\Server\<versión>\bin` o con `MONGOD_BIN`. mongorestore solo garantiza la restauración en la misma versión mayor o FCV que el origen.
- **Usuario de la aplicación (`readWrite` en `centro_pediatrico_db`).** Basta para respaldar esa base: requiere `find`, `listCollections` y `listIndexes`.

## 2. Ventana sin escrituras (obligatoria para un respaldo consistente)

En standalone **no existe `mongodump --oplog`** (requiere replica set), así que el volcado no es una instantánea: lee colección por colección. Si la API escribe durante el volcado, el respaldo puede incluir una consulta sin su evento en `bitacora_acceso`, o al revés.

1. Detener la API (`npm run dev` / `npm start`) y cualquier cliente que escriba (mongosh, Compass, APIs de otros integrantes que usen este servidor).
2. Comprobar en PowerShell:
   ```powershell
   Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue        # vacío: API detenida
   Get-NetTCPConnection -State Established -RemotePort 27017 -ErrorAction SilentlyContinue # vacío: sin clientes
   ```
3. Hacer el respaldo. El script calcula una huella SHA-256 de cada colección **antes y después** del volcado. Si cambió, marca el respaldo como `consistente: false` y termina con código 2. En ese caso, repetir el respaldo con la ventana cerrada.

## 3. Respaldo

```powershell
npm run db:diagnostico      # opcional: estado actual (solo lectura)
npm run db:respaldo         # o: node instituciones/pediatria/scripts/respaldo/respaldar.js --salida <carpeta vacía>
```

Genera `respaldos/mongodb/<fecha UTC>/`:

| Archivo | Contenido |
|---|---|
| `centro_pediatrico_db.archive.gz` | Archivo de mongodump (`--archive --gzip`): documentos en **BSON**, índices y opciones de cada colección, incluidos los validadores `$jsonSchema` |
| `manifiesto.json` | Versiones, hora de inicio y fin, `consistente`, tamaño, SHA-256 y la huella del origen: conteos, `_id`, campos de primer nivel, índices, validadores e integridad. No contiene valores de documentos |
| `SHA256SUMS.txt` | Suma del archivo (`sha256sum -c SHA256SUMS.txt` en Git Bash) |
| `mongodump.log` | Registro de mongodump, sin URI |

Cómo se protegen las credenciales: la URI se pasa a mongodump mediante `--config` en un YAML temporal (permisos 600 en `%TEMP%`) que se borra al terminar. No aparece en la línea de comandos, en los registros ni en el respaldo.

Equivalente manual (si no se usan los scripts):
```powershell
mongodump --config=<yaml con: uri: '...'> --db=centro_pediatrico_db --archive=<carpeta>\centro_pediatrico_db.archive.gz --gzip
```

> `npm run db:validadores -- --respaldo` exporta las colecciones en **EJSON**. Sirve para revisar los datos, pero **no equivale** a un respaldo BSON de mongodump: no conserva los índices ni restaura con mongorestore. Usar este procedimiento.

## 4. Restaurar en un entorno aislado y verificar

```powershell
npm run db:restaurar-aislado -- respaldos\mongodb\<fecha> --comparar-origen
```

1. Verifica el SHA-256 del archivo contra el manifiesto. Si no coincide, se detiene antes de restaurar.
2. Lanza un **mongod temporal** (`instituciones/pediatria/tests/soporte/mongodTemporal.js`): carpeta propia en `%TEMP%`, puerto libre, solo `127.0.0.1`, sin autenticación.
3. **Salvaguardas:** se cancela si el puerto temporal coincide con el de `MONGO_URI` o si la base ya existe en el destino. `mongorestore` recibe siempre la URI del mongod temporal, con `--nsInclude=centro_pediatrico_db.*` y `--stopOnError`, **sin `--drop`**.
4. Compara la base restaurada con la huella del manifiesto:
   - nombres y tipo de las colecciones;
   - número de documentos;
   - todos los `_id`;
   - SHA-256 de todos los documentos en EJSON canónico (detecta cualquier cambio de valor o de tipo BSON);
   - campos de primer nivel;
   - índices (clave, `unique`, `sparse`, `partialFilterExpression`);
   - validadores con su `validationLevel` y `validationAction`;
   - integridad del historial (§4.1).
5. `--comparar-origen` compara además con el estado **actual** del origen, en solo lectura. Las diferencias se informan aparte: después del respaldo el origen puede haber cambiado legítimamente.
6. Escribe `verificacion-<fecha>.json` y `mongorestore-<fecha>.log` en la carpeta del respaldo, detiene el mongod temporal y borra sus datos. Con `--conservar` lo deja en marcha para inspeccionarlo con mongosh o Compass; Ctrl+C lo detiene.

Durante la restauración, los documentos se validan contra el validador restaurado: mongorestore no usa `--bypassDocumentValidation`. Que haya 0 fallos confirma también que los datos cumplen el esquema.

### 4.1 Integridad comprobada

- `consultas[].id_medico` → `medicos`.
- `esquema_vacunacion[].id_vacuna` → `vacunas`.
- `esquema_vacunacion[].id_medico` → `medicos` (si no es nulo).
- `controles_crecimiento[].id_consulta` → una consulta del mismo paciente.
- `bitacora_acceso.id_paciente` → `pacientes`.
- Ningún identificador repetido dentro de un historial (consulta, control, dosis, tutor) ni `id_evento` repetido.
- Número de eventos de auditoría pendientes embebidos (`bitacora_pendiente`).

### 4.2 Cómo saber que funcionó

| Señal | Esperado |
|---|---|
| Código de salida de `db:respaldo` | `0` y "Consistente" |
| Código de salida de `db:restaurar-aislado` | `0` (`1` = error o archivo dañado; `2` = diferencias) |
| Resumen de mongorestore | `N restaurados, 0 fallidos`, con N igual a la suma de documentos del manifiesto |
| Por colección | "huella idéntica", mismos índices y "validador sí/sí" |
| Línea final | "Restaurada idéntica al origen respaldado…" |

También se probaron los casos negativos: un byte alterado en el archivo da `SHA-256 no coincide` (código 1), y un manifiesto con otra huella u otro índice da `DIFERENCIAS…` (código 2).

## 5. Cómo no sobrescribir la base original

- No ejecutar nunca `mongorestore` sin `--uri`/`--host`: por defecto apunta a `localhost:27017`, **el servidor real**.
- No usar `--drop` salvo en una restauración de recuperación autorizada (§6).
- Restaurar siempre primero en la instancia temporal con `db:restaurar-aislado`, que comprueba el puerto y que la base no exista.
- Sin `--drop`, restaurar sobre una colección existente no la reemplaza: intenta insertar y los `_id` duplicados fallan. Con `--stopOnError` se detiene en el primer error.
- Un mongod temporal manual debe usar un `--dbpath` nuevo y vacío, un `--port` distinto de 27017 y `--bind_ip 127.0.0.1`. Nunca el `dbPath` del servicio de Windows.

## 6. Recuperación real (no ejecutada; requiere autorización)

Restaurar sobre el servidor real es un cambio destructivo y lo decide el responsable del equipo. Secuencia recomendada:

1. Verificar el respaldo con `db:restaurar-aislado` (código 0).
2. Hacer un respaldo nuevo del estado actual, aunque esté dañado, para poder volver atrás.
3. Elegir una vía:
   - **Restaurar con otro nombre** y cambiar `MONGO_DB`: `mongorestore --nsFrom=centro_pediatrico_db.* --nsTo=centro_pediatrico_db_restaurada.*`. No sobrescribe nada, pero el usuario `readWrite` no puede crear otra base: lo debe hacer un administrador y conceder permisos.
   - **Reemplazar las colecciones** con `--drop`, solo con autorización explícita, con la API detenida y con un usuario administrador.
4. Usuarios y roles: `app_pediatrica` vive en la base de autenticación, **no está en este respaldo** y se conserva o recrea aparte (`--dumpDbUsersAndRoles` requiere privilegios de administrador).
5. Ejecutar `npm run db:diagnostico` y `npm run db:validadores` (solo lectura) y arrancar la API.

## 7. Limitaciones conocidas (standalone)

- **Sin instantánea ni `--oplog`.** La consistencia entre colecciones depende de la ventana sin escrituras (§2). Dentro de un documento sí es consistente: el evento pendiente de una escritura clínica viaja en el propio paciente (`bitacora_pendiente`) y se respalda con él.
- **Sin recuperación a un punto en el tiempo:** solo se puede volver al momento del último respaldo.
- **UUID de colección:** mongorestore crea colecciones con UUID nuevos (conservarlos exige `--preserveUUID` con `--drop`). No afecta a la aplicación y se excluye de la comparación.
- **No incluye** usuarios y roles, configuración del servicio (`mongod.cfg`) ni otras bases.
- **Datos personales:** el archivo contiene la base completa, con datos de pacientes y tutores. `respaldos/` está excluido de git, pero la carpeta del proyecto está **en OneDrive** y se sincroniza con la nube. Para respaldos con datos reales, guardarlos fuera de carpetas sincronizadas o cifrarlos, y definir cuánto tiempo conservarlos.
- La instancia temporal no tiene autenticación: solo escucha en 127.0.0.1 y se elimina al terminar.

## 8. Registro de ejecuciones

| Fecha (UTC) | Respaldo | Resultado |
|---|---|---|
| 2026-10-25 00:51 (24/10 18:51 local) | `respaldos/mongodb/2026-10-25T00-51-33-425Z/`: 7194 B, SHA-256 `4bf1b28269e289f69b8b07c1619d3780529f274b8bb33984d1ec87bc3a5ec8fb`, consistente (API detenida, 0 clientes conectados) | Restaurado en un mongod temporal: 89/89 documentos, 0 fallidos; 4/4 colecciones con huella idéntica; índices 5/3/2/4 y validadores strict/error idénticos; 2 consultas, 3 prescripciones, 3 controles, 5 dosis y 76 eventos; 0 referencias rotas; 0 eventos pendientes. Origen actual idéntico a la restaurada. Única diferencia esperada: UUID de colección |
