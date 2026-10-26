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
      PacienteNuevo.jsx          registro con los datos comunes (formulario deshabilitado)
      Expediente.jsx             pestañas: datos generales, solicitudes, resultados, historial de resultados, atenciones relacionadas
      Solicitudes.jsx            solicitudes de exámenes (extensión propuesta)
      Resultados.jsx             resultados de laboratorio + visor
      Archivados.jsx             historiales archivados
    componentes/
      EncabezadoExpediente.jsx   encabezado del expediente y datos clave
      VisorResultado.jsx         PUNTO DE EXTENSIÓN: presentación de resultados por tipo de examen
```

Rutas: `/`, `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id[/:seccion]`, `/solicitudes`, `/resultados`, `/archivados`.
Permisos: comunes y `laboratorio.solicitudes.ver`, `laboratorio.resultados.ver` (propuestas).

## Resultados con estructura variable

No se definió un esquema rígido de resultados. `frontend/componentes/VisorResultado.jsx` expone `RENDERIZADORES = { <tipo_examen>: Componente }`:

- Registre un componente por tipo de examen cuando defina sus campos, unidades, rangos y validaciones.
- Un tipo sin componente propio se muestra de forma genérica (pares campo–valor), sin perder datos.
- Las validaciones de cada tipo pertenecen al backend del laboratorio; el frontend solo presenta.

## Qué falta (lo decide el responsable del Laboratorio)

Backend propio con `GET /api/sesion`, `roles` y permisos reales, operaciones de `api.js`, modelo de solicitudes y resultados, y el registro en `registro.js` (`docs/FRONTEND_EQUIPO.md` §7). Sin datos ficticios ni peticiones mientras tanto.
