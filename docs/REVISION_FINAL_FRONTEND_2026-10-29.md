# Revisión técnica final del frontend y correcciones recientes

Fecha: 29/10/2026. Referencia: `HEAD a367d2a` (`chore: initial multi-institution clinical platform`).

## 1. Dictamen

**Apto para integrar el frontend y las correcciones revisadas, con observaciones no bloqueantes de ergonomía y mantenimiento.** No se encontraron regresiones funcionales bloqueantes en los escenarios comprobados. La integración de Hospital, Odontología y Laboratorio con sus backends continúa pendiente; sus nuevas pantallas son exclusivamente propuestas visuales.

El conjunto contiene dos objetivos distintos: rediseño visual y correcciones de integridad/auditoría del backend. Estas correcciones son justificadas y cuentan con regresiones automatizadas; no deben confundirse con un cambio exclusivamente cosmético.

Estado recibido: **80 archivos modificados con seguimiento y 17 archivos nuevos sin seguimiento**. Este informe añade un archivo nuevo de documentación: el estado final es 80 modificados y 18 sin seguimiento, si no existen cambios externos simultáneos. No se realizó commit, staging ni push.

Solo existe un commit en el historial local. Se comprobó también la referencia: `npm test` en HEAD pasó **108/108** (30 de plataforma y 78 de Pediatría) y su compilación fue correcta. El estado actual pasa **134/134** (30 + 104): **26 pruebas adicionales**.

## 2. Método y límites de la revisión

- Se revisaron los diffs respecto a HEAD, incluidos backend, scripts, pruebas y documentación.
- Se leyeron los 17 archivos sin seguimiento, incluido el PDF de seis páginas que origina el diseño.
- Se preparó un worktree temporal de HEAD, separado de la copia de trabajo, con dependencias de sus lockfiles y sin `.env`.
- Se ejecutaron ambas interfaces en Edge/Chromium 156 con API real de cada versión sobre doble en memoria y datos ficticios equivalentes. No se utilizó MongoDB para las capturas comparativas.
- Comparación específica: escritorio 1366×900 y móvil 390×844, en claro y oscuro. Se comprobaron 76 combinaciones de pantalla/tema/ancho en HEAD y 84 en la copia actual; además se capturaron diálogos, menú móvil, carga y error. Se repitió el recorrido de la copia actual después de los primeros ajustes y se revisaron nuevamente Login y Pacientes tras el ajuste final de tabla.
- Los E2E del proyecto amplían los anchos a 1920, 1366, 820 y 390 px; la vista previa recorre todas las páginas y pestañas declaradas en los tres módulos pendientes.
- La inspección visual directa se realizó sobre capturas completas y láminas comparativas; las combinaciones restantes se contrastaron mediante DOM, desbordes, identificadores, consola y el auditor de accesibilidad/contraste del proyecto.
- Las escrituras de las pruebas se realizaron en memoria o en procesos `mongod` desechables, incluidos standalone y replica set. No se inició el servidor normal contra la base real ni se ejecutaron seed, aplicación de validadores, respaldo o restauración sobre ella.
- No se modificaron `.env`, credenciales, respaldos ni configuración de MongoDB.
- Accesibilidad automática básica y contraste de texto no equivalen a una certificación WCAG completa ni a una evaluación con lector de pantalla real. No se evaluó carga masiva ni otros motores.

## 3. Inventario diferencial de los 80 archivos con seguimiento

La clasificación siguiente asigna una categoría principal a cada archivo para evitar contarlo dos veces. Un mismo cambio puede tener efectos secundarios de seguridad o presentación.

| Categoría principal | Archivos modificados |
|---|---:|
| Frontend, diseño y módulos institucionales | 49 |
| Componentes compartidos existentes | 3 |
| Backend, servicios y contratos | 8 |
| Persistencia MongoDB y control de índices | 3 |
| Seguridad/autenticación | 1 |
| Pruebas | 5 |
| Documentación | 11 |
| **Total** | **80** |

### 3.1 Frontend y diseño de plataforma — 7 archivos

