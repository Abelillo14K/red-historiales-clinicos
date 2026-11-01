# Sistema visual — Red Clínica Integrada

La interfaz toma como referencia las seis pantallas de **Historial Clínico — Mockup.pdf**: acceso, búsqueda de pacientes, registro, expediente, consulta y archivado.

## 1. Organización

| Archivo | Responsabilidad |
|---|---|
| `apps/web/src/styles.css` | Paleta, tokens por tema, escalas, componentes y comportamiento responsive de la plataforma |
| `apps/web/src/mockup.css` | Composición del mockup: navegación navy, acceso dividido, encabezados de paciente, formularios de dos columnas, resúmenes y tarjetas de archivado |
| `apps/web/src/plataforma/ui/FlujoClinico.jsx` | `SectionHeading`, `FormSteps`, `FormSummary` y `PatientCallout`; componentes compartidos sin dependencia de APIs ni instituciones |
| `apps/web/src/plataforma/ui/VistasInstitucionales.jsx` | Cabeceras de sección, indicadores, paneles de contexto, campos y formularios de vista previa, encabezado de expediente, agenda, archivo y administración compartidos |
| `apps/web/src/plataforma/tema.js` | Preferencia claro/oscuro/sistema y color de la barra del navegador |
| `apps/web/index.html` | Identidad, favicon y aplicación del tema antes de cargar React |

`main.jsx` carga primero los estilos base y después la composición. Las instituciones consumen los mismos componentes y tokens con `@plataforma/ui/index.js`.

## 2. Identidad y temas

| Uso | Claro | Oscuro |
|---|---|---|
| Fondo | `#EEF1F8` | `#0D1426` |
| Superficie | `#FFFFFF` | `#161F35` |
| Texto principal | `#151C34` | `#F0F3FF` |
| Primario | `#3155F5` | `#A6B8FF` |
| Texto sobre primario | `#FFFFFF` | `#121D40` |
| Texto secundario | `#4B5563` | `#B9C4DF` |

La navegación y los resúmenes usan una superficie navy estable (`.mockup-dark`) con tokens locales de texto, botones y bordes. El encabezado del paciente mantiene esa identidad en ambos temas. Los estados de éxito, advertencia, peligro e información conservan tokens propios.

La preferencia se guarda en `localStorage` (`plataforma.tema`). `sistema` sigue los cambios del dispositivo. El script de `index.html` evita un primer pintado con el tema incorrecto.

## 3. Estructura

- Menú lateral de 260 px, contraíble a 72 px; fondo navy y sección activa azul.
- Institución activa en el pie del menú; el regreso al portal conserva la sesión.
- Encabezado de 76 px con migas de pan y menú de usuario.
- Fondo gris azulado, tarjetas blancas y esquinas de 18 px.
- Indicadores con icono, valor, etiqueta y explicación del conteo.
- Expediente con encabezado navy, datos clave y pestañas con selección sólida.
- Pestañas que se distribuyen en varias filas cuando hace falta, manteniendo todas las secciones accesibles sin recortarlas.
- Cabeceras de sección con icono, indicadores con datos de la vista y paneles laterales de contexto (`SectionIntro`, `MetricStrip`, `ContextPanel`).
- Listado con acción explícita «Abrir historial» y llamada a registrar un paciente nuevo.

El motor no se muestra en el espacio clínico. No se declara una conexión activa ni se muestran conteos inventados en módulos pendientes.

## 4. Formularios

`FormSteps` enlaza a secciones reales con anclas. El registro pediátrico indica qué secciones están completas y muestra una barra de progreso. El registro hospitalario presenta las cinco secciones del PDF.

`.form-layout` coloca los campos en una columna principal y un resumen lateral de 268 px (230 px en portátil). El resumen se mantiene visible durante el desplazamiento cuando hay espacio. En tablet y móvil pasa al final del formulario.

- Pediatría conserva nombres, tutores, validaciones y los contratos de su backend.
- Nueva consulta pediátrica muestra cantidades de diagnósticos y medicamentos y si incluye crecimiento.
- El archivado pediátrico utiliza tarjetas de selección de motivo en un diálogo accesible, con las mismas reglas y operación existentes.
- Hospital incorpora el diseño de registro, consulta y archivo en formularios deshabilitados hasta su integración.
- Odontología utiliza el mismo patrón en registro de cuatro secciones, consulta de cinco secciones, agenda y archivado.
- Laboratorio utiliza el patrón en registro de tres secciones, solicitud de cuatro secciones, captura de resultados y archivado.

