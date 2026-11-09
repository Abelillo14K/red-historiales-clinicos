# Hospital General — modelo relacional, consistencia y seguridad (MySQL)

El esquema está en [`backend/sql/01_esquema.sql`](../backend/sql/01_esquema.sql) y sigue las 29 tablas del documento de la Fase I. Requiere MySQL 8.0.16 o superior, porque las restricciones `CHECK` solo se aplican desde esa versión.

## 1. Asignación del motor

El enunciado exige cuatro motores distintos. El Hospital General usa MySQL (`docs/GUIA_EQUIPO.md` §1). Todas las tablas usan InnoDB, que aporta transacciones y claves foráneas.

## 2. Tablas

| Grupo | Tablas |
|---|---|
| Catálogos | `departamento`, `especialidad`, `rol`, `seguro`, `diagnostico`, `medicamento`, `examen`, `alergia` |
| Personal y cuentas | `medico`, `usuario` |
| Paciente | `paciente`, `paciente_contacto`, `paciente_seguro`, `antecedente_personal`, `antecedente_familiar`, `paciente_alergia` |
| Atención clínica | `cita`, `consulta`, `signos_vitales`, `consulta_diagnostico`, `prescripcion`, `prescripcion_detalle` |
| Exámenes | `orden_examen`, `orden_examen_detalle`, `resultado_examen` |
| Infraestructura | `habitacion`, `cama`, `hospitalizacion` |
| Auditoría | `bitacora_acceso` |

Las tablas de detalle resuelven las relaciones de muchos a muchos: `consulta_diagnostico`, `paciente_alergia`, `prescripcion_detalle` y `orden_examen_detalle`.

## 3. Integridad declarada en el motor

- **35 claves foráneas.** No usan borrado en cascada: un registro referenciado no se puede eliminar, y la API responde `409`.
- **15 restricciones `CHECK`**, sobre estados y valores permitidos, como `paciente.estado`, `paciente.genero`, `cama.estado` y `hospitalizacion.condicion_egreso`. Además, `ck_hosp_fechas` exige que el egreso no sea anterior al ingreso.
- **Valores únicos:** `paciente.numero_expediente`, `paciente.documento_identidad`, `medico.colegiado` y `usuario.nombre_usuario`.
- **Combinaciones únicas:** `uq_paciente_alergia`, `uq_consulta_diag`, `uq_orden_examen`, `uq_hab` y `uq_cama`.

## 4. Consistencia y concurrencia

Cada operación de varias tablas corre en una transacción (`tx` en `backend/src/db.js`): si un paso falla, se revierte completa.

| Operación | Qué se guarda junto |
|---|---|
| Registrar paciente | Paciente, contactos, seguro, alergias y bitácora |
| Registrar consulta | Consulta, signos vitales, diagnósticos, receta, órdenes de examen y cierre de la cita |
| Ingreso y egreso | Hospitalización, estado de la cama y bitácora |
| Archivar | Cancelación de citas, estado del paciente y bitácora |

Las reglas que dependen del estado actual bloquean la fila con `SELECT … FOR UPDATE`:

- **Citas:** se bloquea la fila del médico, de modo que dos solicitudes simultáneas no reserven la misma hora.
- **Hospitalización:** se bloquean el paciente y la cama, de modo que una cama no reciba dos ingresos.
- **Archivar:** se bloquea el paciente mientras se comprueban su hospitalización y sus citas.

## 5. Índices

| Índice | Para qué sirve |
|---|---|
| `ix_paciente_nombre` | Búsqueda y orden por apellido y nombre |
| `ix_cita_medico_fecha` | Detectar choques de horario y consultar la agenda del médico |
| `ix_cita_paciente` | Citas de un paciente |
| `ix_consulta_paciente_fecha` | Historial de consultas de un paciente |
| `ix_hosp_paciente` | Ingresos de un paciente |
| `ix_bit_fecha` · `ix_bit_paciente` | Consulta de la bitácora |

## 6. Seguridad

- **Cuenta de aplicación:** `hospital_app` solo tiene `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre `historial_clinico`. No puede cambiar el esquema.
- **Contraseñas:** se guardan cifradas con bcrypt, nunca en texto plano. Un usuario inexistente tarda lo mismo que una contraseña incorrecta y recibe el mismo mensaje.
- **Permisos:** los calcula el servidor según el rol (`backend/src/seguridad.js`). El token no los otorga.
- **Información restringida:** cada lectura o escritura de datos clínicos queda en `bitacora_acceso`. Si la bitácora no se puede escribir, la operación falla con `503`.
- **SQL:** los valores siempre van parametrizados. Los nombres de tabla y columna solo salen de listas fijas del código.

## 7. Límites aceptados

Estos límites vienen de ceñirse a las tablas del documento de la Fase I:

- No hay columna para el motivo de baja del historial: se valida, pero no se guarda. `01_esquema.sql` incluye un `ALTER` opcional comentado para agregarla.
- No hay relación entre medicamento y alergia: la alerta compara por nombre.
- Una consulta sin cita no tiene columna de motivo: se guarda en `observaciones`.
- Los catálogos, salvo médicos, no tienen estado: no se pueden desactivar.