| Archivo | Cambio, propósito y efecto |
|---|---|
| `apps/web/index.html` | Nombre «Red Clínica Integrada», metadatos, favicon azul y colores de tema. Conserva aplicación del tema antes de React. |
| `apps/web/src/main.jsx` | Importa `mockup.css` después de los estilos base. La nueva composición se aplica globalmente. |
| `apps/web/src/plataforma/layout/Sidebar.jsx` | Navegación navy, marca abreviada, título «Menú» e institución al pie. Conserva enlaces, filtros por permiso y control de contracción. |
| `apps/web/src/plataforma/modulos/registro.js` | Cambia únicamente el nombre visible de plataforma. Sigue registrándose solo Pediatría. |
| `apps/web/src/plataforma/paginas/Login.jsx` | Presentación dividida, tarjetas de cuatro instituciones y credenciales institucionales deshabilitadas. Mantiene token y acceso de desarrollo. Esta revisión añade un salto accesible al formulario en anchos pequeños. |
| `apps/web/src/plataforma/tema.js` | Actualiza `theme-color` para coincidir con las nuevas paletas; mantiene persistencia y modo sistema. |
| `apps/web/src/styles.css` | Paleta azul/navy en ambos temas, controles mayores, radios, sombras, sidebar de 260 px, encabezado de 76 px y selección sólida de pestañas. No cambia contratos HTTP. |

### 3.2 Componentes compartidos existentes — 3 archivos

| Archivo | Cambio, propósito y efecto |
|---|---|
| `apps/web/src/plataforma/ui/Formularios.jsx` | `mostrarAcciones` permite ubicar las acciones de los formularios de vista previa dentro del resumen. Se mantiene `fieldset disabled` y bloqueo de envío. |
| `apps/web/src/plataforma/ui/Pagina.jsx` | `Card` admite icono y aplica `id` al contenedor. Esto hace funcionar las anclas de sección, manteniendo la asociación con su título. |
| `apps/web/src/plataforma/ui/index.js` | Exporta las primitivas de flujo y patrones visuales nuevos. Conserva los nombres anteriores. |

### 3.3 Pediatría: páginas — 15 archivos

Base: `instituciones/pediatria/frontend/paginas/`.

| Archivo relativo | Cambio y efecto |
|---|---|
| `Archivados.jsx` | Introducción visual del archivo y explicación de acceso administrativo. |
| `Auditoria.jsx` | Indicadores y filtros para las nuevas acciones `LEER_PANEL`, `LISTAR_PACIENTES` y `LEER_VACUNACION_PENDIENTE`. |
| `Expediente.jsx` | Archivado en diálogo ancho con radios descriptivos y efectos de la baja; conserva motivo, confirmación y llamada existente. El resto del encabezado se transforma principalmente por CSS. |
| `Medicos.jsx` | Métricas de la vista y encabezado del directorio; no añade altas desde la interfaz. |
| `NuevaConsulta.jsx` | Anclas, secciones numeradas y resumen de diagnósticos, medicamentos y crecimiento con acciones laterales. Conserva validación y envío compuesto existentes. |
| `PacienteNuevo.jsx` | Secciones, anclas, progreso y resumen. Conserva nombres, tutores y contrato de alta pediátrico. |
| `Pacientes.jsx` | Acción explícita «Abrir historial», métricas obtenidas mediante una nueva llamada a `api.panel()` y llamada al registro. Esta revisión protege la edad de fragmentación y ajusta el relleno horizontal solo de esta tabla en escritorio. |
| `Panel.jsx` | Introducción institucional e iconos en tarjetas. Mantiene los seis indicadores y sus criterios. |
| `Vacunacion.jsx` | Métricas de catálogo, pendientes visibles y vencidas visibles; títulos con icono. No interpreta calendarios clínicos. |
| `expediente/AuditoriaPaciente.jsx` | Introducción y métricas de eventos del paciente. |
| `expediente/Consultas.jsx` | Indicadores y columna de contexto. La línea de tiempo y diálogos conservan sus operaciones. |
| `expediente/Crecimiento.jsx` | Último peso/talla y resumen de captura; gráficas y registros históricos mantienen su significado. |
| `expediente/Prescripciones.jsx` | Métricas y contexto lateral; conserva búsqueda, datos y diálogo de prescripción. |
| `expediente/Resumen.jsx` | Introducción, métricas e iconos. Duplica algunos totales que ya muestra «Resumen clínico»; es redundancia visual no bloqueante. |
| `expediente/VacunacionPaciente.jsx` | Contadores y resumen de programación. Conserva aplicación, cancelación, filtros y confirmaciones. |

### 3.4 Hospital: módulo y páginas — 8 archivos

Base: `instituciones/hospital/frontend/`.

