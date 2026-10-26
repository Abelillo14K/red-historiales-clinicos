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
      PacienteNuevo.jsx          registro con los datos comunes (formulario deshabilitado)
      Expediente.jsx             pestañas: datos generales, consultas, diagnósticos, tratamientos, prescripciones, piezas dentales
      Citas.jsx                  citas odontológicas (extensión propuesta)
      Archivados.jsx             historiales archivados
    componentes/
      EncabezadoExpediente.jsx   encabezado del expediente y datos clave
      PiezasDentales.jsx         PUNTO DE EXTENSIÓN: piezas dentales y tratamientos por pieza
```

Rutas: `/`, `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id[/:seccion]` (incluye `piezas`), `/citas`, `/archivados`.
Permisos: comunes y `odontologia.citas.ver` (propuesta).

## Piezas dentales y odontograma

No se construyó un odontograma: no existe todavía un contrato de datos (numeración de piezas, superficies, estados, tratamientos por pieza). Cuando el responsable lo defina:

1. Implementar el componente en `frontend/componentes/PiezasDentales.jsx` (o `frontend/componentes/Odontograma.jsx`) con los componentes compartidos y los tokens `--color-*` (funciona en claro y oscuro).
2. Declarar la operación en `api.js` y cargarla en la pestaña «Piezas dentales» de `frontend/paginas/Expediente.jsx`.
3. No hace falta modificar la plataforma compartida.

## Qué falta (lo decide el responsable de la Clínica)

Backend propio con `GET /api/sesion`, `roles` y permisos reales, operaciones de `api.js`, campos propios, modelo de citas y piezas, y el registro en `registro.js` (`docs/FRONTEND_EQUIPO.md` §7). Sin datos ficticios ni peticiones mientras tanto.