Los campos institucionales son propuestas visuales: cada backend deberá confirmar modelo, catálogos, permisos y reglas. La interfaz no simula guardar ni presenta resultados clínicos ficticios. Solo Pediatría utiliza sus operaciones existentes.

## 5. Correspondencia con el PDF

| Pantalla | Implementación |
|---|---|
| Acceso | Panel navy de presentación, cuatro instituciones, formulario de acceso institucional preparado y acceso vigente por token/desarrollo |
| Pacientes | Indicadores, búsqueda, tabla y llamada a registro; datos reales en Pediatría |
| Registro | Secciones numeradas, navegación por secciones, resumen y clasificación; cinco secciones hospitalarias |
| Expediente | Encabezado navy, datos clave, pestañas; signos vitales y contactos en la vista hospitalaria |
| Consulta | Secciones numeradas y resumen; Hospital presenta origen, signos, notas, diagnósticos, receta y exámenes |
| Archivado | Motivos en tarjetas, efectos y confirmación; Hospital presenta los campos de traslado y certificado |

## 5.1 Diseño uniforme por institución

| Institución | Vistas con el patrón común |
|---|---|
| Pediatría | Panel, pacientes, registro, datos generales/tutores, consultas, prescripciones, crecimiento, vacunación, médicos, archivados y auditoría |
| Hospital | Panel, pacientes, registro, todas las pestañas del expediente, consulta, agenda, hospitalización, archivo, catálogos y bitácora |
| Odontología | Panel, pacientes, registro, todas las pestañas del expediente, consulta, piezas dentales, agenda, archivo, catálogos y bitácora |
| Laboratorio | Panel, pacientes, registro, todas las pestañas del expediente, solicitudes, nueva solicitud, resultados, captura e informe de resultado, archivo, catálogos y bitácora |

La plantilla de piezas dentales permite seleccionar una **posición del diseño**, sin asignar numeración clínica, estados ni tratamientos a un paciente. Los campos de captura permanecen deshabilitados. El informe de laboratorio presenta identificación, parámetros, observaciones y validación sin valores inventados; conserva renderizadores por tipo y presentación genérica para su futura integración.

Las recetas dentro de las consultas se adaptan al ancho de su tarjeta mediante una consulta de contenedor, también cuando hay un resumen lateral en escritorio.

Puntos de entrada:

- `/vista-previa/hospital_general/pacientes`
- `/vista-previa/clinica_odontologica/pacientes`
- `/vista-previa/laboratorio_clinico/pacientes`

Desde el listado se abre la estructura del expediente y desde allí los diseños de consulta, solicitud y archivo. Laboratorio también enlaza el registro y la plantilla de informe desde Resultados.

## 6. Responsive y accesibilidad

- Por debajo de 1000 px, el menú lateral se abre como panel móvil.
- Por debajo de 900 px, los formularios pasan a una columna.
- Por debajo de 720 px, las tablas se presentan como fichas, las tarjetas de motivos se apilan y los controles mantienen espacio táctil.
- Etiquetas asociadas, estados de error y carga, foco visible, pestañas navegables con flechas y diálogos nativos.
- Los formularios de vista previa permanecen dentro de un `fieldset disabled`; los enlaces de navegación siguen disponibles.
- La versión móvil incluye las pantallas hospitalarias nuevas, no solo el listado.

## 7. Verificación

```powershell
npm test
npm run test:e2e
npm run test:e2e:vista-previa
```

Las pruebas de navegador verifican funcionalidad, permisos, persistencia, temas, accesibilidad básica y contraste de texto en las pantallas auditadas. La vista previa recorre todas las páginas declaradas y todas las pestañas internas de las tres instituciones pendientes, a 1920, 1366, 820 y 390 px, en claro y oscuro. También comprueba que seleccionar una posición dental solo cambia la presentación, que los formularios no escriben y que la sesión de Pediatría permanece intacta.

Capturas generadas (ignoradas por Git): `instituciones/pediatria/tests/e2e/capturas/` y `tests/e2e/capturas-vista-previa/`.