| Archivo relativo | Cambio y efecto |
|---|---|
| `componentes/EncabezadoExpediente.jsx` | Datos clave del mockup y enlaces a diseños de consulta y archivado. No ejecutan esas operaciones. |
| `modulo.js` | Declara consulta, archivo, hospitalización, catálogos, bitácora y tres secciones adicionales del expediente. Los permisos nuevos son propuestas, sin registrar el módulo en producción. |
| `paginas/Archivados.jsx` | Introducción visual del archivo. |
| `paginas/Citas.jsx` | Reutiliza agenda compartida con campos deshabilitados. |
| `paginas/Expediente.jsx` | Añade exámenes, hospitalizaciones, antecedentes, signos vitales y contactos vacíos; abre Consultas por defecto. Datos generales sigue disponible como pestaña. |
| `paginas/PacienteNuevo.jsx` | Pasa de formulario mínimo a cinco secciones: identificación, contacto, emergencia, seguro y alergias. Son propuestas sin envío ni persistencia. |
| `paginas/Pacientes.jsx` | Columnas del mockup, indicadores vacíos, búsqueda propuesta y llamada al registro. |
| `paginas/Panel.jsx` | Introducción, iconos y distribución uniforme de indicadores vacíos. |

### 3.5 Odontología: módulo y páginas — 9 archivos

Base: `instituciones/odontologia/frontend/`.

| Archivo relativo | Cambio y efecto |
|---|---|
| `componentes/EncabezadoExpediente.jsx` | Reutiliza encabezado compartido y enlaza los diseños de consulta y archivo. |
| `componentes/PiezasDentales.jsx` | Sustituye espacio reservado por mapa seleccionable de posiciones visuales y campos deshabilitados. No es odontograma clínico ni asigna numeración dental real. |
| `modulo.js` | Añade consulta, archivo, catálogos y bitácora; conserva módulo pendiente. |
| `paginas/Archivados.jsx` | Introducción visual del archivo. |
| `paginas/Citas.jsx` | Agenda visual compartida. |
| `paginas/Expediente.jsx` | Métricas, contexto, contacto y antecedentes vacíos. |
| `paginas/PacienteNuevo.jsx` | Formulario visual de cuatro secciones con antecedentes y atención dental propuestos. |
| `paginas/Pacientes.jsx` | Indicadores, títulos y llamada al registro. |
| `paginas/Panel.jsx` | Introducción, iconos y disposición común. |

### 3.6 Laboratorio: módulo y páginas — 10 archivos

Base: `instituciones/laboratorio/frontend/`.

| Archivo relativo | Cambio y efecto |
|---|---|
| `componentes/EncabezadoExpediente.jsx` | Reutiliza encabezado común y enlaza diseño de solicitud/archivo. |
| `componentes/VisorResultado.jsx` | Sin resultado, muestra plantilla de informe con identificación, parámetros y validación vacíos. Conserva renderizadores por tipo y salida genérica para datos futuros. |
| `modulo.js` | Añade solicitud, registro/detalle de resultado, archivo, catálogos y bitácora. |
| `paginas/Archivados.jsx` | Introducción de expedientes conservados. |
| `paginas/Expediente.jsx` | Contexto lateral, métricas y contacto/origen de atención vacíos. |
| `paginas/PacienteNuevo.jsx` | Formulario visual de tres secciones con contacto y origen de atención propuestos. |
| `paginas/Pacientes.jsx` | Indicadores, títulos y llamada al registro. |
| `paginas/Panel.jsx` | Introducción e iconos compartidos. |
| `paginas/Resultados.jsx` | Enlaces a diseño de registro e informe; contexto lateral en lugar del visor incrustado anterior. |
| `paginas/Solicitudes.jsx` | Enlace a diseño de nueva solicitud, métricas y seguimiento visual. |

### 3.7 Backend — 8 archivos

Base: `instituciones/pediatria/backend/`.

| Archivo relativo | Corrección y efecto |
|---|---|
| `application/comun.js` | Las lecturas y el dev-login requieren persistir auditoría: fallo → `503 AUDITORIA_NO_DISPONIBLE`. Una denegación sobre archivados continúa siendo 403 aunque falle registrar su evento. Es un cambio deliberado de disponibilidad frente a HEAD. |
| `application/consultasService.js` | Mensaje de conflicto coherente con duplicado o nacimiento modificado durante la operación. |
| `application/crecimientoService.js` | Mensaje de conflicto actualizado para la protección concurrente. |
| `application/index.js` | Audita la lectura del panel, también para Secretaría. |
| `application/pacientesService.js` | Alta y edición comparten exclusión por identidad destino; búsqueda excluye al propio paciente; compara identidad previa y audita listados activos. Clave en JSON evita ambigüedad de separadores. Garantía limitada a una instancia del servicio. |
| `application/vacunacionService.js` | Audita pendientes y actualiza mensajes de conflictos concurrentes. |
| `ports/index.js` | Documenta firmas y garantías nuevas del repositorio; no cambia los nombres de sus métodos. |
| `server.js` | Verifica índices únicos esenciales antes de escuchar peticiones. No borra datos para forzar índices. |

