# Frontend para el equipo — Red de Historiales Clínicos

Guía para que los **tres integrantes** trabajen en paralelo sobre una sola interfaz, con un solo sistema visual y un módulo por institución, sin modificar el código de los demás.

> **Estado real (25/10/2026).** Solo el **Centro Médico Pediátrico** (MongoDB) está implementado y conectado. **Hospital General**, **Clínica Odontológica** y **Laboratorio Clínico** tienen su frontend **preparado visualmente y pendiente de integración**: no tienen backend, no están registrados, no muestran datos ni guardan nada. Responsables: Pediatría, el propietario del proyecto; Hospital, Ely; Odontología y Laboratorio, Eddy. Los motores de las instituciones pendientes **no están confirmados** ([`ARQUITECTURA.md`](ARQUITECTURA.md) §6).

Complementa a [`ARQUITECTURA.md`](ARQUITECTURA.md) (estructura del repositorio, responsabilidades y asignación) y a [`GUIA_INTEGRACION_EQUIPO.md`](GUIA_INTEGRACION_EQUIPO.md) (contratos de sesión, HTTP, errores, operaciones comunes y backend).

## Índice
1. [Arquitectura de la plataforma](#1-arquitectura-de-la-plataforma)
2. [Estructura de carpetas y propiedad](#2-estructura-de-carpetas-y-propiedad)
3. [Cómo se incorpora cada institución](#3-cómo-se-incorpora-cada-institución)
4. [Añadir páginas y componentes](#4-añadir-páginas-y-componentes)
5. [Conectar una API real](#5-conectar-una-api-real)
6. [Declarar permisos](#6-declarar-permisos)
7. [De pendiente a conectado](#7-de-pendiente-a-conectado)
8. [Componentes compartidos](#8-componentes-compartidos)
9. [Ejecutar el proyecto](#9-ejecutar-el-proyecto)
10. [Vista previa de desarrollo y sus limitaciones](#10-vista-previa-de-desarrollo-y-sus-limitaciones)
11. [Trabajo en paralelo de tres integrantes](#11-trabajo-en-paralelo-de-tres-integrantes)

---

## 1. Arquitectura de la plataforma

```
Navegador ─ una sola interfaz (React + Vite)
  apps/web/src/plataforma/  ← base común: sesión, permisos, cliente HTTP, layout, componentes, tema
     │  carga SOLO el módulo de la institución que informa el backend en GET /api/sesion
     ▼
  instituciones/<institución>/frontend/  ← manifiesto (modulo.js), api.js, páginas y componentes propios
     │  HTTP con el JWT de la sesión (cliente común)
     ▼
Backend de la institución ─ su router, sus casos de uso, su adaptador ─▶ SU motor de datos
```

- **Una sesión, una institución.** El backend valida el JWT y responde `GET /api/sesion` con `institucion` y `permisos`. La interfaz monta el módulo registrado con ese identificador. No existe un selector libre de instituciones.
- **Portal de instituciones (`/instituciones`).** Flujo: inicio de sesión → portal → panel de la institución → «Volver a instituciones» (menú lateral o menú de usuario). El portal es **navegación**, no un selector de permisos: no cambia la sesión ni el token, no llama a la API y no modifica claims. Una tarjeta está **Disponible** (acción «Ingresar») solo si su módulo está registrado y la sesión verificada pertenece a esa institución. Si el módulo está registrado pero la sesión es de otra institución, aparece **Sin autorización**. Si no está registrado, aparece **Pendiente de integración**: en producción no tiene acción y en desarrollo ofrece «Ver diseño», que abre la vista previa (§10). Los enlaces profundos se conservan, de modo que tras el inicio de sesión se abre la página pedida en lugar del portal. Nombre, sigla, descripción e icono salen de `instituciones/<carpeta>/frontend/presentacion.js`, que el manifiesto reutiliza; no llevan identificador ni páginas, así que el portal puede incluirlos en producción. Punto de integración multiinstitución: `sesionAutorizaA()` en `plataforma/portal/portal.js` (ver §7).
- **El backend autoriza.** Los permisos del frontend solo deciden qué se **muestra**. Cada ruta del backend vuelve a autorizar.
- **Persistencia independiente.** Cada institución tiene su backend y su motor. Solo se comparte el contrato HTTP; cada esquema interno queda en su módulo.
- **Contexto de módulo.** `useModulo()` entrega `{ modulo, api, puede, enlace, vistaPrevia }` tanto en la aplicación real como en la vista previa. Las páginas de los módulos nuevos lo usan en lugar de `useSesion()`.

## 2. Estructura de carpetas y propiedad

La estructura completa del repositorio y sus responsables está en [`ARQUITECTURA.md`](ARQUITECTURA.md) §2. Para el frontend:

```
apps/web/                           ÚNICA aplicación (React + Vite) — COMPARTIDA, cambios acordados
├── alias.js                        alias @plataforma y @instituciones
├── vite.config.js
└── src/
    ├── App.jsx · main.jsx          rutas raíz (login, vista previa en desarrollo, zona privada)
    ├── styles.css                  tokens y estilos (docs/DISENO.md)
    └── plataforma/
        ├── api/http.js             cliente HTTP común, ApiError, seg(), qs()
        ├── sesion/                 sesión (JWT en sessionStorage), useSesion()
        ├── modulos/                contrato.js, registro.js (módulos CONECTADOS), ModuloContext.jsx, RutasModulo.jsx
        ├── layout/                 AppLayout, Sidebar, Header, Breadcrumbs, InstitutionIndicator, UserMenu
        ├── ui/                     componentes compartidos (§8)
        ├── paginas/                Login y estados de sesión
        ├── portal/                 portal de instituciones (/instituciones): portal.js (estados, sin React), Portal.jsx
        ├── vista-previa/           SOLO DESARROLLO: estado de integración, vista previa y «Ver diseño» del portal
        └── formato.js · tema.js
instituciones/
├── pediatria/frontend/             Centro Médico Pediátrico (implementado; integrante 2)
├── hospital/frontend/              Hospital General (pendiente)
├── odontologia/frontend/           Clínica Odontológica (pendiente)
└── laboratorio/frontend/           Laboratorio Clínico (pendiente)
    ├── presentacion.js             nombre, sigla, descripción e icono (portal y manifiesto)
    ├── modulo.js                   manifiesto: rutas, navegación, permisos, roles
    ├── api.js                      punto de integración con SU backend
    ├── paginas/                    pantallas del módulo
    └── componentes/                componentes propios de la institución
```

Importaciones: dentro de su carpeta, rutas relativas; hacia la plataforma, el alias `@plataforma/...` ([`ARQUITECTURA.md`](ARQUITECTURA.md) §3). Nunca archivos de otra institución.

| Ruta | Pertenece a | Quién la modifica |
|---|---|---|
| `instituciones/<carpeta>/frontend/**` | la institución | **libremente** su responsable |
| `instituciones/pediatria/frontend/**` | Centro Pediátrico | solo el integrante 2 |
| `apps/web/src/plataforma/modulos/registro.js` | todos | una línea por institución, **avisando** al equipo |
| `apps/web/src/plataforma/**` (resto), `App.jsx`, `main.jsx`, `styles.css` | todos | **solo con acuerdo** del equipo (afecta a las cuatro instituciones) |
| `tests/frontend-modulos.test.js`, `tests/frontend-equipo.test.js` | todos | agregar sus casos sin borrar los ajenos |
| `instituciones/pediatria/backend/` (backend de Pediatría), `instituciones/pediatria/backend/permisos.js`, `instituciones/pediatria/backend/adapters/mongo/**` | Centro Pediátrico | solo el integrante 2 |

## 3. Cómo se incorpora cada institución

| Etapa | Qué existe | Dónde se ve |
|---|---|---|
| 1. Preparada (hoy) | carpeta, manifiesto, páginas con estado pendiente, `api.js` vacío | solo en `/vista-previa/<institucion>` (desarrollo) |
| 2. Backend en desarrollo | router propio que atiende `GET /api/sesion` (guía de integración §6) | pruebas del backend |
| 3. API declarada | operaciones reales en `api.js`; páginas que cargan y envían datos | vista previa: «Operaciones de API: N declaradas» |
| 4. Conectada | módulo agregado en `registro.js`; token con su `institucion` | aplicación real, con la sesión que emite su backend |

Identificadores (iguales al claim `institucion` del JWT y a la clave del enrutador del backend): `centro_pediatrico`, `hospital_general`, `clinica_odontologica`, `laboratorio_clinico`.

## 4. Añadir páginas y componentes

1. **Crear la página** en `instituciones/<carpeta>/frontend/paginas/MiPagina.jsx` con los componentes compartidos:
   ```jsx
   import { useModulo } from '@plataforma/modulos/ModuloContext.jsx';
   import { Card, PageHeader, PendienteIntegracion, TablaPendiente } from '@plataforma/ui/index.js';

   export default function MiPagina() {
     const { enlace } = useModulo();
     return (
       <>
         <PageHeader titulo="Mi página" descripcion="Qué permite hacer." />   {/* un solo h1 */}
         <PendienteIntegracion compacto />
         <Card><TablaPendiente titulo="Mi página" columnas={[{ clave: 'a', titulo: 'Columna A' }]} /></Card>
       </>
     );
   }
   ```
2. **Registrar la ruta** en `modulo.js` (relativa, sin `/` inicial; las fijas antes que las de parámetros):
   ```js
   { path: 'mi-pagina', titulo: 'Mi página', permiso: 'hospital.mi_recurso.ver', cargar: () => import('./paginas/MiPagina.jsx') }
   ```
   `titulo` alimenta las migas de pan; puede ser una función `(params, contexto) => texto`.
3. **Agregar la navegación** (opcional): `{ to: '/mi-pagina', etiqueta: 'Mi página', icono: 'consulta', permiso: '…', grupo?: 'Administración' }`.
4. **Enlaces internos** siempre con `enlace('/ruta')` de `useModulo()`: funcionan igual en la aplicación real y en la vista previa.
5. **Componentes propios** en `instituciones/<carpeta>/frontend/componentes/`. Si un componente sirve a varias instituciones, propóngalo para `apps/web/src/plataforma/ui/` en lugar de copiarlo.
6. Reglas visuales: solo tokens `--color-*` (nunca colores fijos), un `h1` por pantalla, campos con `FormField` (etiqueta asociada), y el motor nunca se muestra en la interfaz.
7. `npm test` valida el manifiesto (contrato, permisos, rutas e importaciones).

## 5. Conectar una API real

Todo pasa por el cliente común (`@plataforma/api/http.js`): agrega `Authorization: Bearer <JWT>`, cierra la sesión ante `401`, y convierte cualquier error en `ApiError { status, codigo, detalles }` con el formato común `{ error, codigo, detalles? }`.

**1. Declarar operaciones en `api.js`** (solo las que su backend ya atiende):
```js
import { seg } from '@plataforma/api/http.js';
export function crearApiHospital({ get, post, put, patch }) {
  const P = id => `/api/pacientes/${seg(id)}`;          // seg() codifica cada segmento
  return {
    pacientes: {
      listar: params => get('/api/pacientes', params),   // params → ?q=&estado=&limite=&pagina=
      crear: datos => post('/api/pacientes', datos),
      obtener: id => get(P(id))
    }
  };
}
```

**2. Cargar datos en la página** con `useCarga` y los estados comunes:
```jsx
const { api } = useModulo();
const { datos, cargando, error, recargar } = useCarga(() => api.pacientes.listar({ limite: 20, pagina }), [api, pagina]);
// <ErrorState error={error} onReintentar={recargar} />  {cargando ? <LoadingState /> : <DataTable … filas={datos.items} />}
```
`ErrorState` presenta `403` como «Acceso restringido» y `status 0` como «Sin conexión con el servidor».

**3. Enviar formularios** con `useEnvio` y notificar **solo después** de que el backend confirme:
```jsx
const envio = useEnvio(); const notificar = useNotificar();
const r = await envio.enviar(() => api.pacientes.crear(datos));
if (r) notificar(`Paciente ${r.id_paciente} registrado`);   // nunca antes de la respuesta
```
Reemplace `FormularioVistaPrevia` por un `<form>` real con `BotonEnviar enviando={envio.enviando}` y `envio.error` en una `Alerta`. Los errores de validación del servidor llegan en `error.detalles` (`campo`, `mensaje`).

**Responsabilidades del backend de cada institución:** atender `GET /api/sesion` (contrato §3.2 de la guía), autorizar cada ruta con su tabla de permisos, responder errores con el formato común, generar los identificadores y aplicar las reglas de negocio y la consistencia propias de su motor. El frontend no simula nada de eso.

**Rutas y respuestas:** use las rutas sugeridas de la guía de integración §5.1 para las operaciones comunes (listar `{ items, total }`, crear `201 { id_… }`, archivar con `motivo_archivado`). Las extensiones propias (citas, piezas dentales, solicitudes, resultados) llevan el prefijo de su institución si no son comunes. **No hace falta que los motores usen el mismo esquema de persistencia**: si su respuesta difiere, adáptela en `api.js` (una función que transforma) y no en la plataforma.

## 6. Declarar permisos

- Cada `ruta` y entrada de `navegacion` puede declarar `permiso: 'recurso.accion'`. Sin permiso en la sesión, la ruta muestra «Sin permiso» y la entrada no aparece en el menú.
- En una página: `const { puede } = useModulo(); puede('pacientes.registrar') && <Link …>`.
- **Permisos comunes** (guía §9): `panel.ver`, `pacientes.listar`, `pacientes.ver_administrativo`, `pacientes.registrar`, `pacientes.editar`, `historial.leer`, `historial.leer_archivados`, `historial.archivar`, `clinico.escribir`, `catalogos.ver`, `catalogos.editar`, `auditoria.leer`.
- **Permisos exclusivos** con el prefijo de la institución. Propuestos hoy (a confirmar por cada backend): `hospital.citas.ver`, `odontologia.citas.ver`, `laboratorio.solicitudes.ver`, `laboratorio.resultados.ver`.
- `roles` del manifiesto (`{ clave: etiqueta }`) está **vacío** en los módulos pendientes: lo llena cada responsable con los roles de su backend. Las etiquetas se muestran en el menú de usuario y en el acceso de desarrollo.
- La tabla rol → permisos vive en el backend de cada institución y se entrega en `/api/sesion`. Replique `instituciones/pediatria/tests/permisos.test.js` (cada permiso anunciado coincide con la autorización real).

## 7. De pendiente a conectado

Lista de comprobación del responsable de cada institución:

1. ☐ Backend con su motor que atiende `GET /api/sesion` y sus rutas (guía de integración §6), registrado en el enrutador del servidor.
2. ☐ `modulo.js`: `roles` reales; permisos de cada ruta iguales a los de su backend.
3. ☐ `api.js`: operaciones reales (§5).
4. ☐ Cada página: quitar `PendienteIntegracion` y `TablaPendiente`; cargar con `useCarga` y mostrar con `DataTable` + `Pager`; formularios reales con `useEnvio`; botones de acción habilitados según `puede()`.
5. ☐ Expediente: sustituir `ID_VISTA_PREVIA` y los datos «—» por los datos del paciente cargado.
6. ☐ Componentes reservados (`PiezasDentales`, `VisorResultado`) con el contrato de datos definido.
7. ☐ `apps/web/src/plataforma/modulos/registro.js`: agregar el módulo (una línea, avisando al equipo).
8. ☐ `tests/frontend-modulos.test.js`: agregar pruebas de su manifiesto (permisos frente a su backend, navegación por rol). `tests/frontend-equipo.test.js` deja de aplicar las restricciones de «pendiente» a un módulo registrado de forma automática.
9. ☐ `npm test`, `npm run build`, `npm run test:e2e` y `npm run test:e2e:vista-previa` en verde.
10. ☐ Actualizar `instituciones/<carpeta>/README.md` y la tabla de asignación de [`ARQUITECTURA.md`](ARQUITECTURA.md) §6.

Al registrarse, el módulo **desaparece de la vista previa** (la portada lo marca «Implementado») y se usa con la sesión real. En el portal pasa a «Disponible» para las sesiones de su institución y a «Sin autorización» para las demás.

**Multiinstitución (pendiente, requiere autorización del backend).** Hoy cada sesión pertenece a una sola institución y el servidor común atiende el módulo de esa sesión. Para que un usuario cambie de institución sin volver a iniciar sesión, el backend deberá: (1) informar en `/api/sesion` las instituciones autorizadas para el usuario y (2) ofrecer un mecanismo autorizado que emita la sesión de la otra institución. El frontend solo cambiaría `sesionAutorizaA()` y la acción «Ingresar» (`plataforma/portal/`). El navegador nunca fabrica tokens, nunca edita claims y nunca elige la institución por su cuenta.

## 8. Componentes compartidos

Importar desde `@plataforma/ui/index.js` (`apps/web/src/plataforma/ui/index.js`) (detalle visual en [`DISENO.md`](DISENO.md)).

| Componente | Uso |
|---|---|
| `PageHeader` | título (`h1`), descripción y acciones |
| `Card` | sección con título, descripción y acciones |
| `StatCard` | indicador con contexto; sin backend use `valor="—" texto` (nunca un número inventado) |
| `DataTable` · `Pager` | tabla accesible (fichas en móvil) y paginación |
| `TablaPendiente` | tabla sin datos que conserva sus encabezados (módulos pendientes) |
| `FilterBar` · `SearchBar` · `FormField` · `BotonEnviar` | filtros y formularios accesibles |
| `FormularioVistaPrevia` | formulario deshabilitado sin envío (módulos pendientes) |
| `Tabs` · `KeyValue` · `StatusBadge` | pestañas con teclado, pares dato–valor, distintivos de estado |
| `Dialogo` · `useConfirmar` · `useNotificar` | modales, confirmaciones y notificaciones |
| `LoadingState` · `EmptyState` · `ErrorState` · `Alerta` | estados de carga, vacío y error |
| `PendienteIntegracion` · `TEXTO_PENDIENTE` | aviso común «preparado visualmente, pendiente de integración» |
| `useCarga` · `useEnvio` | carga con recarga y envío sin doble clic |
| `Icon` | iconos de trazo (incluye `hospital`, `diente`, `matraz`, `resultado`) |
| `useModulo` · `ModuloProvider` · `ID_VISTA_PREVIA` | contexto del módulo (`@plataforma/modulos/ModuloContext.jsx`) |
| clases `.reserved-slot`, `.patient-header`, `.quick-actions`, `.stats` | patrones de diseño reutilizables |

## 9. Ejecutar el proyecto

Instalación completa en el [README](../README.md) §3. Resumen:

```powershell
npm ci; npm run web:ci                     # dependencias exactas
npm run dev                                # Terminal 1: API (Pediatría) en http://localhost:3001
npm run web:dev                            # Terminal 2: interfaz en http://localhost:5173
```

| Dirección | Qué muestra |
|---|---|
| `http://localhost:5173/login` | acceso real (Pediatría en modo desarrollo) y enlace a la vista previa |
| `http://localhost:5173/instituciones` | portal de instituciones (requiere sesión); en desarrollo, «Ver diseño» en las pendientes |
| `http://localhost:5173/vista-previa` | estado de integración de las cuatro instituciones |
| `http://localhost:5173/vista-previa/hospital_general` | módulo del Hospital (igual con `clinica_odontologica` y `laboratorio_clinico`) |

La vista previa no necesita la API ni MongoDB: basta `npm run web:dev`.

| Prueba | Qué cubre |
|---|---|
| `npm test` (`npm run test:plataforma`) | incluye `tests/frontend-equipo.test.js`: estructura, contrato, permisos, `api.js` sin peticiones, páginas sin envíos ni datos, aislamiento entre módulos y **compilación de producción sin vista previa** |
| `npm test` (`tests/frontend-portal.test.js`) | estados del portal según la sesión, presentación única por institución, destino tras el inicio de sesión, rutas reservadas y portal sin acceso a tokens ni peticiones |
| `npm run test:e2e` | Pediatría completa en Edge/Chrome con MongoDB desechable, más el portal en producción: cuatro tarjetas, regreso sin cambiar el token, pendientes sin acceso, teclado, claro/oscuro en 1920/1366/820/390 px, enlace profundo y sesión vencida, alterada o cerrada |
| `npm run test:e2e:vista-previa` | vista previa en Edge/Chrome con Vite real: «Ver diseño» desde el portal para cada pendiente, con su propio menú, y regreso al portal; todas las pantallas y pestañas, sin campos ni acciones habilitadas, claro y oscuro, 1920/1366/820/390 px, accesibilidad, contraste WCAG AA, sesión de Pediatría intacta y sin peticiones de otras instituciones. Capturas en `tests/e2e/capturas-vista-previa/` |

## 10. Vista previa de desarrollo y sus limitaciones

Garantías (comprobadas por las pruebas):

- Existe **solo con `vite`** (`import.meta.env.DEV`); la compilación de producción no contiene su código ni el de los módulos no registrados.
- Solo se atiende desde el propio equipo (`localhost`), también con `vite --host`.
- **No usa ni modifica la sesión** (no lee `sessionStorage`, no llama a `/auth/dev-login`, no emite tokens). Si hay una sesión de Pediatría abierta, sigue intacta.
- **No construye la api del módulo** (`api = null`): las páginas no pueden hacer peticiones. La única petición que puede verse es la verificación de la propia sesión (`GET /api/sesion`) que la plataforma hace al cargar la página.
- **No permite escribir**: formularios y acciones deshabilitados, sin notificaciones de «guardado» ni identificadores generados.
- Solo muestra módulos **no registrados**; uno conectado se usa con su sesión real.

Limitaciones:

- **Muestra todas las secciones**: los permisos reales los define cada backend, así que la vista previa no refleja qué verá cada rol.
- No sirve para probar datos, validaciones, errores del servidor ni rendimiento: no hay backend.
- El expediente se muestra sin paciente (segmento `vista-previa` en la URL), con datos «—».
- Los textos «Pendiente de integración» y los espacios reservados desaparecen solo cuando cada responsable los reemplaza (§7).

## 11. Trabajo en paralelo de tres integrantes

Son **tres integrantes para cuatro instituciones**; la asignación de responsables y motores, el reparto de tareas compartidas y el flujo de trabajo de cada integrante están en [`ARQUITECTURA.md`](ARQUITECTURA.md) §6–§7 (único lugar). Aquí, solo las reglas del frontend.

### Reglas para no pisarse

1. Cada integrante trabaja **dentro de su carpeta** (`instituciones/<carpeta>/`). Ahí no hace falta pedir permiso.
2. Un módulo **no importa** archivos de otra institución (la prueba lo impide). Lo que sea común se propone para `apps/web/src/plataforma/`.
3. Los cambios en `apps/web/` (plataforma, `App.jsx`, `styles.css`, `alias.js`, `vite.config.js`), el contrato o el cliente HTTP se **acuerdan antes** con el equipo, porque afectan a las cuatro instituciones. Mejor agregar (un componente o una opción nueva) que cambiar el comportamiento existente.
4. `registro.js` se toca una sola vez por institución, al conectarla, y se avisa.
5. Nadie modifica `instituciones/pediatria/frontend/` ni el backend de Pediatría: si necesitan algo de allí, se pide al integrante 2.
6. Antes de entregar cambios: `npm test` y `npm run build` en verde. Si se tocó algo compartido, también `npm run test:e2e` y `npm run test:e2e:vista-previa`.
7. Control de versiones: ver [`ARQUITECTURA.md`](ARQUITECTURA.md) §7.
