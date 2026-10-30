# Módulo Clínica Odontológica

| | |
|---|---|
| Estado | **Preparado visualmente · pendiente de integración** (no registrado en `apps/web/src/plataforma/modulos/registro.js`) |
| Identificador | `clinica_odontologica` (debe coincidir con el claim `institucion` del JWT y con la clave del backend) |
| Responsable | Eddy (`docs/ARQUITECTURA.md` §6) |
| Motor | Por confirmar por el equipo (`docs/ARQUITECTURA.md` §6) |
| Vista previa | `npm run web:dev` → <http://localhost:5173/vista-previa/clinica_odontologica> |

## Contenido

No hay carpeta `backend/` todavía: se crea cuando el responsable empiece a escribirlo (`docs/ARQUITECTURA.md` §7), junto con `tests/` y `docs/` propios.

```
instituciones/odontologia/
  README.md                    este archivo
  frontend/                    módulo React (lo carga apps/web; sin package.json propio)
    modulo.js                    manifiesto: rutas, navegación, permisos, acción rápida
    api.js                       punto de integración con SU backend (hoy sin operaciones)
    paginas/
      Panel.jsx                  indicadores (—), próximas citas, accesos rápidos
      Pacientes.jsx              búsqueda y listado (también lo usa Archivados)
      PacienteNuevo.jsx          registro de cuatro secciones con resumen lateral (deshabilitado)
      Expediente.jsx             pestañas: datos generales, consultas, diagnósticos, tratamientos, prescripciones, piezas dentales
      Citas.jsx                  citas odontológicas (extensión propuesta)
      NuevaConsulta.jsx          atención, evaluación, diagnósticos, tratamiento por pieza y receta
      Archivar.jsx               motivos de baja, detalles y confirmación (diseño)
      Administracion.jsx         catálogos y bitácora
      Archivados.jsx             historiales archivados
    componentes/
      EncabezadoExpediente.jsx   encabezado del expediente y datos clave
      PiezasDentales.jsx         mapa visual seleccionable y detalle por pieza (sin datos clínicos)
```

Rutas: `/`, `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id[/:seccion]` (incluye `piezas`), `/pacientes/:id/consultas/nueva`, `/pacientes/:id/archivar`, `/citas`, `/catalogos`, `/bitacora`, `/archivados`.
Permisos: comunes y `odontologia.citas.ver` (propuesta).

## Piezas dentales y odontograma

`PiezasDentales.jsx` presenta una **plantilla visual**, con selección local de una posición del diseño. No asigna numeración clínica ni representa el estado dental de un paciente. El formulario de detalle por pieza permanece deshabilitado. Cuando el responsable defina el contrato de datos:

1. Vincular la numeración, superficies, estados y tratamientos reales en `frontend/componentes/PiezasDentales.jsx` (o un componente propio), conservando los tokens y componentes compartidos.
2. Declarar la operación en `api.js` y cargarla en la pestaña «Piezas dentales» de `frontend/paginas/Expediente.jsx`.
3. No hace falta modificar la plataforma compartida.

## Qué falta (lo decide el responsable de la Clínica)

Backend propio con `GET /api/sesion`, `roles` y permisos reales, operaciones de `api.js`, campos propios, modelo de citas y piezas, y el registro en `registro.js` (`docs/FRONTEND_EQUIPO.md` §7). Sin datos ficticios ni peticiones mientras tanto.

## Recorrido del diseño

`/vista-previa/clinica_odontologica/pacientes` → estructura del expediente → pestañas, «Ver diseño de consulta» o «Ver diseño de archivado». Registro, agenda, catálogos y bitácora usan la misma composición de tarjetas, indicadores, formularios y paneles de contexto que las demás instituciones. Ver `docs/DISENO.md`.