### 3.8 Persistencia — 3 archivos

| Archivo | Corrección y efecto |
|---|---|
| `instituciones/pediatria/backend/adapters/mongo/index.js` | Clasifica índices únicos como esenciales y exporta su verificación. Las definiciones de índices existentes no cambian. |
| `instituciones/pediatria/backend/adapters/mongo/repositorios.js` | Búsqueda de duplicado con exclusión; edición condicional por identidad anterior; filtro atómico de nacimiento en consulta, crecimiento y programación/aplicación de vacuna; normaliza error 121 a `VALIDACION_MOTOR`. |
| `instituciones/pediatria/scripts/seed.js` | Informa fallos y devuelve salida no exitosa si un índice no puede crearse. No introduce altas ni borrados de documentos. No se ejecutó sobre la base real. |

### 3.9 Seguridad/autenticación — 1 archivo

`instituciones/pediatria/backend/security.js`: respuesta 503 con mensaje genérico y `AUTENTICACION_NO_DISPONIBLE` cuando falta configuración válida. No modifica firma, algoritmo, emisor, audiencia, expiración ni autorización del JWT.

### 3.10 Pruebas existentes — 5 archivos

| Archivo | Cambio y justificación |
|---|---|
| `instituciones/pediatria/tests/doubles/memoria.js` | Refleja exclusión del paciente actual, identidad previa y nacimiento vigente del adaptador MongoDB. |
| `instituciones/pediatria/tests/mongo.integration.test.js` | Nuevas carreras y conflictos sobre standalone/replica set; bitácora caída, recuperación, código de validador e índices esenciales. Los cambios de validador se limitan a bases desechables. |
| `instituciones/pediatria/tests/seguridad.test.js` | Comprueba el código estable de autenticación sin configuración, restaurando la variable del proceso de prueba. No escribe `.env`. |
| `instituciones/pediatria/tests/e2e/flujo-ui.e2e.js` | Adapta archivado a radios, comprueba progreso/resumen, filtros nuevos, recetas dentro de su tarjeta y más recorridos responsive. Esta revisión añade edad en una línea y salto móvil con movimiento de foco en ambos temas. |
| `tests/e2e/vista-previa.e2e.js` | Amplía rutas, pestañas, pantallas responsive, mapa dental y flujo de laboratorio. Conserva controles de no escritura y sesión intacta. |

### 3.11 Documentación existente — 11 archivos

| Archivo | Cambio |
|---|---|
| `README.md` | Conteos de pruebas actuales: 134, 104 y 12. |
| `docs/ARQUITECTURA.md` | Actualiza conteos. |
| `docs/DISENO.md` | Reescribe guía para el mockup, patrones nuevos, temas y comprobaciones. |
| `docs/GUIA_INTEGRACION_EQUIPO.md` | Corrige ruta de módulos y documenta los dos códigos 503. |
| `instituciones/hospital/README.md` | Nuevas páginas, rutas, propuestas y recorrido visual. |
| `instituciones/odontologia/README.md` | Nuevas páginas y alcance no clínico del mapa dental. |
| `instituciones/laboratorio/README.md` | Solicitud, captura, informe, rutas y estado pendiente. |
| `instituciones/pediatria/README.md` | Nuevas pruebas y garantías/limitaciones de auditoría e integridad. |
| `instituciones/pediatria/docs/MODELO_Y_DECISIONES.md` | Identidad, concurrencia, índices y descripción actualizada de validadores. |
| `instituciones/pediatria/docs/OPERACION_MONGODB.md` | Fallos de auditoría, exclusión por instancia e índices esenciales. |
| `instituciones/pediatria/docs/TRAZABILIDAD_REQUISITOS.md` | Evidencias, resultados y correcciones; distingue verificación histórica de la base real y pruebas desechables. |

## 4. Inventario de los 17 archivos nuevos recibidos

Todos fueron inspeccionados; no se limitó la revisión a `git diff`.

