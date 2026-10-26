> **Documento histórico (Paso 24).** Sustituido por el README y `docs/`. El paciente P004 ya existe (creado durante la verificación de Fase II); no repetir estas instrucciones.

# Paso 24 — Corrección de la API pediátrica

Este paquete es un **parche sobre tu proyecto existente**, no un proyecto nuevo. Conserva `centro_pediatrico_db` y **no toca** MongoDB, `.env`, `package.json`, `package-lock.json`, la carpeta `node_modules`, ni los datos insertados.

## Qué cambia

- La API usa `tratamiento` y `prescripciones`, como las consultas C001 que ya registraste en MongoDB.
- Convierte `fecha_nacimiento` (YYYY-MM-DD) a `Date` al crear un paciente, para respetar el validador BSON existente.
- Convierte fechas clínicas y de vacunación a `Date`.
- Archivar usa `fecha_archivado` y `motivo_archivado`, como el historial P003.
- Añade `GET /api/pacientes` para listar solo datos básicos; permite construir la pantalla de búsqueda sin enviar el historial clínico completo.
- Actualiza pruebas automáticas para los nuevos campos y fechas.

## Instalación en Windows / VS Code

**Antes:** detén la terminal que ejecuta `npm run dev` con `Ctrl + C`.

1. Descomprime `parche_pediatrico_paso24.zip` en una carpeta de trabajo diferente de tu proyecto.
2. En tu proyecto `centro_pediatrico_fase2` crea una copia de seguridad de los archivos `src/server.js`, `src/schema.js` y `tests/schema.test.js` (por ejemplo en una carpeta `respaldo_paso24` fuera de `src` y `tests`).
3. Copia desde el ZIP los tres archivos corregidos y pégalos en las mismas rutas del proyecto, confirmando el reemplazo de esos tres archivos **solamente**.
4. NO reemplaces tu `.env` y NO ejecutes scripts de semilla o recreación de base de datos.
5. Ejecuta:
   ```powershell
   npm test
   npm audit
   npm run dev
   ```
6. Esperamos **5 pruebas** aprobadas, cero vulnerabilidades y arranque del servidor en puerto 3001. El `npm test` es una prueba unitaria; después hay que validar la escritura real a MongoDB.

## Prueba de escritura (solo datos ficticios)

Deja `npm run dev` ejecutándose y abre una segunda terminal en la carpeta raíz del proyecto.

Crea un token de secretaría y usa un identificador nuevo `P004`:

```powershell
$tokenSecretaria = (node scripts/dev-token.js secretaria).Trim()
$bodyPaciente = @{
  id_paciente = 'P004'
  nombres = 'Paciente'
  apellidos = 'Ficticio'
  fecha_nacimiento = '2023-04-21'
  sexo = 'F'
  tutores = @(@{
    id_tutor = 'T004'
    dpi = 'FICTICIO-004'
    nombres = 'Tutora'
    apellidos = 'Ejemplo'
    parentesco = 'Madre'
    telefono = '5555-1004'
    es_principal = $true
  })
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri 'http://localhost:3001/api/pacientes' -Method Post -ContentType 'application/json' -Headers @{Authorization="Bearer $tokenSecretaria"} -Body $bodyPaciente
```

Respuesta esperada: `id_paciente : P004`. Si repites el POST, deberá producir conflicto 409 por índice único.

Ahora prueba una consulta con receta, utilizando el médico `M001` que ya registraste:

```powershell
$tokenMedico = (node scripts/dev-token.js medico).Trim()
$bodyConsulta = @{
  id_consulta='C004'
  id_medico='M001'
  fecha_hora='2026-10-23T15:00:00Z'
  motivo='Control académico'
  observaciones='Datos completamente ficticios'
  diagnosticos=@(@{codigo='DEMO';descripcion='Diagnóstico ficticio'})
  tratamiento=@{descripcion='Seguimiento académico';recomendaciones='No son indicaciones médicas'}
  prescripciones=@(@{
    id_prescripcion='RX004'
    fecha_emision='2026-10-23T16:00:00Z'
    indicaciones_generales='Solo demostración'
    medicamentos=@(@{
      id_medicamento='MED-DEMO'
      nombre='Medicamento ficticio A'
      dosis='No aplica'
      frecuencia='No aplica'
      duracion='No aplica'
      via_administracion='No aplica'
    })
  })
} | ConvertTo-Json -Depth 15
Invoke-RestMethod -Uri 'http://localhost:3001/api/pacientes/P004/consultas' -Method Post -ContentType 'application/json' -Headers @{Authorization="Bearer $tokenMedico"} -Body $bodyConsulta
Invoke-RestMethod -Uri 'http://localhost:3001/api/pacientes/P004' -Headers @{Authorization="Bearer $tokenMedico"} | ConvertTo-Json -Depth 15
```

Respuesta esperada en POST: `id_consulta : C004`; en GET, objetos `tratamiento` y `prescripciones` presentes y fechas serializadas en ISO 8601.

## Comprobaciones pendientes para la entrega II

- Registrar usuario real y permiso por institución; `dev-token.js` es únicamente un generador de tokens de demostración.
- Ajustar esquema de MongoDB para perímetro cefálico opcional si el equipo decide admitirlo, pues el validador actual lo exige.
- La escritura clínica y la bitácora son operaciones separadas, así que el ejemplo **todavía no garantiza atomicidad** entre ambas: considerar transacciones o mecanismo outbox.
- Pruebas de integración contra la instancia real (altas, duplicados, permisos y archivo) y construcción del frontend compartido con el equipo.
- Documentar explícitamente el mapeo de puertos/adaptadores de la arquitectura hexagonal en la integración del equipo.

No utilizar datos médicos reales en estas pruebas.
