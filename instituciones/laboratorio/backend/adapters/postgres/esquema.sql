-- Esquema del Laboratorio Clínico (PostgreSQL), en 3FN.
-- Idempotente y no destructivo: se puede volver a aplicar sin perder datos (no hay DROP de tablas).

CREATE SCHEMA IF NOT EXISTS laboratorio;
SET search_path TO laboratorio;

-- Pacientes: el historial se archiva (baja lógica), nunca se borra.
CREATE TABLE IF NOT EXISTS paciente (
    id_paciente          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombres              VARCHAR(120) NOT NULL CHECK (btrim(nombres) <> ''),
    apellidos            VARCHAR(120) NOT NULL CHECK (btrim(apellidos) <> ''),
    documento_identidad  VARCHAR(20)  UNIQUE,
    fecha_nacimiento     DATE         NOT NULL CHECK (fecha_nacimiento <= CURRENT_DATE),
    sexo                 CHAR(1)      NOT NULL CHECK (sexo IN ('F', 'M')),
    telefono             VARCHAR(20),
    correo               VARCHAR(120),
    direccion            VARCHAR(200),
    contacto_emergencia  VARCHAR(120),
    telefono_emergencia  VARCHAR(20),
    observaciones        VARCHAR(500),
    fecha_registro       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    estado_historial     VARCHAR(10)  NOT NULL DEFAULT 'Activo' CHECK (estado_historial IN ('Activo', 'Archivado')),
    fecha_archivado      TIMESTAMPTZ,
    motivo_archivado     VARCHAR(300),
    CHECK ((estado_historial = 'Activo' AND fecha_archivado IS NULL AND motivo_archivado IS NULL)
        OR (estado_historial = 'Archivado' AND fecha_archivado IS NOT NULL AND motivo_archivado IS NOT NULL))
);

-- Médico que solicita exámenes (interno o de otra institución).
CREATE TABLE IF NOT EXISTS medico_solicitante (
    id_medico               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_completo         VARCHAR(150) NOT NULL,
    numero_colegiado        VARCHAR(20)  NOT NULL UNIQUE,
    institucion_procedencia VARCHAR(150),
    telefono_contacto       VARCHAR(20)
);