| Archivo nuevo | Justificación y alcance |
|---|---|
| `Historial Clínico — Mockup.pdf` | Fuente de diseño de seis páginas. Contiene datos de ejemplo, asignaciones de motores y comportamientos futuros; no demuestra implementación ni sustituye los contratos actuales. Conservar como referencia de diseño si se desea versionar esa fuente. |
| `apps/web/src/mockup.css` | Composición responsive navy/azul, resúmenes, pasos, encabezados, contexto, informe y mapa dental. Es necesario con los componentes actuales. |
| `apps/web/src/plataforma/ui/FlujoClinico.jsx` | Secciones numeradas, pasos, resumen y llamada al registro. Usados por Pediatría y las propuestas institucionales. |
| `apps/web/src/plataforma/ui/VistasInstitucionales.jsx` | Métricas, introducción, contexto y plantillas sin API; reduce duplicación entre instituciones. |
| `instituciones/hospital/frontend/paginas/Archivar.jsx` | Diseño de motivos, traslado, certificado y confirmación; envío deshabilitado. |
| `instituciones/hospital/frontend/paginas/NuevaConsulta.jsx` | Diseño de seis secciones de atención hospitalaria; sin escritura. |
| `instituciones/hospital/frontend/paginas/SeccionHospital.jsx` | Hospitalización, catálogos y bitácora vacíos, enlazados desde el módulo. |
| `instituciones/odontologia/frontend/paginas/Administracion.jsx` | Adapta plantilla común a catálogos y bitácora odontológicos. |
| `instituciones/odontologia/frontend/paginas/Archivar.jsx` | Adapta archivo común al expediente odontológico. |
| `instituciones/odontologia/frontend/paginas/NuevaConsulta.jsx` | Diseño de atención/evaluación/diagnóstico/tratamiento/receta, pendiente de contrato. |
| `instituciones/laboratorio/frontend/paginas/Administracion.jsx` | Catálogos y bitácora del laboratorio, sin datos. |
| `instituciones/laboratorio/frontend/paginas/Archivar.jsx` | Plantilla común de archivo para laboratorio. |
| `instituciones/laboratorio/frontend/paginas/DetalleResultado.jsx` | Informe vacío y contexto; sin selección real ni consultas HTTP. |
| `instituciones/laboratorio/frontend/paginas/NuevaSolicitud.jsx` | Diseño de paciente, exámenes, muestra e indicaciones. |
| `instituciones/laboratorio/frontend/paginas/RegistrarResultado.jsx` | Diseño de origen, parámetros y validación; estructura final por confirmar. |
| `instituciones/pediatria/tests/integridad-auditoria.test.js` | Regresiones de edición duplicada, carreras, auditoría y clasificación de índices. |
| `instituciones/pediatria/tests/soporte/carrerasNacimiento.js` | Intercalación determinista reutilizada por pruebas de memoria y MongoDB; comprueba ausencia de escritura parcial y éxito falso. |

Este informe, `docs/REVISION_FINAL_FRONTEND_2026-10-29.md`, es el único archivo nuevo de la auditoría dentro del repositorio. Los scripts auxiliares, el worktree de HEAD y la galería diferencial se encuentran en el directorio temporal indicado en §9.

## 5. Auditoría visual: mejoras y contrapartidas

| Área | Mejora confirmada frente a HEAD | Contrapartida / observación |
|---|---|---|
| Login | Identidad reconocible y correspondencia con el PDF; diferencia acceso institucional pendiente y desarrollo. | Más alto: 1048 px frente a 900 en escritorio; en móvil, 1831 frente a 1034 antes del ajuste. Se añadió un enlace directo con foco al formulario; no se redujo ni reordenó la presentación. |
| Portal | Tarjetas, controles y selección de institución coherentes con la nueva paleta. Conserva estado disponible/pendiente. | La lógica y estructura del portal no son nuevas: el cambio es por tokens, marca y estilos globales. |
| Panel | Iconos y valor/etiqueta mejor diferenciados; introducción institucional. | Ocupa más alto de pantalla; mantiene los seis indicadores y criterios anteriores. |
| Sidebar y encabezado | Navegación activa más evidente y contraste estable; institución sigue identificada. | Institución trasladada al pie y encabezado de 60 a 76 px; menos espacio vertical útil. No se pierde la indicación institucional del encabezado. |
| Listado | Acción explícita «Abrir historial», contexto de conteos y llamada al registro. | Más contenido antes de resultados y llamada adicional al panel. Fragmentación de edad corregida; tabla final sin desborde interno en los casos dirigidos de 1366/390 px. |
| Expediente | Encabezado del paciente más distinguible; pestañas visibles en varias filas. | En móvil, las pestañas del caso revisado pasan de 44 a 155 px; evitan desplazamiento horizontal, pero empujan el contenido clínico. |
| Formularios | Secciones numeradas, navegación por anclas, progreso y resumen; acciones visibles en columna lateral cuando hay espacio. | Más desplazamiento en móvil: registro del caso equivalente pasa de 1516 a 2267 px. El resumen se coloca al final. |
| Consultas | Contexto explícito, métricas y recetas adaptadas al ancho disponible mediante container query. | Menor ancho para la consulta y más altura. Caso equivalente: 1015→1536 px en escritorio y 1579→2606 px en móvil. |
| Vacunación | Resumen de programación y contadores de estados. | Algunos conteos reiteran información de los filtros; no cambia la semántica de pendientes/aplicadas/canceladas. |
| Crecimiento | Últimas medidas visibles, resumen de captura, gráficas legibles en ambos temas. | Las gráficas bajan por el nuevo contenido superior. No se añadieron percentiles ni interpretación clínica. |
| Archivado | Motivos explicados, consecuencias visibles y confirmación conservada. | Diálogo considerablemente más largo en móvil; requiere desplazamiento interno, sin pérdida de sus acciones. |
| Estados | Vacío, carga, error y reintento conservan jerarquía y contraste. | Las métricas nuevas pueden seguir mostrando datos anteriores durante una recarga o error; revisar el aviso antes de interpretar el resumen. |
| Hospital | Registro de cinco secciones y flujos completos de diseño; nuevas áreas claramente vacías. | Mayor alcance visual que HEAD, todavía sin contrato definitivo de hospitalización, alergias y exámenes. |
| Odontología | Plantilla de consulta y piezas visible y navegable. | El mapa tiene 16 posiciones de diseño: no debe presentarse como dentición/odontograma validado. |
| Laboratorio | Solicitud, captura e informe cuentan con recorridos propios y composición coherente. | No implementa muestras, resultados ni validación profesional reales. |

