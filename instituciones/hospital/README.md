# Módulo Hospital General

| | |
|---|---|
| Estado | **Preparado visualmente · pendiente de integración** (no registrado en `apps/web/src/plataforma/modulos/registro.js`) |
| Identificador | `hospital_general` (debe coincidir con el claim `institucion` del JWT y con la clave del backend) |
| Responsable | Ely (`docs/ARQUITECTURA.md` §6) |
| Motor | Por confirmar por el equipo (`docs/ARQUITECTURA.md` §6) |
| Vista previa | `npm run web:dev` → <http://localhost:5173/vista-previa/hospital_general> |

## Contenido

No hay carpeta `backend/` todavía: se crea cuando el responsable empiece a escribirlo (`docs/ARQUITECTURA.md` §7), junto con `tests/` y `docs/` propios.

```
instituciones/hospital/
  README.md                    este archivo
  frontend/                    módulo React (lo carga apps/web; sin package.json propio)
    modulo.js                    manifiesto: rutas, navegación, permisos, acción rápida
    api.js                       punto de integración con SU backend (hoy sin operaciones)
    paginas/
      Panel.jsx                  indicadores (—), consultas recientes, accesos rápidos
      Pacientes.jsx              búsqueda y listado (también lo usa Archivados)
      PacienteNuevo.jsx          registro con los datos comunes (formulario deshabilitado)
      Expediente.jsx             pestañas: datos generales, consultas, diagnósticos, tratamientos, medicamentos y prescripciones
      Citas.jsx                  agenda (extensión propuesta)
      Archivados.jsx             historiales archivados
    componentes/
      EncabezadoExpediente.jsx   encabezado del expediente y datos clave
```

Rutas: `/`, `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id[/:seccion]`, `/citas`, `/archivados`.
Permisos: comunes (`panel.ver`, `pacientes.listar`, `pacientes.registrar`, `pacientes.ver_administrativo`, `historial.leer_archivados`) y `hospital.citas.ver` (propuesta).

## Qué falta (lo decide el responsable del Hospital)

1. Backend propio con su motor que atienda `GET /api/sesion` y las rutas del contrato común (`docs/GUIA_INTEGRACION_EQUIPO.md` §3–§6).
2. `roles` del manifiesto y los permisos reales de cada ruta.
3. Operaciones en `frontend/api.js` y carga real en cada página (`docs/FRONTEND_EQUIPO.md` §5–§7).
4. Campos propios del hospital (hoy son espacios reservados) y modelo de citas.
5. Registrar el módulo en `registro.js` (una línea, coordinada).

Mientras tanto no hay datos ficticios, ni peticiones, ni mensajes de «guardado».
