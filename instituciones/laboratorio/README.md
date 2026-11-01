# Módulo Laboratorio Clínico

| | |
|---|---|
| Estado | **Preparado visualmente · pendiente de integración** (no registrado en `apps/web/src/plataforma/modulos/registro.js`) |
| Identificador | `laboratorio_clinico` (debe coincidir con el claim `institucion` del JWT y con la clave del backend) |
| Responsable | Eddy (`docs/ARQUITECTURA.md` §6) |
| Motor | Por confirmar por el equipo (`docs/ARQUITECTURA.md` §6) |
| Vista previa | `npm run web:dev` → <http://localhost:5173/vista-previa/laboratorio_clinico> |

## Contenido

No hay carpeta `backend/` todavía: se crea cuando el responsable empiece a escribirlo (`docs/ARQUITECTURA.md` §7), junto con `tests/` y `docs/` propios.

```
instituciones/laboratorio/
  README.md                    este archivo
  frontend/                    módulo React (lo carga apps/web; sin package.json propio)
    modulo.js                    manifiesto: rutas, navegación, permisos, acción rápida
    api.js                       punto de integración con SU backend (hoy sin operaciones)
    paginas/
      Panel.jsx                  indicadores (—), solicitudes recientes, accesos rápidos
      Pacientes.jsx              registro y búsqueda (también lo usa Archivados)
      PacienteNuevo.jsx          registro de tres secciones y resumen lateral (deshabilitado)
      Expediente.jsx             pestañas: datos generales, solicitudes, resultados, historial de resultados, atenciones relacionadas
      Solicitudes.jsx            solicitudes de exámenes (extensión propuesta)
      NuevaSolicitud.jsx         paciente, exámenes, muestra e indicaciones (diseño)
      Resultados.jsx             listado e ingreso a registro e informe
      RegistrarResultado.jsx     origen, parámetros y validación (diseño)
      DetalleResultado.jsx       plantilla de informe y contexto lateral
      Archivar.jsx               motivos de baja, detalles y confirmación (diseño)
      Administracion.jsx         catálogos y bitácora
      Archivados.jsx             historiales archivados
    componentes/
      EncabezadoExpediente.jsx   encabezado del expediente y datos clave
      VisorResultado.jsx         plantilla de informe; renderizadores por tipo de examen y vista genérica
```

Rutas: `/`, `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id[/:seccion]`, `/pacientes/:id/archivar`, `/solicitudes`, `/solicitudes/nueva`, `/resultados`, `/resultados/nuevo`, `/resultados/:resultado`, `/catalogos`, `/bitacora`, `/archivados`.
Permisos: comunes y extensiones `laboratorio.solicitudes.*` / `laboratorio.resultados.*` (propuestas; roles y permisos definitivos corresponden a su backend).

## Resultados con estructura variable

No se definió un esquema rígido de resultados. `frontend/componentes/VisorResultado.jsx` expone `RENDERIZADORES = { <tipo_examen>: Componente }`:

Sin un resultado seleccionado muestra una plantilla con identificación, parámetros, observaciones y validación, sin valores, unidades o referencias clínicas inventadas.

- Registre un componente por tipo de examen cuando defina sus campos, unidades, rangos y validaciones.
- Un tipo sin componente propio se muestra de forma genérica (pares campo–valor), sin perder datos.
- Las validaciones de cada tipo pertenecen al backend del laboratorio; el frontend solo presenta.

## Qué falta (lo decide el responsable del Laboratorio)

Backend propio con `GET /api/sesion`, `roles` y permisos reales, operaciones de `api.js`, modelo de solicitudes y resultados, y el registro en `registro.js` (`docs/FRONTEND_EQUIPO.md` §7). Sin datos ficticios ni peticiones mientras tanto.

## Recorrido del diseño

`/vista-previa/laboratorio_clinico/pacientes` → estructura del expediente → pestañas y diseños de solicitud/archivo. Desde Solicitudes se abre «Ver diseño de solicitud»; desde Resultados, «Ver diseño de registro» y «Ver diseño del informe». Todas las páginas comparten los patrones de `docs/DISENO.md`.
