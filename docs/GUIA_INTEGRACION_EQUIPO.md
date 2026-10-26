# Guía de integración para el equipo

Cómo conectar el Hospital General, la Clínica Odontológica y el Laboratorio Clínico a la plataforma compartida **Red de Historiales Clínicos** sin modificar el módulo del Centro Médico Pediátrico.

> **Estado real (25/10/2026).** En este repositorio solo funciona el Centro Médico Pediátrico con MongoDB. Ninguna otra institución, motor ni inicio de sesión común está implementado. El **frontend** del Hospital General, la Clínica Odontológica y el Laboratorio Clínico está **preparado visualmente y pendiente de integración** en `instituciones/<carpeta>/frontend/{hospital,odontologia,laboratorio}/`: sin backend, sin registrar y sin datos. Se revisa en la vista previa de desarrollo (`/vista-previa`). La guía práctica del frontend para los tres integrantes está en [`FRONTEND_EQUIPO.md`](FRONTEND_EQUIPO.md). Responsables: Pediatría, el propietario del proyecto; Hospital, Ely; Odontología y Laboratorio, Eddy ([`ARQUITECTURA.md`](ARQUITECTURA.md) §6). La asignación de motores todavía no está confirmada (ver §1).

## Índice
1. [Requisitos previos](#1-requisitos-previos)
2. [Qué debe entregar cada integrante](#2-qué-debe-entregar-cada-integrante)
3. [Contrato de sesión](#3-contrato-de-sesión)
4. [Contrato HTTP y errores](#4-contrato-http-y-errores)
5. [Operaciones comunes y extensiones institucionales](#5-operaciones-comunes-y-extensiones-institucionales)
6. [Backend: conectar su institución y su motor](#6-backend-conectar-su-institución-y-su-motor)
7. [Frontend: registrar su módulo](#7-frontend-registrar-su-módulo)
8. [Componentes compartidos](#8-componentes-compartidos)
9. [Permisos](#9-permisos)
10. [Cómo verificar la integración](#10-cómo-verificar-la-integración)
11. [Problemas frecuentes](#11-problemas-frecuentes)
12. [Qué no modificar directamente](#12-qué-no-modificar-directamente)
13. [Ejemplo ilustrativo de un módulo futuro](#13-ejemplo-ilustrativo-de-un-módulo-futuro)

---

## 1. Requisitos previos

| Requisito | Detalle |
|---|---|
| Node.js | ≥ 20.19 (el backend usa `node --test` y `node --watch`) |
| Dependencias | `npm ci` y `npm run web:ci` (versiones exactas de los lockfiles; instalación completa en el README §3). `npm install` / `npm run web:install` solo para agregar o actualizar dependencias. No agregue dependencias a la base común sin acordarlo |
| Su motor | Instalado y accesible, con un usuario de mínimo privilegio para la aplicación |
| Decisión del equipo | **Asignación de motores confirmada.** La Fase I indica Laboratorio → PostgreSQL y Odontología → MySQL, pero la sección del Hospital dice «implementado en Mysql» con llaves `SERIAL` (propias de PostgreSQL) y Firebase no aparece asignado. El enunciado exige cuatro motores distintos |
| Secreto JWT | Valor compartido de `JWT_SECRET`, `JWT_ISSUER` y `JWT_AUDIENCE` (o, si lo acuerdan, claves asimétricas) |
| Identificador de institución | En minúsculas y único. Sugeridos: `hospital_general`, `clinica_odontologica`, `laboratorio_clinico` (Pediatría usa `centro_pediatrico`) |

## 2. Qué debe entregar cada integrante

| Entregable | Dónde | Obligatorio |
|---|---|---|
| Router Express de su institución, que atienda `GET /api/sesion` y sus rutas | `instituciones/<carpeta>/backend/` (§6) | Sí |
| Adaptador de persistencia de su motor detrás de sus puertos | dentro de su carpeta | Sí |
| Tabla de permisos por rol (como `instituciones/pediatria/backend/permisos.js`) | dentro de su carpeta | Sí |
| Manifiesto del frontend `modulo.js`, `api.js` y páginas | `instituciones/<carpeta>/frontend/` | Sí |
| Prueba de contrato del manifiesto | `tests/frontend-modulos.test.js` | Sí |
| Variables de conexión de su motor documentadas en `.env.example` (sin valores reales) | raíz | Sí |
| Su parte del documento comparativo: modelado, consistencia, seguridad y justificación del motor | `docs/` | Sí |

## 3. Contrato de sesión

**El backend es la única fuente de autoridad.** El navegador nunca elige la institución ni el motor, ni decodifica el token para decidir permisos.

### 3.1 Token (JWT)

| Claim | Valor | Validación (ver `instituciones/pediatria/backend/security.js`) |
|---|---|---|
| `alg` | `HS256` | Se rechaza `none` y cualquier otro algoritmo |
| `iss` / `aud` | `JWT_ISSUER` / `JWT_AUDIENCE` | Deben coincidir |
| `sub` | identificador del usuario (≤ 80 caracteres) | Obligatorio |
| `rol` | rol propio de la institución | Debe existir en la tabla de permisos de esa institución |
| `institucion` | identificador de la institución | Decide el módulo (y con él el motor) en el enrutador |
| `exp` | expiración | **Obligatoria**; un token vencido responde `401 TOKEN_EXPIRADO` |

El token viaja en `Authorization: Bearer <JWT>`. El frontend lo guarda en `sessionStorage` (se pierde al cerrar la pestaña) y nunca guarda credenciales de bases de datos.

### 3.2 `GET /api/sesion` (obligatorio en cada institución)

```json
{
  "usuario": "USUARIO-DEMO",
  "rol": "medico",
  "institucion": "centro_pediatrico",
  "institucion_nombre": "Centro Médico Pediátrico",
  "motor": "MongoDB",
  "permisos": ["panel.ver", "pacientes.listar", "historial.leer", "clinico.escribir"],
  "expira": "2026-10-24T07:56:21.000Z",
  "capacidades": { "perimetro_cefalico_opcional": true }
}
```

| Campo | Uso |
|---|---|
| `institucion` | El frontend carga **solo** el módulo con ese identificador |
| `institucion_nombre` | Se muestra en el encabezado y el menú lateral |
| `motor` | Informativo para diagnóstico y pruebas. **La interfaz no lo muestra** (requisito: la interfaz no cambia según el motor) |
| `permisos` | Qué secciones y acciones se muestran. Si falta, la interfaz no muestra ninguna sección |
| `expira` | La interfaz cierra la sesión al vencer, aunque no haya peticiones |
| `capacidades` | Extensiones propias opcionales (Pediatría informa si el perímetro cefálico es opcional según el validador instalado) |

### 3.3 Obtención del token

- **Inicio de sesión común (pendiente del equipo).** Debe redirigir a `https://<host>/#access_token=<JWT>`. La interfaz lee el fragmento (no viaja al servidor), lo borra de la URL y llama a `/api/sesion`.
- **Mientras tanto.** La pantalla de acceso permite pegar un token y ofrece un modo de desarrollo **solo para la institución que atiende este backend**, sin contraseña, desactivado con `NODE_ENV=production`.
- **Varias instituciones por usuario (no implementado).** El backend debería informar `instituciones_autorizadas` y emitir un token por institución; la interfaz solo podría cambiar entre las listadas por el servidor.

## 4. Contrato HTTP y errores

- JSON en ambos sentidos, `Cache-Control: no-store` en `/api` y `/auth`, fechas en ISO 8601 UTC.
- Listados paginados: `?q=&limite=&pagina=` → `{ "items": [...], "total": n }`.
- Identificadores en la ruta: `^[A-Za-z0-9_-]{1,40}$` (otro formato → `400 VALIDACION`).
- Cada ruta vuelve a autorizar en el servidor: ocultar un botón no es seguridad.

### 4.1 Formato de error (obligatorio)

```json
{ "error": "Mensaje legible en español", "codigo": "CODIGO_ESTABLE", "detalles": [{ "campo": "tutores.0.dpi", "mensaje": "Obligatorio" }] }
```

`detalles` solo en errores de validación. Nunca incluya trazas, consultas SQL ni datos clínicos en el mensaje.

| Situación | Estado | `codigo` |
|---|---|---|
| Datos inválidos (esquema, JSON malformado, identificador en la ruta) | 400 | `VALIDACION` (con `detalles` cuando aplica) |
| Regla de negocio incumplida (p. ej., fecha anterior al nacimiento) | 400 | `REGLA_NEGOCIO` |
| Sin token | 401 | `NO_AUTENTICADO` |
| Token alterado, de otro emisor o mal formado | 401 | `TOKEN_INVALIDO` |
| Sesión expirada | 401 | `TOKEN_EXPIRADO` |
| Rol sin permiso | 403 | `ROL_SIN_PERMISO` |
| Institución no registrada en el servidor | 403 | `INSTITUCION_NO_REGISTRADA` |
| Token de otra institución en un módulo | 403 | `INSTITUCION_NO_AUTORIZADA` |
| Acceso prohibido por regla (p. ej., historial archivado para el médico) | 403 | `PROHIBIDO` |
| Recurso inexistente | 404 | `NO_ENCONTRADO` |
| Ruta inexistente | 404 | `RUTA_NO_ENCONTRADA` |
| Conflicto (duplicado, dosis ya aplicada, historial archivado) | 409 | `CONFLICTO` |
| Cuerpo demasiado grande | 413 | `SOLICITUD_DEMASIADO_GRANDE` |
| Referencia a otro recurso inexistente (médico, vacuna) | 422 | `REFERENCIA_INVALIDA` |
| El motor rechazó el documento o la fila (validador, CHECK, regla de seguridad) | 422 | `VALIDACION_MOTOR` |
| Demasiadas solicitudes | 429 | `DEMASIADAS_SOLICITUDES` |
| Error interno | 500 | `ERROR_INTERNO` (mensaje genérico) |

Pediatría cumple esta tabla (`instituciones/pediatria/tests/api.test.js`, «toda respuesta de error trae { error, codigo } estable»). El cliente común (`apps/web/src/plataforma/api/http.js`) convierte cualquier error en `ApiError { status, codigo, detalles }`, cierra la sesión ante un `401` y muestra `403` como «Acceso restringido».

## 5. Operaciones comunes y extensiones institucionales

Las reglas de negocio del enunciado (registrar consulta, agregar diagnóstico, recetar medicamento) son comunes, pero **cada institución conserva su propio modelo de persistencia**: documentos en MongoDB o Firebase, tablas normalizadas en PostgreSQL o MySQL. El contrato común se define en la frontera HTTP, no en la base de datos.

### 5.1 Rutas sugeridas

| Operación | Ruta sugerida | Datos comunes mínimos | Pediatría hoy |
|---|---|---|---|
| Listar / buscar pacientes | `GET /api/pacientes?q=&estado=&limite=&pagina=` | `{ items: [{ id_paciente, nombres, apellidos, fecha_nacimiento, sexo, estado_historial }], total }` | ✔ además `sexo` como filtro y contadores clínicos por rol |
| Registrar paciente | `POST /api/pacientes` | `nombres, apellidos, fecha_nacimiento, sexo` → `201 { id_paciente }` | ✔ exige `tutores[]` con un principal (extensión) |
| Obtener expediente | `GET /api/pacientes/:id` | datos generales + `estado_historial` | ✔ embebe tutores, consultas, controles y esquema |
| Registrar consulta | `POST /api/pacientes/:id/consultas` | `id_medico, fecha_hora, motivo, observaciones?` → `201 { id_consulta }` | ✔ admite en la misma operación diagnósticos, tratamiento, receta y control de crecimiento |
| Agregar diagnóstico | `POST …/consultas/:c/diagnosticos` | `{ codigo, descripcion }` | ✔ |
| Establecer tratamiento | `PUT …/consultas/:c/tratamiento` | `{ descripcion, recomendaciones? }` | ✔ conserva versiones anteriores |
| Recetar | `POST …/consultas/:c/prescripciones` | `{ indicaciones_generales?, medicamentos: [{ nombre, dosis, frecuencia, duracion, via_administracion }] }` | ✔ |
| Historial de medicamentos | `GET /api/pacientes/:id/prescripciones` | lista plana, más reciente primero | ✔ |
| Archivar historial | `PATCH /api/pacientes/:id/archivar` | `{ motivo_archivado }`; el historial queda en solo lectura | ✔ |
| Auditoría | `GET /api/auditoria?id_paciente=&accion=&limite=` | eventos con actor, acción, fecha y resultado | ✔ |

### 5.2 Extensiones (se quedan en cada institución)

| Institución | Ejemplos de extensión |
|---|---|
| Centro Pediátrico (implementado) | tutores, controles de crecimiento, esquema de vacunación, DPI enmascarado para el médico |
| Hospital General (propuesta) | citas, hospitalizaciones, camas, signos vitales, alergias, transacciones estrictas |
| Clínica Odontológica (propuesta) | odontograma, piezas dentales, tratamientos por pieza, agenda de secretaría |
| Laboratorio Clínico (propuesta) | órdenes de examen, resultados con estructura variable por tipo de examen |

Use el prefijo de su institución para rutas exclusivas (`/api/odontograma/...`) y para permisos exclusivos (`odontologia.odontograma.editar`).

### 5.3 Adaptación de los endpoints actuales de Pediatría

No se modifican los endpoints de Pediatría para «igualarlos». Si una vista común futura necesita un formato distinto, se agrega un **adaptador en el `api.js` del módulo** (frontend) o una ruta nueva, sin romper las existentes. Diferencias conocidas:

- El identificador del paciente es `id_paciente` (código `P001`); no existe «documento de identidad» del niño. El DPI pertenece al tutor y solo los roles administrativos buscan por él.
- El registro exige tutores; otra institución puede no tenerlos.
- `GET /api/pacientes/:id` responde distinto según el permiso (`historial.leer` → completo; si no, usar `…/administrativo`).

## 6. Backend: conectar su institución y su motor

### 6.1 Cómo funciona hoy

```
petición /api/* ─▶ crearEnrutadorInstituciones (valida el JWT una sola vez)
                    └─▶ módulos[payload.institucion].router
                          └─▶ casos de uso (instituciones/pediatria/backend/application) ─▶ puertos (instituciones/pediatria/backend/ports) ─▶ adaptador del motor
```

`instituciones/pediatria/backend/app.js` registra solo Pediatría:

```js
app.use('/api', crearEnrutadorInstituciones({
  [INSTITUCION]: { nombre: 'Centro Médico Pediátrico', motor: 'MongoDB', router: crearRouterPediatria(servicios) }
}));
```

### 6.2 Pasos para otra institución

1. **Carpeta propia** `instituciones/<carpeta>/backend/` (se crea al empezar a escribirlo; ver [`ARQUITECTURA.md`](ARQUITECTURA.md) §7), sin importar nada del adaptador MongoDB de Pediatría. Por ejemplo:
   ```
   instituciones/hospital/backend/
     dominio/  aplicacion/  puertos/  adaptadores/<motor>/  rutas.js  permisos.js  conexion.js
   instituciones/hospital/tests/        pruebas propias (comando test:hospital en package.json)
   ```
2. **Puertos y adaptador.** Sus casos de uso dependen de sus puertos; el adaptador implementa esos puertos con su motor (`pg`, `mysql2`, `firebase-admin`…). La consistencia la decide cada motor: transacciones SQL en PostgreSQL/MySQL; en Firebase, transacciones o lotes de escritura.
3. **Conexión propia.** Variables con prefijo (`HOSPITAL_DB_URL`, …) documentadas en `.env.example`. Nunca reutilice la conexión ni el usuario de MongoDB.
4. **Router.** Exporte `crearRouterHospital(servicios)`, que:
   - exija su propia institución (defensa en profundidad, como `requireAuth` en `instituciones/pediatria/backend/security.js`);
   - atienda `GET /sesion` con el contrato §3.2;
   - autorice cada ruta con su tabla de permisos;
   - responda errores con el formato §4.1.
5. **Registro.** Una línea en la composición del servidor (hoy `instituciones/pediatria/backend/app.js`, que aloja el servidor común mientras sea el único backend; ver [`ARQUITECTURA.md`](ARQUITECTURA.md) §5):
   ```js
   hospital_general: { nombre: 'Hospital General', motor: '<motor confirmado>', router: crearRouterHospital(serviciosHospital) }
   ```
   Hasta entonces, un token de esa institución recibe `403 INSTITUCION_NO_REGISTRADA`.
6. **Arranque tolerante.** Si su motor no está disponible, su router debe responder `503` con `codigo` propio en sus rutas, sin impedir que las demás instituciones funcionen.

## 7. Frontend: registrar su módulo

### 7.1 Estructura

```
apps/web/src/plataforma/      BASE COMÚN (no depende de ninguna institución); alias @plataforma
  api/http.js                 cliente HTTP, ApiError
  sesion/                     SesionProvider / useSesion
  modulos/contrato.js         validarModulo, crearRegistro, navegación por permiso, migas
  modulos/registro.js         LISTA de módulos conectados de esta interfaz
  layout/ ui/ paginas/ formato.js tema.js
instituciones/                alias @instituciones
  pediatria/frontend/         módulo del Centro Médico Pediátrico (implementado)
  hospital/frontend/          Hospital General (preparado, pendiente de integración)
  odontologia/frontend/       Clínica Odontológica (preparado, pendiente de integración)
  laboratorio/frontend/       Laboratorio Clínico (preparado, pendiente de integración)
```

Cada módulo pendiente ya trae `modulo.js`, `api.js` (sin operaciones), `paginas/` y `componentes/`, y su institución un `README.md`. Para continuarlo, siga [`FRONTEND_EQUIPO.md`](FRONTEND_EQUIPO.md) §4–§7.

### 7.2 Manifiesto (`instituciones/<carpeta>/frontend/modulo.js`, sin JSX)

| Campo | Obligatorio | Descripción |
|---|---|---|
| `contrato` | sí | `1` |
| `institucion` | sí | **igual** al claim del JWT y a la clave del enrutador del backend |
| `nombre`, `sigla`, `descripcion` | `nombre` | textos de la interfaz |
| `roles` | sí | `{ clave: etiqueta }` |
| `crearApi(http)` | sí | endpoints del módulo sobre el cliente común |
| `rutas` | sí | `[{ path, titulo?, permiso?, cargar: () => import('./paginas/X.jsx') }]`; rutas relativas y una de inicio `''` |
| `navegacion` | no | `[{ to, etiqueta, icono, permiso?, grupo?, exacto? }]`; `grupo` crea un separador con título |
| `accionRapida` | no | `{ to, etiqueta, permiso }` en el encabezado |

`validarModulo` rechaza rutas absolutas o duplicadas, navegación hacia rutas inexistentes, permisos mal formados y la falta de inicio. `crearRegistro` impide registrar una institución dos veces.

### 7.3 Registro

```js
// apps/web/src/plataforma/modulos/registro.js
export const registro = crearRegistro([
  pediatria,
  hospital // solo cuando su backend ya atienda /api/sesion
]);
```

### 7.4 Pantallas y API

```jsx
import { useSesion } from '@plataforma/sesion/SesionContext.jsx';
import { Card, DataTable, PageHeader, useCarga, ErrorState, LoadingState } from '@plataforma/ui/index.js';

export default function Pacientes() {
  const { api, puede } = useSesion();             // api = crearApi(http) de SU módulo
  const { datos, cargando, error, recargar } = useCarga(() => api.pacientes.listar({ limite: 20 }), [api]);
  // ...
}
```

`api.js` usa siempre `http.get/post/put/patch` del cliente común: así reciben el token, el manejo de `401` y los `ApiError` sin código adicional.

## 8. Componentes compartidos

Importe desde `@plataforma/ui/index.js` (`apps/web/src/plataforma/ui/index.js`). El detalle visual y los tokens están en [`DISENO.md`](DISENO.md).

| Componente | Uso |
|---|---|
| `PageHeader` | título, descripción y acciones de la página (un solo `h1`) |
| `Card` | sección con título, descripción y acciones |
| `StatCard` | indicador con contexto obligatorio de qué incluye el número |
| `DataTable` | tabla accesible; en móvil cada fila se convierte en ficha |
| `Pager` | paginación con rango («Mostrando 21–40 de 57») |
| `SearchBar`, `FilterBar`, `FormField`, `BotonEnviar` | búsqueda, filtros y formularios accesibles |
| `Tabs` | pestañas con teclado (flechas) |
| `StatusBadge` | estado con tono (`ok`, `warn`, `bad`, `info`, `primary`) |
| `KeyValue` | pares dato–valor |
| `Dialogo`, `useConfirmar`, `useNotificar` | modales nativos, confirmaciones y notificaciones |
| `LoadingState`, `EmptyState`, `ErrorState`, `Alerta` | estados de carga, vacío y error (incluida la caída del servidor) |
| `useCarga`, `useEnvio` | carga con recarga y envío sin doble clic |
| `Icon` | iconos de trazo propios (sin dependencias) |

Reglas: use los tokens `--color-*` (nunca colores fijos), no muestre el motor en la interfaz, y deje que el servidor decida los permisos.

## 9. Permisos

Cada institución mapea **sus** roles a estos permisos comunes y la misma tabla debe autorizar sus rutas (Pediatría: `instituciones/pediatria/backend/permisos.js`).

| Permiso | Significado |
|---|---|
| `panel.ver` | Panel principal |
| `pacientes.listar` · `pacientes.ver_administrativo` | Buscar pacientes y ver datos generales |
| `pacientes.registrar` · `pacientes.editar` | Alta y edición administrativa |
| `historial.leer` | Leer información clínica de historiales activos |
| `historial.leer_archivados` · `historial.archivar` | Archivados y archivo lógico |
| `clinico.escribir` | Consultas, diagnósticos, tratamientos y recetas |
| `catalogos.ver` · `catalogos.editar` | Catálogos de la institución |
| `auditoria.leer` | Bitácora |

Formato obligatorio `recurso.accion` en minúsculas. `instituciones/pediatria/tests/permisos.test.js` comprueba en Pediatría que cada permiso anunciado coincide con la autorización real; repliquen esa prueba.

## 10. Cómo verificar la integración

1. `npm test`: agregue su manifiesto a `tests/frontend-modulos.test.js` (valida el contrato y los permisos).
2. Backend: pruebas HTTP de su router con un doble de sus puertos (como `instituciones/pediatria/tests/doubles/memoria.js`) y pruebas de integración contra una base **desechable** de su motor.
3. Sesión: con un token de su institución, `GET /api/sesion` responde el contrato §3.2; con un token de otra institución, `403`.
4. Errores: replique la prueba «toda respuesta de error trae { error, codigo } estable».
5. `npm run build`: el frontend compila.
6. Navegador: inicie sesión con su token y compruebe que solo aparece su módulo, que la navegación respeta los permisos y que no hay desplazamiento horizontal a 390 px.
7. `npm run test:e2e` debe seguir en verde (protege a Pediatría de regresiones).

## 11. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| «Institución no disponible en esta interfaz» | El backend aceptó el token pero `registro.js` no tiene un módulo con ese `institucion` |
| `403 INSTITUCION_NO_REGISTRADA` | Falta registrar su router en `crearEnrutadorInstituciones` |
| `401 TOKEN_INVALIDO` con un token recién emitido | `JWT_SECRET`, `JWT_ISSUER` o `JWT_AUDIENCE` distintos entre servicios |
| La interfaz no muestra ninguna sección | `/api/sesion` no devuelve `permisos` (estado `sesion_incompleta`) |
| `npm test` falla en el contrato | ruta absoluta, ruta duplicada, falta la ruta `''`, navegación hacia una ruta inexistente o permiso sin punto |
| Un botón visible devuelve 403 | La navegación usa un permiso distinto del que exige la ruta del backend |
| Colores incorrectos en tema oscuro | Se usaron colores fijos en lugar de tokens `--color-*` |
| CORS bloqueado con el frontend en otro origen | Configure `CORS_ORIGIN` con la lista de orígenes permitidos |

## 12. Qué no modificar directamente

Proponga los cambios al equipo antes de tocar:

- `apps/web/src/plataforma/**` (cliente HTTP, sesión, contrato, layout, componentes, tema) y los tokens de `apps/web/src/styles.css`.
- `instituciones/pediatria/backend/api/enrutadorInstituciones.js`, `instituciones/pediatria/backend/security.js` y el formato de errores de `instituciones/pediatria/backend/api/middleware.js`.
- `instituciones/pediatria/frontend/**`, `instituciones/pediatria/backend/permisos.js`, `instituciones/pediatria/backend/adapters/mongo/**` y la base `centro_pediatrico_db` (pertenecen al módulo pediátrico).

Sí pueden modificar libremente su carpeta de módulo, su router, sus adaptadores y su línea en `registro.js` y en la composición del servidor. La tabla de propiedad de carpetas está en [`FRONTEND_EQUIPO.md`](FRONTEND_EQUIPO.md) §2.

## 13. Ejemplo ilustrativo de un módulo futuro

> **Ilustrativo.** El módulo real del Hospital ya existe en `instituciones/hospital/frontend/` en estado pendiente (sin operaciones en `api.js`, `roles` vacíos). Este ejemplo muestra cómo podría quedar **después** de conectarlo; no debe copiarse a `registro.js` hasta que el backend del Hospital General atienda `/api/sesion`.

```js
// instituciones/hospital/frontend/api.js
import { seg } from '@plataforma/api/http.js';
export function crearApiHospital({ get, post, patch }) {
  const P = id => `/api/pacientes/${seg(id)}`;
  return {
    pacientes: { listar: p => get('/api/pacientes', p), crear: d => post('/api/pacientes', d), obtener: id => get(P(id)) },
    consultas: { crear: (id, d) => post(`${P(id)}/consultas`, d) },
    archivar: (id, motivo_archivado) => patch(`${P(id)}/archivar`, { motivo_archivado })
  };
}
```

```js
// instituciones/hospital/frontend/modulo.js
import { crearApiHospital } from './api.js';
export default {
  contrato: 1,
  institucion: 'hospital_general',
  nombre: 'Hospital General',
  sigla: 'HG',
  roles: { medico: 'Médico', enfermeria: 'Enfermería', recepcion: 'Recepción', administrador: 'Administrador' },
  crearApi: crearApiHospital,
  rutas: [
    { path: '', permiso: 'panel.ver', cargar: () => import('./paginas/Panel.jsx') },
    { path: 'pacientes', titulo: 'Pacientes', permiso: 'pacientes.listar', cargar: () => import('./paginas/Pacientes.jsx') },
    { path: 'pacientes/:id', titulo: p => p.id, permiso: 'pacientes.ver_administrativo', cargar: () => import('./paginas/Expediente.jsx') }
  ],
  navegacion: [
    { to: '/', etiqueta: 'Panel', icono: 'panel', permiso: 'panel.ver', exacto: true },
    { to: '/pacientes', etiqueta: 'Pacientes', icono: 'pacientes', permiso: 'pacientes.listar' }
  ],
  accionRapida: { to: '/pacientes', etiqueta: 'Buscar paciente', permiso: 'pacientes.listar' }
};
```

```js
// instituciones/hospital/backend/rutas.js  (backend, ilustrativo)
const express = require('express');
function crearRouterHospital(servicios, { permisosDe, exigirPermiso }) {
  const r = express.Router();
  r.use((req, res, next) => (req.actor?.institucion === 'hospital_general' ? next()
    : res.status(403).json({ error: 'Usuario/institución no autorizados', codigo: 'INSTITUCION_NO_AUTORIZADA' })));
  r.get('/sesion', (req, res) => res.json({
    usuario: req.actor.id, rol: req.actor.rol, institucion: 'hospital_general', institucion_nombre: 'Hospital General',
    motor: '<motor confirmado>', permisos: permisosDe(req.actor.rol), expira: new Date(req.actor.exp * 1000).toISOString()
  }));
  r.get('/pacientes', exigirPermiso('pacientes.listar'), async (req, res, next) => {
    try { res.json(await servicios.pacientes.listar(req.query)); } catch (e) { next(e); }
  });
  return r;
}
module.exports = { crearRouterHospital };
```
