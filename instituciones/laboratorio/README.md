# Módulo Laboratorio Clínico

| | |
|---|---|
| Estado | **Implementado**: backend PostgreSQL, interfaz conectada, pruebas y documentación |
| Identificador | `laboratorio_clinico` (claim `institucion` del JWT, clave del enrutador y del módulo) |
| Responsable | Eddy (`docs/GUIA_EQUIPO.md` §1) |
| Motor | PostgreSQL 16 o superior (probado con 18) |
| Modelo y decisiones | [`docs/MODELO_Y_DECISIONES.md`](docs/MODELO_Y_DECISIONES.md) |

Todos los datos son **ficticios**. El sistema no genera indicaciones clínicas: «fuera de rango» solo compara un valor con la referencia del catálogo.

## Estructura

```
instituciones/laboratorio/
  backend/
    domain/                 errores y reglas de negocio (sin motor)
    ports/                  contratos de persistencia
    application/            casos de uso: pacientes, solicitudes, resultados, catálogos, bitácora, panel
    adapters/postgres/      esquema.sql, repositorios SQL, unidad de trabajo y traducción de errores
    api/                    rutas Express y middleware (formato de error común)
    app.js                  router montable en el enrutador por institución
    index.js                composición: conexión → adaptador → casos de uso → router
    security.js permisos.js schema.js db.js
  frontend/                 módulo React (manifiesto, api.js, páginas y componentes)
  scripts/                  esquema.js (npm run lab:esquema) y usuarios.js (npm run lab:usuarios)
  tests/                    dominio, servicios, API, permisos e integración con PostgreSQL desechable
  docs/                     modelo, consistencia, seguridad y justificación del motor
```

El servidor común (`instituciones/pediatria/backend/server.js`) monta este módulo **solo si existe `LABORATORIO_DB_URL`**. Sin esa variable el servidor funciona igual que antes y un token del laboratorio recibe `403 INSTITUCION_NO_REGISTRADA`.

## Puesta en marcha (Windows, PowerShell)

Requisitos: lo del [README principal](../../README.md) más PostgreSQL 16 o superior. `psql` puede no estar en el PATH; use la ruta completa de su instalación.

1. Usuario de la aplicación y base (como `postgres`; elija su contraseña):
   ```powershell
   & "<carpeta de PostgreSQL>\bin\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE ROLE app_laboratorio LOGIN PASSWORD '<contraseña>';" -c "CREATE DATABASE historial_lab;"
   ```
2. En `.env`, `LABORATORIO_DB_URL` con el usuario **`postgres`** y aplique el esquema (idempotente, no borra datos):
   ```powershell
   npm run lab:esquema
   ```
3. Cambie `LABORATORIO_DB_URL` a `postgres://app_laboratorio:<contraseña>@127.0.0.1:5432/historial_lab`. Ese usuario no puede crear tablas, borrar registros ni modificar la bitácora.
4. `npm run dev` debe mostrar `Laboratorio Clínico: PostgreSQL conectado`.

Si la contraseña tiene `@ : / # %`, escríbala codificada en la URL (por ejemplo, `@` como `%40`).

## Cuentas de acceso (usuario y contraseña)

Una cuenta por rol, guardada en `laboratorio.cuenta_acceso` (solo el hash scrypt, nunca la contraseña). Se crean una sola vez; reiniciar el servidor no las cambia.

```powershell
npm run lab:esquema       # con LABORATORIO_DB_URL de postgres: crea la tabla si falta
npm run lab:usuarios      # crea lab.admin, lab.recepcion, lab.tecnico y lab.bioquimico
```

Las contraseñas aparecen una sola vez y se agregan a `DATOS_DE_ACCESO_LABORATORIO.txt`, **fuera del repositorio** (carpeta que contiene el proyecto). Volver a ejecutarlo no cambia las cuentas existentes; `npm run lab:usuarios -- --restablecer` genera contraseñas nuevas. Cada inicio de sesión, correcto o fallido, queda en la bitácora.

