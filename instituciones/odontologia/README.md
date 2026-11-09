# Módulo Clínica Odontológica

| | |
|---|---|
| Estado | **Implementado**: backend Cloud Firestore, interfaz conectada, pruebas y documentación |
| Identificador | `clinica_odontologica` (claim `institucion` del JWT, clave del enrutador y del módulo) |
| Responsable | Eddy (`docs/GUIA_EQUIPO.md` §1) |
| Motor | Firebase · Cloud Firestore (plan Spark, sin costo); emulador oficial para las pruebas |
| Modelo y decisiones | [`docs/MODELO_Y_DECISIONES.md`](docs/MODELO_Y_DECISIONES.md) |

Todos los datos son **ficticios**. El sistema no genera indicaciones clínicas: el estado de cada pieza y los tratamientos los registra el odontólogo.

## Estructura

```
instituciones/odontologia/
  backend/
    domain/                 errores y reglas (piezas FDI, citas, búsqueda) sin motor
    ports/                  contratos de persistencia
    application/            casos de uso: pacientes y odontograma, consultas, citas, catálogos, panel
    adapters/firestore/     repositorios, transacciones (runTransaction) y traducción de errores
    api/                    rutas Express y middleware (formato de error común)
    app.js                  router montable en el enrutador por institución
    index.js                composición: conexión → adaptador → casos de uso → router
    db.js security.js permisos.js schema.js
  frontend/                 módulo React (manifiesto, api.js, páginas, odontograma)
  scripts/dev-token.js      npm run odonto:token
  tests/                    dominio, servicios, API, permisos e integración con el emulador de Firestore
  docs/                     modelo documental, consistencia, seguridad y justificación del motor
```

El servidor común (`instituciones/pediatria/backend/server.js`) monta este módulo si existe `ODONTOLOGIA_FIREBASE_CREDENCIALES` (o `FIRESTORE_EMULATOR_HOST`). Si la llave falta o Firestore no responde, la clínica responde `503 MOTOR_NO_DISPONIBLE` y las demás instituciones siguen funcionando.

## Puesta en marcha con Firebase real

1. En https://console.firebase.google.com: crear el proyecto y **Firestore Database** (edición Standard, `(default)`, ubicación `nam5`, modo de producción). No hace falta Storage ni el plan de pago.
2. Configuración del proyecto → **Cuentas de servicio** → «Generar nueva clave privada». Guarde el `.json` **fuera del repositorio**: da acceso total a la base.
3. En `.env`:
   ```
   ODONTOLOGIA_FIREBASE_CREDENCIALES=D:\ruta\fuera\del\repo\llave.json
   ```
   El ID del proyecto se toma de la llave (o de `ODONTOLOGIA_FIREBASE_PROJECT_ID`).
4. `npm run dev` debe mostrar `Clínica Odontológica: Firestore (<proyecto>) conectado`.

No hay que crear colecciones ni índices: se crean al guardar el primer documento, y todas las consultas usan los índices automáticos de un campo (verificado contra Firestore real).

**Para que el docente vea la base:** consola de Firebase → Configuración del proyecto → **Usuarios y permisos** → agregar su correo con rol **Lector**. Verá las colecciones en Firestore Database → Datos.

Las reglas de seguridad de Firestore quedan en «modo de producción» (todo cerrado): solo el servidor accede, con la cuenta de servicio. El navegador nunca se conecta a Firestore.

## Cuentas de acceso (usuario y contraseña)

Una cuenta por rol en la colección `cuentas_acceso/{usuario}` (solo el hash scrypt, nunca la contraseña). Se crean una sola vez y, como Firestore está en la nube, son las mismas desde cualquier equipo que use la llave.

```powershell
npm run odonto:usuarios   # crea odonto.admin, odonto.recepcion y odonto.odontologo
```

Las contraseñas aparecen una sola vez y se agregan a `DATOS_DE_ACCESO_ODONTOLOGIA.txt`, **fuera del repositorio** (carpeta que contiene el proyecto). Volver a ejecutarlo no cambia las cuentas existentes; `npm run odonto:usuarios -- --restablecer` genera contraseñas nuevas. Cada inicio de sesión, correcto o fallido, queda en la bitácora.

