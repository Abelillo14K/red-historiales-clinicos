# Guía desde cero — Centro Médico Pediátrico (Integrante 2)

> **Documento histórico.** Describe cómo se creó la base al inicio de la Fase II. Los scripts `01`–`03` quedaron bloqueados para no ejecutarse por accidente (usan campos y estados anteriores). Para la operación actual use el `README.md` y `docs/OPERACION_MONGODB.md`.

## Fuente y alcance

Basado en el enunciado oficial y la sección Centro Médico Pediátrico de la Fase I. MongoDB almacena **colecciones y documentos**, no tablas SQL. Las tres colecciones originales son `pacientes`, `medicos` y `vacunas`. Se añade `bitacora_acceso` exclusivamente para apoyar el requerimiento de auditoría de Entrega II. Se amplían las consultas con `diagnosticos`, `plan_tratamiento` y `receta` porque el enunciado exige estas funciones en los cuatro motores.

## Paso 0. Instalar herramientas

- Instalar **MongoDB Community Server** (servidor local) o disponer de un clúster MongoDB Atlas. **Compass es una interfaz, no instala por sí mismo el servidor**.
- Instalar **MongoDB Shell (mongosh)** para ejecutar scripts.
- Opcional: instalar MongoDB Compass para visualizar documentos y colecciones.
- Para la API posterior: instalar Node.js 20 o superior.

## Paso 1. Comprobar la conexión

En terminal, ejecutar `mongosh "mongodb://127.0.0.1:27017"` si se usa MongoDB local. Si se utiliza Atlas, sustituir por la URI del clúster (sin compartirla ni publicarla).

En la consola `mongosh`, ejecutar `db.runCommand({ ping: 1 })`; el resultado debe incluir `ok: 1`.

## Paso 2. Crear base y colecciones

Abrir una terminal **en la carpeta `mongodb`** y ejecutar:

```powershell
mongosh "mongodb://127.0.0.1:27017" --file 01_crear_base.js
```

El script crea `centro_pediatrico_db`, las 4 colecciones, validadores y los índices. No borra datos existentes.

## Paso 3. Insertar registros y ejecutar operaciones

```powershell
mongosh "mongodb://127.0.0.1:27017" --file 02_datos_y_operaciones.js
```

Carga médicos, vacunas, paciente con tutor, consulta, control de crecimiento y registro de vacuna aplicada; muestra también lecturas ordenadas y bitácora. Es **repetible**: no duplica los datos de demostración con los mismos IDs.

## Paso 4. Verificar visualmente

Abrir Compass > Connect > `mongodb://127.0.0.1:27017` > `centro_pediatrico_db` > `pacientes` > `Documents`.

Verificar 1 paciente con `tutores`, `consultas`, `controles_crecimiento`, `esquema_vacunacion`. Verificar en `medicos` y `vacunas` los catálogos. En `bitacora_acceso`, verificar auditoría básica de los cambios del script.

## Paso 5. Probar archivado (solo al final)

```powershell
mongosh "mongodb://127.0.0.1:27017" --file 03_archivar.js
```

El registro continúa existiendo, pero pasa a `estado_historial: "Archivado"`. Si deseas repetir la demostración desde el comienzo, restaura manualmente `estado_historial` a `Activo` **solo para el paciente ficticio** antes de ejecutar el segundo script.

## Paso 6. Preparar y ejecutar API (siguiente fase)

Desde la carpeta raíz del proyecto:

```powershell
Copy-Item .env.example .env
npm install
npm run seed
npm test
npm run dev
```

Revisar `.env` para URI y `JWT_SECRET` único. La API ofrece rutas de pacientes, consultas, crecimiento, vacunas y archivo; leer `README.md` para sus rutas. **No cuenta con autenticación real completa ni interfaz unificada con los otros motores**; el JWT de desarrollo solamente sirve para probar.

## Pruebas importantes para entregar

1. La búsqueda del historial regresa tutores, consultas, controles y vacunación.
2. Una segunda ejecución no crea registros duplicados con los mismos IDs.
3. La vacunación usa referencias válidas a médico y catálogo de vacunas.
4. Un intento de volver a aplicar la dosis no realiza modificación (0 documentos modificados).
5. El historial archivado no se borra y las nuevas operaciones clínicas deben bloquearse en la aplicación.
6. Pruebas de permisos de médico, secretaria, administrador y registro de auditoría desde API.
7. Probar al final la integración con la interfaz compartida y el enrutamiento por institución; esa parte depende del equipo.

## Limitaciones conocidas

- Los ejemplos son 100% ficticios; nunca utilizar información clínica real.
- Los scripts del Shell se enfocan en creación y demostración de MongoDB, **no sustituyen el backend**.
- La auditoría insertada después de cada operación no es transaccional con la mutación. Para un sistema real, usar transacciones de varios documentos en réplica o patrón outbox.
- El modelo original embebe consultas y mediciones en el documento de paciente. Si el historial crece demasiado, hay que justificar y reconsiderar esa estrategia por el límite de 16 MiB por documento.
- Los validadores BSON permiten ejemplos del modelo, pero las reglas de negocio complejas se deben aplicar en la API, particularmente autenticación, referencias y duplicados.