Se entra por el formulario común de la pantalla de acceso: `POST /auth/login` reconoce el prefijo `lab.` y valida la cuenta con `autenticar(usuario, contraseña)` del módulo, que devuelve el JWT de `laboratorio_clinico`. Para que `lab.bioquimico` valide resultados, regístrelo como personal activo con ese mismo usuario (Catálogos → Personal del laboratorio).

## Roles y permisos

Única fuente: [`backend/permisos.js`](backend/permisos.js) (la misma tabla autoriza las rutas y se entrega en `/api/sesion`).

| Permiso | Recepción | Técnico | Bioquímico | Administrador |
|---|:-:|:-:|:-:|:-:|
| `panel.ver`, `pacientes.listar`, `pacientes.ver_administrativo` | ✔ | ✔ | ✔ | ✔ |
| `pacientes.registrar` | ✔ | | | ✔ |
| `historial.leer` | | ✔ | ✔ | ✔ |
| `historial.leer_archivados`, `historial.archivar`, `catalogos.editar`, `auditoria.leer` | | | | ✔ |
| `catalogos.ver`, `laboratorio.solicitudes.ver` | ✔ | ✔ | ✔ | ✔ |
| `laboratorio.solicitudes.crear` | ✔ | | | |
| `laboratorio.resultados.ver` | | ✔ | ✔ | ✔ |
| `laboratorio.resultados.registrar` | | ✔ | ✔ | |
| `laboratorio.resultados.validar` | | | ✔ | |

Recepción ve el estado de los exámenes de una solicitud, pero no sus valores.

## Reglas comunes en el laboratorio

| Regla común | En el laboratorio | Ruta |
|---|---|---|
| Registrar paciente | Paciente con datos generales y de contacto | `POST /api/pacientes` |
| Registrar consulta | Solicitud con uno o varios exámenes del catálogo | `POST /api/pacientes/:id/solicitudes` |
| Agregar diagnóstico | Resultado: valores de los parámetros del examen (preliminar, se puede completar) | `PUT /api/examenes/:id/resultado` |
| — | Validación y emisión por un bioquímico registrado | `PATCH /api/resultados/:id/validar` |
| Recetar | **No aplica**: el laboratorio no receta (`/api/sesion` → `capacidades.prescripciones: false`) | — |
| Dar de baja | Archivo con motivo; el historial queda en solo lectura | `PATCH /api/pacientes/:id/archivar` |

Otras rutas: `GET /api/sesion`, `/panel`, `/pacientes[/:id[/administrativo]]`, `/solicitudes[/:id]`, `/resultados[/:id]`, `/auditoria`, y catálogos `GET|POST /tipos-muestra`, `/parametros`, `/tipos-examen` (`GET /tipos-examen/:id` con sus parámetros), `/medicos`, `/personal`. Listados paginados `{ items, total, pagina, limite }`. Errores con el formato común (`docs/GUIA_EQUIPO.md` §4); si PostgreSQL no responde: `503 MOTOR_NO_DISPONIBLE`, sin afectar a las demás instituciones.

## Pruebas

```powershell
npm run test:laboratorio      # 47 pruebas; incluidas en npm test
```

- **Dominio y servicios** sobre un doble en memoria (`tests/doubles/memoria.js`).
- **La misma batería de flujo** corre también sobre **PostgreSQL real desechable** (`tests/soporte/postgresTemporal.js`): `initdb` en una carpeta temporal y puerto libre, que se borra al terminar. **Nunca toca `historial_lab`.** Además prueba triggers, privilegios de `app_laboratorio`, concurrencia y motor caído.
- **API y permisos**: contrato de `/api/sesion`, tokens, validación de entrada, formato de errores y que cada permiso coincida con la autorización real.

Los binarios de PostgreSQL se detectan solos (Program Files o el servicio de Windows). Si no, defina `PG_BIN` con la carpeta `bin`. Sin binarios, las pruebas de integración se omiten.
