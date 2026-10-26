# Sistema visual — Red de Historiales Clínicos

Guía del tema, los tokens de diseño y los componentes compartidos. Se aplica a todos los módulos institucionales. Fuente: `apps/web/src/styles.css`.

## 1. Temas

| Preferencia (`data-tema`) | Esquema efectivo (`data-esquema`) | Notas |
|---|---|---|
| `claro` | `claro` | **Predeterminado** para quien no tiene preferencia guardada |
| `oscuro` | `oscuro` | Verde petróleo profundo con acento turquesa suave (paleta `--paleta-oscuro-*`, §2.1) |
| `sistema` | `claro` u `oscuro` según `prefers-color-scheme` | Sigue en vivo los cambios del sistema operativo |

- La preferencia se guarda en `localStorage` (`plataforma.tema`) y se conserva al navegar y recargar. Se cambia desde el menú de usuario.
- **Sin parpadeo:** un script en línea en `apps/web/index.html` resuelve el tema antes del primer pintado; `apps/web/src/plataforma/tema.js` aplica la misma lógica y vigila el sistema. La hoja de estilos depende solo de `data-esquema`, de modo que los tokens de cada esquema se definen una sola vez.
- Sin JavaScript, la página se ve en tema claro.

## 2. Paleta base

| Token | Valor | Uso |
|---|---|---|
| `--paleta-arena` | `#F8F6F1` | Fondo de la aplicación |
| `--paleta-blanco` | `#FFFFFF` | Superficies (tarjetas, menú, diálogos) |
| `--paleta-lino` | `#E7E1D7` | Bordes discretos |
| `--paleta-grafito` | `#1F2937` | Texto principal |
| `--paleta-pizarra` | `#6B7280` | Referencia del texto secundario (ver ajuste abajo) |
| `--paleta-petroleo` | `#287271` | Color primario |
| `--paleta-turquesa` | `#2E8B8B` | Acento |
| `--paleta-salvia` | `#4F9D69` | Éxito |
| `--paleta-ocre` | `#D6A84F` | Advertencia |
| `--paleta-terracota` | `#C96B5D` | Peligro |

### Ajustes por contraste (WCAG AA)

Medidos con la fórmula de luminancia relativa de WCAG 2.x:

| Caso | Valor de la paleta | Resultado | Ajuste aplicado |
|---|---|---|---|
| Texto secundario sobre el fondo arena | `#6B7280` | 4.48:1 (no llega a 4.5) | `--color-text-muted: #5F6673` (5.35:1) y `--color-text-secondary: #4B5563` (7.0:1) |
| Texto blanco sobre el acento | `#2E8B8B` | 4.05:1 | Los botones usan el primario `#287271` (5.62:1); hover `#1F5E5D` (7.45:1) |
| Texto de éxito / advertencia / peligro | `#4F9D69` / `#D6A84F` / `#C96B5D` | 3.30 / 2.19 / 3.66:1 | Variantes de texto `#2F6E45`, `#7A5A12`, `#A3483B` (≥ 5.1:1 sobre su fondo suave). El color base se reserva para puntos, bordes e iconos |
| Borde de campos de formulario | `#E7E1D7` | 1.30:1 | `--color-border-control: #9A9181` (3.12:1, criterio 1.4.11); las tarjetas mantienen el borde lino |

La prueba de navegador (`npm run test:e2e`) mide además el contraste real del texto visible en más de 40 revisiones de pantalla (inicio de sesión, panel, pacientes, registro con errores, expediente, consultas, prescripciones, crecimiento, vacunación, médicos, archivados, auditoría y menú de usuario, en tema claro y oscuro; panel, expediente, consultas y vacunación también en móvil oscuro) y falla si alguna combinación queda por debajo de AA.

### 2.1 Paleta del esquema oscuro