No se detectaron errores React no controlados, identificadores DOM duplicados ni desbordes de página en el recorrido diferencial. Los auditores básicos no reportaron fallos de etiquetas ni contraste. En los escenarios de error simulados, el navegador registró el 503 provocado expresamente; no se contabiliza como fallo inesperado de la aplicación.

## 6. Correcciones recientes verificadas y ajustes de esta revisión

### Correcciones recibidas que conviene conservar

1. **Duplicados al editar:** ya no se puede editar un paciente hasta la identidad de otro sin conflicto; se excluye el propio registro y se coordinan altas/ediciones de la misma instancia.
2. **Carreras de nacimiento:** consulta, crecimiento, programación y aplicación verifican la fecha vigente al escribir. El cambio incompatible no deja registro clínico ni evento de éxito parcial.
3. **Lecturas sin trazabilidad:** listado, panel y pendientes ahora auditan; si registrar la lectura falla, se devuelve 503 sin datos/token.
4. **Arranque sin unicidad:** un índice único esencial fallido impide atender peticiones. El script de índices informa fallos con código de salida correcto.
5. **Contrato de errores:** el adaptador MongoDB usa `VALIDACION_MOTOR`; autenticación sin configuración devuelve código estable.
6. **Recetas en columna estrecha:** la consulta de contenedor evita que las rejillas de medicamentos desborden su tarjeta al añadir contexto lateral.

### Ajustes localizados realizados en esta auditoría

- `Login.jsx`: enlace visible en anchos pequeños «Ir al formulario de acceso» y destino enfocable. Evita tener que recorrer manualmente toda la presentación. No altera autenticación ni elimina el contenido del mockup.
- `mockup.css` y `Pacientes.jsx`: edad en un fragmento sin salto de línea y relleno horizontal de 12 px solo para el listado de pacientes en escritorio. Corrige la compresión observada sin cambiar columnas, información ni presentación móvil.
- `flujo-ui.e2e.js`: aserciones de edad en una línea y de salto/foco al formulario en claro y oscuro. Se integran en los 27 pasos existentes.
- Este informe documenta el inventario y el dictamen. No se introdujeron refactorizaciones de arquitectura.

## 7. Seguridad, datos y regresiones

