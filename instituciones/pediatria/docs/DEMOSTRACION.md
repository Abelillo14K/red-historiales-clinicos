# Guion de demostración (≈12 minutos)

**Preparación:** `npm run build` y `npm start` y abrir `http://localhost:3001`. Tener MongoDB Compass abierto en `centro_pediatrico_db` para mostrar que los cambios persisten. Todos los datos que se capturen deben ser **ficticios**. Antes de presentar, comprobar que todo funciona con `npm test` y `npm run test:e2e`.

| # | Rol | Acción en la interfaz | Qué mostrar / qué demuestra |
|---|---|---|---|
| 1 | Secretaría | Entrar → Panel (solo contadores de pacientes) → **Registrar paciente** con dos tutores. Enviar vacío primero → errores de validación | Nuevo documento en `pacientes` con `consultas: []`, fechas tipo Date y `registrado_por` |
| 2 | Secretaría | Registrar el mismo paciente otra vez | 409: prevención de duplicados |
| 3 | Secretaría | Expediente: solo datos generales y tutores, con el DPI completo; **Editar datos** y **Agregar tutor** | Proyección administrativa sin información clínica |
| 4 | Médico | Cerrar sesión → Médico. Abrir el expediente: el **DPI aparece enmascarado** | Clasificación de la Fase I (DPI restringido) |
| 5 | Médico | **Nueva consulta** con diagnóstico, tratamiento, receta de demostración y control de crecimiento | Un solo `$push` agrega consulta y control; el evento de auditoría viaja en la misma operación |
| 6 | Médico | Pestaña **Consultas**: + Diagnóstico, **Editar tratamiento** (aparece "Versiones anteriores (1)"), + Prescripción, filtro Desde/Hasta | Arreglos embebidos; el tratamiento anterior no se pierde; operación de rango de fechas |
| 7 | Médico | **Crecimiento**: otra medición; gráficas y tabla | Historial que no se sobrescribe y orden cronológico. Si el validador de Fase II no está aplicado, el perímetro aparece obligatorio (explicar por qué) |
| 8 | Médico | **Vacunación**: programar una dosis, intentar programarla de nuevo (error), **Aplicar** con lote y médico | Operador posicional `$`; el filtro `estado:'Pendiente'` impide la doble aplicación (probado también con peticiones simultáneas) |
| 9 | Médico | **Prescripciones**: filtrar por medicamento | Medicamentos históricos de todas las consultas |
| 10 | Administrador | **Archivar historial** → "Otra causa administrativa" + detalle → confirmar | `estado_historial: 'Archivado'`, `fecha_archivado`, motivo con la causa; nada se borra |
| 11 | Médico | Abrir el historial archivado → "Acceso restringido" | Permisos y solo lectura |
| 12 | Administrador | **Historiales archivados** y **Auditoría** (filtrar por paciente o acción) | `bitacora_acceso`: lecturas, escrituras, accesos denegados; `id_evento` único |
| 13 | — | Terminal: `npm test` (61 pruebas) y `npm run test:e2e` (18 pasos en navegador real) | Pruebas automatizadas; las de integración levantan un MongoDB desechable y nunca tocan la base principal |
| 14 | — | Terminal: `npm run db:validadores` | Validadores de Fase II verificados frente a los datos reales (0 incumplen) y procedimiento con respaldo y reversión |

**Para explicar la consistencia:** el servidor es standalone (sin transacciones). Mostrar en `instituciones/pediatria/docs/OPERACION_MONGODB.md` §4 cómo el outbox evita perder eventos, y que `instituciones/pediatria/tests/mongo.integration.test.js` lo comprueba "tirando" la bitácora; en replica set, la misma prueba demuestra que la transacción revierte la consulta.

**Datos existentes útiles:** P001 (consulta C001 con receta, control CR001, dosis aplicada EV001 y pendiente EV002), P002 (activo, sin consultas), P003 y P004 (archivados; P004 se creó durante la verificación de la API el 23/10/2026).

### Verificación por línea de comandos (opcional)
```powershell
$t = (npm run --silent token:dev -- medico).Trim()
Invoke-RestMethod http://localhost:3001/api/sesion -Headers @{Authorization="Bearer $t"}
Invoke-RestMethod http://localhost:3001/api/pacientes/P001/crecimiento -Headers @{Authorization="Bearer $t"}
```