| Token | Valor | Contraste medido |
|---|---|---|
| `--paleta-oscuro-fondo` | `#10191C` | texto 16.0:1 |
| `--paleta-oscuro-superficie` | `#192529` | texto 14.1:1 · texto secundario 8.5:1 |
| `--paleta-oscuro-superficie-alt` (`--color-surface-3`) | `#233237` | texto atenuado `#98ABAB` 5.5:1 |
| `--paleta-oscuro-borde` (`--color-border-strong`) | `#34494D` | separadores; los campos usan `--color-border-control: #5E7A7D` (3.6:1) |
| `--paleta-oscuro-texto` | `#EDF4F2` | sin blanco puro |
| `--paleta-oscuro-texto-sec` | `#B1C2C2` | 7.2:1 sobre la superficie alterna |
| `--paleta-oscuro-acento` (primario) | `#67C9BD` | 8.0:1 como texto; botones con texto `#0D2623` (8.1:1); hover `#86D6CC` (9.5:1) |
| `--paleta-oscuro-exito` | `#76CFA3` | 8.4:1 · 6.6:1 sobre su fondo suave |
| `--paleta-oscuro-advertencia` | `#E8BB70` | 8.8:1 · 7.2:1 sobre su fondo suave |
| `--paleta-oscuro-peligro` | `#F18B85` | 6.6:1; botón sólido con texto `#2A0E0C` (7.5:1) |

Derivados: `--color-surface-2: #1D2B2F` (cabeceras de tabla), `--color-surface-elev: #142024` (campos), `--color-border: #2A3B3F` (separadores discretos), `--color-info: #8FB4F0`, foco `#8EDBD1`. Las sombras usan el tono del fondo, nunca negro puro.

**Estados de interacción (ambos temas):** hover aclara el primario (oscuro) u oscurece (claro); el foco por teclado combina contorno de 2px y anillo suave; los botones deshabilitados usan superficie alterna y texto atenuado (sin transparencia); lo seleccionado (navegación, pestañas, filtros, tema) usa el fondo suave del primario y su color de texto.

## 3. Tokens semánticos

Los componentes **solo** usan estos tokens; cambiar la paleta base o un esquema no requiere tocar componentes.

