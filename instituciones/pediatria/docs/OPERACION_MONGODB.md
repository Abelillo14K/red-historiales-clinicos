# Operación de MongoDB — Centro Médico Pediátrico

Procedimientos que requieren **privilegios que la aplicación no tiene** (el usuario `app_pediatrica` solo tiene `readWrite` sobre `centro_pediatrico_db`). Ninguno se ejecutó automáticamente: se documentan para que un administrador los realice de forma segura.

## 1. Estado actual

**Actualización 24/10/2026:** el administrador aplicó los validadores de Fase II. `npm run db:validadores` (solo lectura) muestra las 4 colecciones con validador, el perímetro cefálico opcional y 0 documentos que incumplen (5 pacientes, 3 médicos, 5 vacunas, 65 eventos). La tabla siguiente es el estado anterior a esa aplicación (23/10/2026), conservado como referencia.

| Elemento | Estado |
|---|---|
| Servidor | MongoDB 9.0.4, servicio de Windows `MongoDB`, **standalone** (sin replica set) |
| Usuario de la aplicación | `app_pediatrica`, rol `readWrite` en `centro_pediatrico_db` |
| Validador de `pacientes` | Versión inicial: exige `perimetro_cefalico_cm`; estados de dosis `Pendiente/Aplicada/Cancelada` |
| Validadores de `medicos`, `vacunas`, `bitacora_acceso` | Ninguno |
| Documentos frente al validador de Fase II | 4 pacientes, 3 médicos, 5 vacunas y 48 eventos: **0 incumplen** (`npm run db:validadores`) |
| Índices | Los de `instituciones/pediatria/backend/adapters/mongo/index.js`, creados al arrancar la API (no destructivos) |

## 2. Validadores `$jsonSchema` de Fase II

Definidos en `instituciones/pediatria/backend/adapters/mongo/validadores.js`, con las mismas reglas que Zod (`instituciones/pediatria/backend/schema.js`): longitudes máximas, rangos de medidas (mayor que 0; peso y talla hasta 250, perímetro hasta 100), formato de identificadores `^[A-Za-z0-9_-]{1,40}$`, enumeraciones, **perímetro cefálico opcional** (Fase I: "si corresponde"), `tratamientos_anteriores` y la bandeja `bitacora_pendiente`.

`collMod` solo cambia la regla de validación: **no modifica ni elimina documentos**. Aun así, el procedimiento respalda antes.

### 2.1 Verificar (solo lectura; puede hacerlo cualquiera)
```powershell
npm run db:validadores
```
Muestra el validador instalado en cada colección y cuántos documentos rechazaría el de Fase II.

### 2.2 Aplicar (requiere un usuario con rol `dbAdmin` o `root`)
```powershell
npm run db:validadores -- --aplicar --usuario <usuario_administrador>
# Si el usuario está en otra base de autenticación: --auth-db <base>   (por defecto: admin)
```
La contraseña se pide por teclado, **no se muestra ni se guarda**. El script:
1. lee y muestra los validadores actuales;
2. comprueba que **ningún** documento incumple los nuevos (si alguno incumple, se detiene sin cambiar nada);
3. crea un respaldo en `respaldos/validadores-<fecha>/` (validadores previos y documentos en EJSON canónico; carpeta excluida de Git);
4. aplica `collMod` con `validationLevel: strict` y `validationAction: error`;
5. imprime el comando exacto para revertir.

Después de aplicarlo, la API detecta el cambio en un minuto como máximo (o al reiniciar) y el perímetro cefálico pasa a ser opcional en los formularios. `GET /api/sesion` devuelve `capacidades.perimetro_cefalico_opcional`.

### 2.3 Revertir
```powershell
npm run db:validadores -- --revertir "respaldos\validadores-<fecha>" --usuario <usuario_administrador>
```
Restaura exactamente el validador, `validationLevel` y `validationAction` anteriores de cada colección.

### 2.4 Comprobado en una base desechable
`instituciones/pediatria/tests/mongo.integration.test.js` reproduce el validador instalado hoy (copia en `instituciones/pediatria/tests/soporte/validadorInstalado.js`) y comprueba en un MongoDB 9.0 real: verificación, respaldo, aplicación, reversión, que los documentos quedan idénticos y que el validador nuevo rechaza escrituras directas inválidas.

## 3. Base de pruebas independiente

El usuario de la aplicación no puede crear otra base. En su lugar, `instituciones/pediatria/tests/soporte/mongodTemporal.js` inicia **otro proceso `mongod`** con el binario instalado (`C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe`), en un puerto libre, con una carpeta temporal y escuchando solo en `127.0.0.1`. Al terminar lo detiene y borra la carpeta. No usa el servicio `MongoDB` ni `centro_pediatrico_db`.

