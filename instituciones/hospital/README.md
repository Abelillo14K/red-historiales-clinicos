# Módulo Hospital General

| | |
|---|---|
| Estado | **Implementado**: backend MySQL, interfaz conectada y montado en el servidor común |
| Identificador | `hospital_general` (claim `institucion` del JWT, clave del enrutador y del módulo) |
| Responsable | Ely (`docs/GUIA_EQUIPO.md` §1) |
| Motor | MySQL 8 |
| Puesta en marcha | [`backend/README.md`](backend/README.md) |

## Contenido

```
instituciones/hospital/
  README.md                    este archivo
  backend/                     Express + MySQL (ESM, con su propio package.json)
    sql/                         esquema de 29 tablas y datos base ficticios
    scripts/crear-usuario.js     npm run hospital:usuario
    src/modulo.js                composición para el servidor común
    src/router.js                rutas relativas a /api, incluida GET /sesion
    src/rutas/                   panel, pacientes, clínico, citas, hospitalización, catálogos, auditoría e inicio de sesión
    src/seguridad.js             verificación del JWT y permisos por rol
  frontend/                    módulo React (lo carga apps/web; sin package.json propio)
    modulo.js                    manifiesto: rutas, navegación, permisos, acción rápida
    api.js                       llamadas a su backend
    paginas/                     panel, pacientes, expediente, consulta, citas, hospitalización, catálogos, bitácora y archivo
    componentes/                 encabezado del expediente y buscador de pacientes
```

Rutas: `/`, `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id[/:seccion]`, `/pacientes/:id/consultas/nueva`, `/pacientes/:id/archivar`, `/citas`, `/hospitalizacion`, `/catalogos`, `/bitacora`, `/archivados`.

## Acceso

Se entra por el formulario común con una cuenta que empiece con `hosp.`. La cuenta se valida en la tabla `usuario` de MySQL. Roles: `administrador`, `medico`, `enfermeria` y `recepcion`; sus permisos están en `backend/src/seguridad.js`.

## Pendiente

Todavía no tiene pruebas automatizadas propias.