| Área | Comprobación y conclusión |
|---|---|
| Autorización y roles | `permisos.js` y rutas API no cambian respecto a HEAD. Pruebas de 12 permisos × 3 roles y rechazos HTTP directos aprobadas. |
| Autenticación | Firma/verificación y restricciones de dev-login conservadas. El único diff de `security.js` normaliza el error de configuración. |
| Aislamiento | Solo Pediatría registrada; producción excluye módulos pendientes y vista previa. Las pruebas comprueban imports entre instituciones, sesión intacta y ausencia de escritura en preview. |
| Historias clínicas | Flujo compuesto, diagnósticos, tratamientos con versiones, recetas, crecimiento y vacunas aprobados sobre MongoDB desechable. |
| Edición | Duplicados, edición parcial concurrente, exclusión del propio paciente y nacimiento vigente comprobados en memoria/standalone/replica set. |
| Archivado | Conserva documento, motivo y solo lectura. Médico no puede leer/modificar el expediente archivado; administrador sí puede consultarlo. |
| Auditoría | Fallo de bitácora bloquea lecturas sensibles; outbox de escrituras clínicas y transacciones mantienen sus pruebas. La dependencia de bitácora es un cambio funcional intencional, no una mejora puramente visual. |
| Conexión MongoDB | `backend/db.js` no tiene diff. No se cambiaron URI, pool ni configuración del servidor. |
| Validadores | `schema.js`, validadores MongoDB y su administración no tienen diff. Las pruebas aplican/revierten validadores exclusivamente en instancias desechables. |
| Respaldos | `scripts/respaldo/*` y `scripts/validadores.js` no tienen diff. No se ejecutó un ciclo de mongodump/mongorestore durante esta revisión: continuidad comprobada por ausencia de cambios, no por un nuevo simulacro completo de recuperación. |
| Sesión y HTTP | Contexto de sesión y cliente HTTP no tienen diff. Se conservan token, 401, expiración, fragmento de acceso, enlaces profundos y errores de conexión. |
| Dependencias | Ambos `package.json` y lockfiles no tienen diff. El rediseño no incorpora dependencias nuevas. |

### Regresiones potenciales y deuda no bloqueante

1. **Disponibilidad:** una caída de auditoría impide lecturas y dev-login; exige operación/monitorización de bitácora. Los denegados continúan rechazándose.
2. **Mayor trabajo al abrir Pacientes:** la nueva llamada a `/api/panel` obtiene agregaciones y, para roles clínicos, próximos pendientes, aunque esa pantalla solo usa ciertos contadores. También genera más auditoría. No se modificó el endpoint para optimizarlo en esta revisión.
3. **Unicidad por identidad limitada a una instancia:** sigue sin garantía entre procesos ni identificación inequívoca de homónimos; no fue introducida una restricción única sobre nombres.
4. **Auditoría de catálogos en standalone:** conserva su limitación anterior sin outbox recuperable; no es una regresión del rediseño.
5. **Más desplazamiento vertical:** ver mediciones de §5. No se compactaron arbitrariamente pantallas ni se emprendió otro rediseño.
6. **Nombre de la plataforma:** Login, favicon y registro usan «Red Clínica Integrada», mientras README y varias guías conservan «Red de Historiales Clínicos». Acordar nombre definitivo; no altera rutas ni tokens.
7. **Titular «Cuatro bases de datos»:** procede del mockup y expresa el objetivo; solo MongoDB funciona hoy. La documentación y el portal explican el alcance real. Conviene aclararlo si se presenta el Login fuera del contexto académico.
8. **Campos deshabilitados de credenciales:** son visuales y no capturan contraseñas. Pueden añadir confusión a un usuario que espere un login institucional operativo.
9. **CSS en dos capas:** `mockup.css` sobreescribe `.sidebar`, `.stat`, `.tabs`, `.kv` y otros selectores base. El orden de imports es relevante. Es deuda de mantenimiento acotada; no justifica ahora una reorganización global.
10. **CSS sin consumidor actual:** `.clinical-overview`, sus variantes `.allergies`/`.next-visit` y `.record-actions` no aparecen en JSX de la aplicación ni instituciones. Son restos del diseño; su retirada es opcional y no se realizó para no ampliar los ajustes.
11. **Duplicación de información:** los nuevos indicadores de Resumen repiten totales del bloque clínico; varios paneles de contexto repiten orden y código del paciente. Puede simplificarse en una iteración de UX acordada.
12. **Metadatos redundantes:** en `SeccionHospital.jsx`, las entradas locales de catálogos/bitácora no se usan para renderizar esas ramas, que delegan a la plantilla común. No causan fallo; limpieza opcional.
13. **Comentarios/guías menores:** el encabezado hospitalario conserva un comentario de acciones deshabilitadas aunque ahora son enlaces de diseño; las capturas históricas versionadas no equivalen a capturas actuales del rediseño. No bloquean ejecución.
14. **Advertencia Node `MODULE_TYPELESS_PACKAGE_JSON`:** aparece al importar manifiestos ESM desde la prueba CommonJS de preview. Ya existía esa combinación en HEAD. No debe aplicarse a ciegas `type: module` en la raíz porque el backend es CommonJS.
15. **Peso de estilos:** CSS de producción pasa de 55.47 a 75.04 kB (gzip: 10.47→13.94 kB), alrededor de 35 % más sin comprimir. El JS principal pasa de 225.57 a 230.16 kB (gzip: 74.82→75.82 kB). No se midió una regresión de tiempos de usuario ni se impuso un presupuesto nuevo.

## 8. Resultados finales