-- Personal que valida resultados; usuario es el sub del JWT.
CREATE TABLE IF NOT EXISTS personal_laboratorio (
    id_personal      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombres          VARCHAR(120) NOT NULL,
    apellidos        VARCHAR(120) NOT NULL,
    cargo            VARCHAR(20)  NOT NULL CHECK (cargo IN ('Tecnico', 'Bioquimico', 'Patologo')),
    numero_colegiado VARCHAR(20)  UNIQUE,
    usuario          VARCHAR(80)  NOT NULL UNIQUE,
    activo           BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Catálogo de tipos de muestra (sangre, orina, heces...).
CREATE TABLE IF NOT EXISTS tipo_muestra (
    id_tipo_muestra BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          VARCHAR(60) NOT NULL UNIQUE
);

-- Catálogo de tipos de examen.
CREATE TABLE IF NOT EXISTS tipo_examen (
    id_tipo_examen       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre               VARCHAR(120)  NOT NULL UNIQUE,
    categoria            VARCHAR(60)   NOT NULL,
    descripcion          VARCHAR(255),
    id_tipo_muestra      BIGINT        NOT NULL REFERENCES tipo_muestra (id_tipo_muestra) ON DELETE RESTRICT,
    tiempo_entrega_horas INTEGER       NOT NULL CHECK (tiempo_entrega_horas > 0),
    precio               NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    activo               BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Catálogo de parámetros medibles.
CREATE TABLE IF NOT EXISTS parametro (
    id_parametro  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(80) NOT NULL UNIQUE,
    unidad_medida VARCHAR(20),
    tipo_dato     VARCHAR(10) NOT NULL CHECK (tipo_dato IN ('Numerico', 'Texto'))
);

-- Parámetros de cada tipo de examen con su rango de referencia (define la estructura variable del resultado).
CREATE TABLE IF NOT EXISTS tipo_examen_parametro (
    id_tipo_examen     BIGINT  NOT NULL REFERENCES tipo_examen (id_tipo_examen) ON DELETE RESTRICT,
    id_parametro       BIGINT  NOT NULL REFERENCES parametro (id_parametro) ON DELETE RESTRICT,
    valor_ref_min      NUMERIC(12,4),
    valor_ref_max      NUMERIC(12,4),
    valor_ref_texto    VARCHAR(80),
    orden_presentacion INTEGER NOT NULL CHECK (orden_presentacion > 0),
    PRIMARY KEY (id_tipo_examen, id_parametro),
    CHECK (valor_ref_min IS NULL OR valor_ref_max IS NULL OR valor_ref_min <= valor_ref_max)
);

-- Solicitud de exámenes: agrupa uno o varios exámenes de un paciente.
CREATE TABLE IF NOT EXISTS solicitud (
    id_solicitud          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_paciente           BIGINT       NOT NULL REFERENCES paciente (id_paciente) ON DELETE RESTRICT,
    id_medico             BIGINT       REFERENCES medico_solicitante (id_medico) ON DELETE RESTRICT,
    institucion_remitente VARCHAR(150),
    fecha_solicitud       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    prioridad             VARCHAR(10)  NOT NULL DEFAULT 'Rutina' CHECK (prioridad IN ('Rutina', 'Urgente')),
    motivo                VARCHAR(500),
    indicaciones          VARCHAR(500),
    observaciones         VARCHAR(500),
    estado                VARCHAR(12)  NOT NULL DEFAULT 'Pendiente'
                          CHECK (estado IN ('Pendiente', 'En proceso', 'Completada', 'Anulada')),
    registrado_por        VARCHAR(80)  NOT NULL
);

-- Examen individual dentro de una solicitud, con su muestra.
CREATE TABLE IF NOT EXISTS examen (
    id_examen          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_solicitud       BIGINT      NOT NULL REFERENCES solicitud (id_solicitud) ON DELETE RESTRICT,
    id_tipo_examen     BIGINT      NOT NULL REFERENCES tipo_examen (id_tipo_examen) ON DELETE RESTRICT,
    codigo_muestra     VARCHAR(30) UNIQUE,
    fecha_toma_muestra TIMESTAMPTZ,
    estado             VARCHAR(16) NOT NULL DEFAULT 'Pendiente'
                       CHECK (estado IN ('Pendiente', 'Muestra tomada', 'Procesando', 'Resultado listo')),
    UNIQUE (id_solicitud, id_tipo_examen)
);

-- Resultado de un examen (1 a 1); validado exige quién y cuándo.
CREATE TABLE IF NOT EXISTS resultado (
    id_resultado       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_examen          BIGINT      NOT NULL UNIQUE REFERENCES examen (id_examen) ON DELETE RESTRICT,
    fecha_analisis     TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones      VARCHAR(500),
    estado             VARCHAR(10) NOT NULL DEFAULT 'Preliminar' CHECK (estado IN ('Preliminar', 'Validado')),
    id_personal_valida BIGINT      REFERENCES personal_laboratorio (id_personal) ON DELETE RESTRICT,
    fecha_emision      TIMESTAMPTZ,
    CHECK (estado = 'Preliminar' OR (id_personal_valida IS NOT NULL AND fecha_emision IS NOT NULL))
);

-- Valor de cada parámetro dentro de un resultado.
CREATE TABLE IF NOT EXISTS resultado_detalle (
    id_resultado   BIGINT  NOT NULL REFERENCES resultado (id_resultado) ON DELETE RESTRICT,
    id_parametro   BIGINT  NOT NULL REFERENCES parametro (id_parametro) ON DELETE RESTRICT,
    valor_numerico NUMERIC(12,4),
    valor_texto    VARCHAR(80),
    fuera_de_rango BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id_resultado, id_parametro),
    CHECK (num_nonnulls(valor_numerico, valor_texto) = 1)
);

-- Bitácora de accesos y cambios (solo se agrega, nunca se modifica).
CREATE TABLE IF NOT EXISTS bitacora (
    id_evento   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha_hora  TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario     VARCHAR(80) NOT NULL,
    rol         VARCHAR(30),
    accion      VARCHAR(40) NOT NULL,
    id_paciente BIGINT,
    recurso     VARCHAR(60),
    resultado   VARCHAR(10) NOT NULL DEFAULT 'PERMITIDO' CHECK (resultado IN ('PERMITIDO', 'DENEGADO')),
    detalle     VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_paciente_estado_nombre ON paciente (estado_historial, apellidos, nombres);
CREATE INDEX IF NOT EXISTS idx_solicitud_paciente     ON solicitud (id_paciente, fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS idx_solicitud_estado       ON solicitud (estado, fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS idx_examen_tipo            ON examen (id_tipo_examen);
CREATE INDEX IF NOT EXISTS idx_detalle_parametro      ON resultado_detalle (id_parametro);
CREATE INDEX IF NOT EXISTS idx_bitacora_paciente      ON bitacora (id_paciente, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha         ON bitacora (fecha_hora DESC);

-- Un historial archivado es de solo lectura: no admite solicitudes nuevas.
CREATE OR REPLACE FUNCTION laboratorio.exigir_paciente_activo() RETURNS trigger AS $$
BEGIN
    IF (SELECT estado_historial FROM laboratorio.paciente WHERE id_paciente = NEW.id_paciente) = 'Archivado' THEN
        RAISE EXCEPTION 'El historial del paciente % está archivado', NEW.id_paciente USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_solicitud_paciente_activo
BEFORE INSERT ON solicitud
FOR EACH ROW EXECUTE FUNCTION laboratorio.exigir_paciente_activo();

-- Cada validación de un resultado queda en la bitácora.
CREATE OR REPLACE FUNCTION laboratorio.registrar_validacion() RETURNS trigger AS $$
BEGIN
    IF NEW.estado = 'Validado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'Validado') THEN
        INSERT INTO laboratorio.bitacora (usuario, accion, id_paciente, recurso)
        SELECT p.usuario, 'VALIDAR_RESULTADO', s.id_paciente, 'resultado'
          FROM laboratorio.examen e
          JOIN laboratorio.solicitud s ON s.id_solicitud = e.id_solicitud
          JOIN laboratorio.personal_laboratorio p ON p.id_personal = NEW.id_personal_valida
         WHERE e.id_examen = NEW.id_examen;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_resultado_validacion
AFTER INSERT OR UPDATE OF estado ON resultado
FOR EACH ROW EXECUTE FUNCTION laboratorio.registrar_validacion();

-- Privilegios mínimos para el usuario de la aplicación, si el administrador ya lo creó (ver README).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_laboratorio') THEN
        GRANT USAGE ON SCHEMA laboratorio TO app_laboratorio;
        GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA laboratorio TO app_laboratorio;
        REVOKE UPDATE ON laboratorio.bitacora FROM app_laboratorio;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA laboratorio TO app_laboratorio;
    END IF;
END $$;