- `npm test` lo usa para `instituciones/pediatria/tests/mongo.integration.test.js` (standalone y replica set de un nodo).
- `npm run test:e2e` lo usa para la prueba de interfaz.
- Otra ruta del binario: `$env:MONGOD_BIN = "ruta\mongod.exe"`.

## 4. Consistencia sin transacciones (configuración actual)

Un servidor standalone **no admite transacciones multidocumento**. Escritura clínica (`pacientes`) y auditoría (`bitacora_acceso`) son dos colecciones. La aplicación garantiza que **ningún evento de una escritura confirmada se pierda** con un *outbox* embebido:

1. El caso de uso crea el evento con `id_evento` (UUID).
2. El repositorio agrega el evento al arreglo `bitacora_pendiente` del paciente **en el mismo `updateOne`/`insertOne`** que el cambio clínico. MongoDB garantiza la atomicidad por documento: se guardan ambos o ninguno.
3. Después se copia a `bitacora_acceso` (índice único parcial en `id_evento`, así que repetirla no duplica) y se retira del paciente con `$pull`.
4. Si el paso 3 falla, el evento sigue dentro del paciente. `reenviarPendientes()` lo entrega al iniciar la API, cada 60 s y antes de cada consulta de auditoría.

Qué **no** garantiza (y no se afirma):
- La auditoría **no es transaccional**: un evento puede llegar a `bitacora_acceso` con retraso.
- Las **lecturas** y los **accesos denegados** no tienen escritura clínica con la que agruparse; se insertan directamente y, si la bitácora falla, solo se informa en el registro del servidor.
- Las altas de catálogo (`medicos`, `vacunas`) pasan por la unidad de trabajo con su evento. Con replica set se confirman o revierten juntas (verificado con el replica set desechable). En standalone no hay documento de paciente donde embeber el evento: se inserta justo después del alta y, si la bitácora falla, el alta queda hecha y el fallo solo aparece en el registro del servidor. Embeberlo en `medicos`/`vacunas` exigiría cambiar sus validadores, lo que no se hizo.
- La protección contra pacientes duplicados (mismos nombres, apellidos y fecha de nacimiento, sin distinguir mayúsculas) serializa las altas **dentro de un proceso** de la API. Con varias instancias de la API contra la misma base volvería a existir la carrera. Las opciones para cerrarla en la base, y por qué no se recomienda un índice único sobre nombres + apellidos + fecha de nacimiento, están en `instituciones/pediatria/docs/MODELO_Y_DECISIONES.md` §4.1 (decisión pendiente del equipo).

## 5. Plan de migración a replica set (opcional, **no ejecutado**)

Con un replica set, la unidad de trabajo usa `session.withTransaction` y la escritura clínica y la bitácora se confirman o revierten juntas. Esto se **verificó con un replica set desechable de un nodo** (`instituciones/pediatria/tests/mongo.integration.test.js`, incluido el caso en que falla la bitácora y se revierte la consulta). El código no requiere cambios: detecta el modo con el comando `hello`.

Cambia la configuración global del servidor, así que **debe autorizarlo el responsable del equipo** antes de hacerlo.

| Paso | Acción (PowerShell como administrador) |
|---|---|
| 1. Respaldo | `npm run db:respaldo` con la API detenida, verificado con `npm run db:restaurar-aislado -- <carpeta>` (procedimiento completo en `instituciones/pediatria/docs/RESPALDO_Y_RESTAURACION.md`). La exportación EJSON de `npm run db:validadores -- --respaldo` no sustituye a este respaldo BSON |
| 2. Detener | `Stop-Service MongoDB` |
| 3. Configurar | En `C:\Program Files\MongoDB\Server\9.0\bin\mongod.cfg` agregar `replication:` / `  replSetName: rs0`. Con autenticación activada, un replica set exige `security.keyFile` (archivo de clave con permisos restringidos), aunque tenga un solo nodo |
| 4. Iniciar | `Start-Service MongoDB` |
| 5. Inicializar | `mongosh -u <admin> -p --authenticationDatabase admin --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"` |
| 6. Aplicación | Agregar `replicaSet=rs0` a `MONGO_URI` en `.env` y reiniciar la API: debe mostrar "Transacciones multidocumento: sí" |

**Riesgos:** si falta el `keyFile` con autenticación, el servicio no arranca; las aplicaciones de otros integrantes que usen este servidor deben actualizar su URI; el oplog ocupa espacio adicional.
**Reversión:** detener el servicio, quitar `replication` (y `keyFile` si se agregó) de `mongod.cfg` e iniciarlo; los datos se conservan. Si algo falla, restaurar con `mongorestore` desde el respaldo del paso 1. La API vuelve sola al modo outbox.