| Comando | Resultado |
|---|---|
| `npm test` | 134 aprobadas: 30 plataforma + 104 Pediatría; 0 fallidas y 0 omitidas. |
| `npm run build` | Compilación correcta; 78 módulos transformados. |
| `npm run test:e2e` | 27/27 pasos; incluye los nuevos controles de salto/foco y edad. |
| `npm run test:e2e:vista-previa` | 12/12 pasos; consola del navegador sin errores; todas las peticiones observadas durante preview fueron GET de sesión de Pediatría al recargar. |
| `git diff --check` | Sin errores de whitespace en archivos con seguimiento. Se revisó también whitespace de archivos nuevos de texto mediante diff no-index contra vacío. |

Los E2E no detectaron problemas de accesibilidad básica ni contraste de texto en las pantallas auditadas. Se mantiene la advertencia no bloqueante de tipo de módulo de Node. Una compilación durante ejecución concurrente emitió diagnóstico de tiempos de plugins; la compilación aislada posterior fue correcta sin ese diagnóstico.

## 9. Evidencias visuales locales

Directorio temporal aprobado:

```text
%LOCALAPPDATA%\Temp\opencode\auditoria-frontend-evidencia\
  index.html               Galería de comparación HEAD / estado recibido
  comparacion-*.jpg        Láminas por tamaño, tema y grupo de pantallas
  head\                    Capturas y métricas de a367d2a
  actual\                  Capturas y métricas antes de los ajustes de esta revisión
  final\                   Recorrido tras enlace móvil y protección de edad
  ajustes\                 Capturas finales de Login/Pacientes tras ajustar la tabla
```

Las métricas de comparación inicial se conservan en `head/resultados.json` y `actual/resultados.json`. Las capturas `ajustes/1366-claro-pacientes.png` y `ajustes/1366-oscuro-pacientes.png` muestran edad y acción completas; el JSON dirigido registra cero desborde interno de tabla en 1366/390 px en ambos temas.

Capturas del flujo real con MongoDB desechable:

- `instituciones/pediatria/tests/e2e/capturas/movil-login-claro-acceso.png` y `movil-login-oscuro-acceso.png`.
- `instituciones/pediatria/tests/e2e/capturas/comparativa-*.png`.
- `tests/e2e/capturas-vista-previa/`.

Los directorios E2E son generados e ignorados por Git; se reemplazan al repetir sus pruebas. La galería temporal no se incorpora como binarios al repositorio.

## 10. Recomendación de conservación, corrección o reversión

**Conservar:** tokens y composición acordes al mockup; componentes compartidos usados; cambios de Pediatría sin alterar sus contratos; páginas de preview claramente deshabilitadas; correcciones de integridad/auditoría e índices con sus pruebas; códigos HTTP estables; documentación de alcance y limitaciones; los dos ajustes locales de esta revisión.

**Corregir en una iteración acotada, si el equipo lo prioriza:** nombre uniforme; comentarios y captura documental actualizada; posible eliminación de CSS sin consumidores; reducción de métricas/contexto repetidos; mensajes del Login sobre cuatro motores todavía pendientes. Medir agregaciones si crece el volumen antes de introducir otro endpoint.

**No se recomienda una reversión global.** Retirar `mockup.css`, las primitivas nuevas o solo algunos archivos nuevos sin ajustar sus importadores rompería o descompondría el frontend. El código visual de nuevas operaciones pendientes no debe activarse como funcional hasta integrar y probar su backend. La asignación de motores del PDF no debe adoptarse como definitiva por el solo hecho de estar en el diseño.

**Alcance ajeno al rediseño pero justificado:** los ocho archivos de servicios/contratos/arranque, persistencia, seguridad y pruebas de integridad. Conviene mantener trazabilidad separada de esos objetivos al preparar posteriormente la entrega, sin retirar garantías para reducir artificialmente el número de archivos.

**Preparación de la integración:** el frontend revisado puede integrarse como evolución visual del módulo operativo y prototipos pendientes. Esto no habilita las otras tres instituciones ni convierte la autenticación de desarrollo en autenticación productiva. Antes de cualquier futura entrega del código deben incluirse coherentemente los archivos nuevos que importan las páginas y las nuevas pruebas. No se efectuaron acciones Git de publicación.

### Nota de preparación de la publicación

El PDF de referencia se conserva únicamente en el equipo y se excluye de la rama de preview: no es necesario para instalar, ejecutar o revisar el frontend. Las referencias anteriores al PDF describen la fuente local del diseño, no un archivo incluido en la publicación. Las capturas y herramientas temporales tampoco se publican. El estado de Git descrito en este informe corresponde al cierre de la auditoría, antes de preparar el commit de preview.