| Grupo | Tokens |
|---|---|
| Fondos | `--color-background`, `--color-surface`, `--color-surface-2` (cabeceras de tabla, pies de diálogo), `--color-surface-3` (iconos, hover), `--color-surface-elev` (campos) |
| Bordes | `--color-border`, `--color-border-strong`, `--color-border-control` |
| Texto | `--color-text`, `--color-text-secondary`, `--color-text-muted` |
| Primario | `--color-primary`, `--color-primary-hover`, `--color-primary-text`, `--color-primary-soft`, `--color-primary-ring`, `--color-on-primary`, `--color-accent` |
| Estados | `--color-{success,warning,danger,info}`, `-text`, `-soft`; `--color-danger-solid`, `--color-on-danger` |
| Foco | `--color-focus` (contorno de 2px con separación de 2px en todos los controles) |
| Gráficas | `--color-chart-series`, `--color-chart-area`, `--color-chart-grid` |
| Profundidad | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--color-overlay` |

## 4. Escalas

| Escala | Valores |
|---|---|
| Espaciado | `--space-1` 4px · `-2` 8px · `-3` 12px · `-4` 16px · `-5` 20px · `-6` 24px · `-8` 32px · `-10` 40px |
| Radio | `--radius-sm` 6px (códigos) · `-md` 8px (botones, campos, tablas) · `-lg` 12px (tarjetas) · `-xl` 16px (diálogos) · `-pill` |
| Altura de controles | `--control-h` 40px · `--control-h-sm` 32px; en pantallas táctiles 44px / 38px |
| Tipografía | `--text-xs` 12.5px (mínimo para etiquetas: 12px) · `-sm` 13px · `-base` 15px · `-md` 16px · `-lg` 18px · `-xl` 22px · `-2xl` 26px; fuente del sistema (Segoe UI Variable en Windows) |
| Estructura | menú lateral 252px (contraído 72px) · encabezado 60px · contenido máximo 1280px (1480px desde 1680px de ancho) |

## 5. Estructura de la aplicación

- **Encabezado:** migas de pan alineadas a la izquierda; acción principal del módulo, institución activa (informada por el servidor) y menú de usuario (rol, expiración de la sesión, tema, cerrar sesión).
- **Menú lateral:** identidad de la plataforma, institución, secciones con separadores titulados (`grupo` del manifiesto), estado activo con barra y fondo suave. En escritorio se puede contraer a iconos (preferencia recordada; los enlaces conservan su nombre accesible). Por debajo de 1000px se convierte en panel deslizante con fondo y cierre con Escape.
- **Contenido:** ancho máximo de 1280px centrado, márgenes de 32px (24px en tablet, 16px en móvil), separación uniforme de 20px entre tarjetas.

## 6. Componentes

| Componente | Reglas |
|---|---|
| Botones | primario (relleno petróleo), secundario (superficie con borde), peligro (contorno terracota) y peligro sólido para confirmar acciones irreversibles; 40px de alto |
| Campos | etiqueta visible encima, borde de 3:1, foco con anillo primario, error en rojo con mensaje asociado (`aria-describedby`) |
| Tablas | cabecera en mayúsculas pequeñas, filas de 12×16px, valores numéricos alineados a la derecha con cifras tabulares; en móvil, fichas con la etiqueta de cada columna |
| Indicadores (`StatCard`) | etiqueta, valor y **contexto que dice qué incluye el número**; enlazados cuando existe una vista de detalle |
| Distintivos | píldora de 22px con punto; tonos ok, warn, bad, info, primary |
| Pestañas | subrayado primario y contador; navegables con flechas |
| Diálogos | `<dialog>` nativo (foco atrapado, Escape), acciones en un pie diferenciado |
| Avisos y notificaciones | fondo suave del tono, icono y título en el color de texto del tono, cuerpo en texto normal |
| Estados | carga con indicador, vacío con icono y explicación, error de conexión con reintento |
| Paginación | rango visible y botones Anterior/Siguiente |
| Campos deshabilitados | fondo `--color-surface-3`, texto atenuado y cursor «no permitido»: se distinguen de un campo editable |
| Pendiente de integración (`PendienteIntegracion`) | franja punteada en el primario suave con icono de conector y el texto común «Este módulo está preparado visualmente. Pendiente de integración con su backend.» |
| Tabla sin datos (`TablaPendiente`) | conserva los encabezados de columna y muestra un estado vacío; en móvil lista las columnas previstas como píldoras |
| Formulario en vista previa (`FormularioVistaPrevia`) | campos dentro de un `fieldset` deshabilitado, nota «Se habilitará al conectar el backend» y envío bloqueado (nunca muestra «guardado») |
| Espacio reservado (`.reserved-slot`) | recuadro punteado con icono para componentes institucionales aún sin contrato (piezas dentales, visor de resultados) |

## 6.1 Módulos pendientes y vista previa

Hospital General, Clínica Odontológica y Laboratorio Clínico usan **los mismos** componentes, tokens y estructura que Pediatría; solo cambian sus títulos e iconos (`hospital`, `diente`, `matraz`, `resultado`). La vista previa de desarrollo (`/vista-previa`, solo con `vite`) agrega una franja ámbar «Vista previa de desarrollo» y, en el encabezado, el selector de tema y el regreso al estado de integración. Verificado en claro y oscuro a 1920, 1366, 820 y 390 px por `npm run test:e2e:vista-previa` (contraste WCAG AA y accesibilidad básica). Capturas `vp-*.png` en `docs/capturas/`.

## 7. Pantallas del Centro Pediátrico

- **Panel:** seis indicadores (incluidas las dosis aplicadas) en 3 × 2 en portátil, una fila desde 1680px y 2 columnas en móvil, cada uno con su criterio y una nota que explica por qué los archivados cuentan en consultas, controles y dosis aplicadas pero no en dosis pendientes; consultas recientes, accesos rápidos y próximas dosis.
- **Expediente:** encabezado del paciente con datos clave (tutor principal, última consulta, último control, vacunación, registro), aviso de archivado y pestañas.
- **Consultas:** línea de tiempo con fecha y hora, médico, observaciones, diagnósticos, tratamiento con versiones anteriores, recetas y trazabilidad.
- **Crecimiento:** una gráfica por medida con su unidad y último valor, aviso cuando hay una sola medición y nota explícita de que **no son curvas de referencia clínica** (OMS) ni percentiles.
- **Vacunación:** filtro por estado con contadores, aviso de fecha programada vencida, fecha, lote y médico de la aplicación, y confirmación antes de aplicar o cancelar.