Se entra por el formulario común de la pantalla de acceso: `POST /auth/login` reconoce el prefijo `odonto.` y valida la cuenta con `autenticar(usuario, contraseña)` del módulo, que devuelve el JWT de `clinica_odontologica`.

## Token de desarrollo (solo pruebas)

```powershell
npm run odonto:token -- odontologo EDDY-OD     # roles: recepcion, odontologo, administrador
```

Abra `http://localhost:3001/#access_token=<JWT>`. El token dura 8 horas y solo vale con el `JWT_SECRET` de ese `.env`.

## Roles y permisos

Única fuente: [`backend/permisos.js`](backend/permisos.js) (la misma tabla autoriza las rutas y se entrega en `/api/sesion`).

| Permiso | Recepción | Odontólogo | Administrador |
|---|:-:|:-:|:-:|
| `panel.ver`, `pacientes.listar`, `pacientes.ver_administrativo`, `catalogos.ver`, `odontologia.citas.ver` | ✔ | ✔ | ✔ |
| `pacientes.registrar` | ✔ | | ✔ |
| `odontologia.citas.gestionar` | ✔ | ✔ | |
| `historial.leer` | | ✔ | ✔ |
| `clinico.escribir` (consultas, diagnósticos, tratamientos, recetas, odontograma) | | ✔ | |
| `historial.leer_archivados`, `historial.archivar`, `catalogos.editar`, `auditoria.leer` | | | ✔ |

Recepción ve datos generales y de contacto, pero no antecedentes, odontograma ni consultas.

## Reglas comunes en la clínica

| Regla común | En la clínica | Ruta |
|---|---|---|
| Registrar paciente | Expediente `OD000001` con contacto, antecedentes y atención inicial | `POST /api/pacientes` |
| Registrar consulta | Consulta con evaluación; puede incluir diagnósticos, tratamientos y receta, y cerrar su cita | `POST /api/pacientes/:id/consultas` |
| Agregar diagnóstico | Código, descripción y pieza (FDI) | `POST …/consultas/:c/diagnosticos` |
| Tratamiento por pieza | Procedimiento del catálogo o libre; actualiza el odontograma | `POST …/consultas/:c/tratamientos` |
| Recetar | Receta con uno o varios medicamentos | `POST …/consultas/:c/prescripciones` |
| Dar de baja | Archivo con motivo; el historial queda en solo lectura | `PATCH /api/pacientes/:id/archivar` |

Extensiones: odontograma `PUT /api/pacientes/:id/piezas/:pieza` (estado: Sana, Caries, Obturada, Endodoncia, Corona, Ausente, Extracción indicada, Implante), agenda `GET|POST /api/citas` y `PATCH /api/citas/:id/estado` (sin citas cruzadas del mismo odontólogo), historial de medicamentos `GET /api/pacientes/:id/prescripciones`, catálogos `GET|POST /api/odontologos` y `/api/procedimientos`, además de `/api/sesion`, `/panel`, `/auditoria`.

## Pruebas

```powershell
npm run test:odontologia      # 39 pruebas; incluidas en npm test
npm run odonto:emulador       # una sola vez: descarga el emulador de Firestore (~100 MB)
```

- **Dominio y servicios** sobre un doble en memoria (`tests/doubles/memoria.js`) con la misma semántica de transacción que Firestore.
- **La misma batería de flujo** corre sobre el **emulador oficial de Firestore** (`tests/soporte/firestoreTemporal.js`): proceso Java propio, puerto libre, que se detiene al terminar. **Nunca toca el proyecto real.** Además prueba el contador transaccional con altas simultáneas, que una bitácora fallida no confirme nada y el odontograma por ruta de campo.
- **API y permisos**: contrato de `/api/sesion`, tokens, validación de entrada, formato de errores, 503 con el motor caído y que cada permiso coincida con la autorización real.

Requisitos de las pruebas de integración: **Java 21 o superior** y el emulador descargado. Sin ellos se omiten (las demás pasan igual). Ruta propia del `.jar`: `FIRESTORE_EMULATOR_JAR`.
