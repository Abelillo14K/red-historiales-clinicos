-- Hospital General · esquema MySQL 8.0.16+ (29 tablas del documento Fase I)
CREATE DATABASE IF NOT EXISTS historial_clinico CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE historial_clinico;
SET FOREIGN_KEY_CHECKS = 0;

-- ===== Catálogos =====
CREATE TABLE departamento (
  id_departamento INT AUTO_INCREMENT PRIMARY KEY,
  nombre_departamento VARCHAR(100) NOT NULL,
  ubicacion VARCHAR(150),
  extension_telefono VARCHAR(10)
) ENGINE=InnoDB;

CREATE TABLE especialidad (
  id_especialidad INT AUTO_INCREMENT PRIMARY KEY,
  nombre_especialidad VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE rol (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre_rol VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE seguro (
  id_seguro INT AUTO_INCREMENT PRIMARY KEY,
  nombre_aseguradora VARCHAR(120) NOT NULL,
  telefono_contacto VARCHAR(15),
  direccion VARCHAR(200)
) ENGINE=InnoDB;

CREATE TABLE diagnostico (
  id_diagnostico INT AUTO_INCREMENT PRIMARY KEY,
  codigo_cie10 VARCHAR(10) NOT NULL UNIQUE,
  nombre_diagnostico VARCHAR(200) NOT NULL,
  descripcion TEXT
) ENGINE=InnoDB;

CREATE TABLE medicamento (
  id_medicamento INT AUTO_INCREMENT PRIMARY KEY,
  nombre_generico VARCHAR(150) NOT NULL,
  nombre_comercial VARCHAR(150),
  presentacion VARCHAR(80),
  concentracion VARCHAR(50),
  via_administracion VARCHAR(50)
) ENGINE=InnoDB;

CREATE TABLE examen (
  id_examen INT AUTO_INCREMENT PRIMARY KEY,
  nombre_examen VARCHAR(150) NOT NULL,
  tipo_examen VARCHAR(30),
  unidad_medida VARCHAR(30),
  valor_referencia VARCHAR(100)
) ENGINE=InnoDB;

CREATE TABLE alergia (
  id_alergia INT AUTO_INCREMENT PRIMARY KEY,
  nombre_alergia VARCHAR(150) NOT NULL,
  tipo VARCHAR(30)
) ENGINE=InnoDB;

-- ===== Personal y usuarios =====
CREATE TABLE medico (
  id_medico INT AUTO_INCREMENT PRIMARY KEY,
  colegiado VARCHAR(20) NOT NULL UNIQUE,
  primer_nombre VARCHAR(60) NOT NULL,
  segundo_nombre VARCHAR(60),
  primer_apellido VARCHAR(60) NOT NULL,
  segundo_apellido VARCHAR(60),
  id_especialidad INT NOT NULL,
  id_departamento INT NOT NULL,
  telefono VARCHAR(15),
  correo VARCHAR(120),
  estado VARCHAR(15) NOT NULL DEFAULT 'Activo',
  CONSTRAINT ck_medico_estado CHECK (estado IN ('Activo','Inactivo')),
  CONSTRAINT fk_medico_esp FOREIGN KEY (id_especialidad) REFERENCES especialidad(id_especialidad),
  CONSTRAINT fk_medico_dep FOREIGN KEY (id_departamento) REFERENCES departamento(id_departamento)
) ENGINE=InnoDB;

CREATE TABLE usuario (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  id_medico INT NULL,
  nombre_usuario VARCHAR(50) NOT NULL UNIQUE,
  contrasena_hash VARCHAR(255) NOT NULL,
  id_rol INT NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso DATETIME NULL,
  estado VARCHAR(15) NOT NULL DEFAULT 'Activo',
  CONSTRAINT ck_usuario_estado CHECK (estado IN ('Activo','Inactivo')),
  CONSTRAINT fk_usuario_medico FOREIGN KEY (id_medico) REFERENCES medico(id_medico),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
) ENGINE=InnoDB;

-- ===== Paciente =====
CREATE TABLE paciente (
  id_paciente INT AUTO_INCREMENT PRIMARY KEY,
  numero_expediente VARCHAR(20) NOT NULL UNIQUE,
  primer_nombre VARCHAR(60) NOT NULL,
  segundo_nombre VARCHAR(60),
  primer_apellido VARCHAR(60) NOT NULL,
  segundo_apellido VARCHAR(60),
  fecha_nacimiento DATE NOT NULL,
  genero VARCHAR(15) NOT NULL,
  estado_civil VARCHAR(20),
  documento_identidad VARCHAR(20) UNIQUE,
  tipo_sangre VARCHAR(5),
  direccion VARCHAR(200),
  telefono VARCHAR(15),
  correo VARCHAR(120),
  nacionalidad VARCHAR(60),
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(15) NOT NULL DEFAULT 'Activo',
  CONSTRAINT ck_paciente_estado CHECK (estado IN ('Activo','Inactivo','Archivado')),
  CONSTRAINT ck_paciente_genero CHECK (genero IN ('Femenino','Masculino')),
  CONSTRAINT ck_paciente_sangre CHECK (tipo_sangre IS NULL OR tipo_sangre IN ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
  INDEX ix_paciente_nombre (primer_apellido, primer_nombre)
) ENGINE=InnoDB;

CREATE TABLE paciente_contacto (
  id_contacto INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT NOT NULL,
  nombre_contacto VARCHAR(120) NOT NULL,
  parentesco VARCHAR(40) NOT NULL,
  telefono VARCHAR(15) NOT NULL,
  CONSTRAINT fk_pcontacto_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente)
) ENGINE=InnoDB;

CREATE TABLE paciente_seguro (
  id_paciente_seguro INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT NOT NULL,
  id_seguro INT NOT NULL,
  numero_poliza VARCHAR(40) NOT NULL,
  fecha_inicio DATE,
  fecha_fin DATE,
  estado VARCHAR(15) NOT NULL DEFAULT 'Vigente',
  CONSTRAINT ck_pseguro_fechas CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio),
  CONSTRAINT fk_pseguro_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente),
  CONSTRAINT fk_pseguro_seg FOREIGN KEY (id_seguro) REFERENCES seguro(id_seguro)
) ENGINE=InnoDB;

CREATE TABLE antecedente_personal (
  id_antecedente INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_registro DATE NOT NULL,
  CONSTRAINT fk_antp_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente)
) ENGINE=InnoDB;

CREATE TABLE antecedente_familiar (
  id_antecedente_familiar INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT NOT NULL,
  parentesco VARCHAR(40) NOT NULL,
  condicion VARCHAR(150) NOT NULL,
  observaciones TEXT,
  CONSTRAINT fk_antf_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente)
) ENGINE=InnoDB;

CREATE TABLE paciente_alergia (
  id_paciente_alergia INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT NOT NULL,
  id_alergia INT NOT NULL,
  severidad VARCHAR(20) NOT NULL,
  reaccion VARCHAR(255),
  fecha_diagnostico DATE,
  CONSTRAINT ck_palergia_sev CHECK (severidad IN ('Leve','Moderada','Severa')),
  CONSTRAINT fk_palergia_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente),
  CONSTRAINT fk_palergia_ale FOREIGN KEY (id_alergia) REFERENCES alergia(id_alergia),
  UNIQUE KEY uq_paciente_alergia (id_paciente, id_alergia)
) ENGINE=InnoDB;

-- ===== Atención clínica =====
CREATE TABLE cita (
  id_cita INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT NOT NULL,
  id_medico INT NOT NULL,
  fecha_hora_cita DATETIME NOT NULL,
  motivo VARCHAR(255),
  estado_cita VARCHAR(15) NOT NULL DEFAULT 'Programada',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_cita_estado CHECK (estado_cita IN ('Programada','Confirmada','Atendida','Cancelada','No asistió')),
  CONSTRAINT fk_cita_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente),
  CONSTRAINT fk_cita_med FOREIGN KEY (id_medico) REFERENCES medico(id_medico),
  INDEX ix_cita_medico_fecha (id_medico, fecha_hora_cita),
  INDEX ix_cita_paciente (id_paciente, fecha_hora_cita)
) ENGINE=InnoDB;

CREATE TABLE consulta (
  id_consulta INT AUTO_INCREMENT PRIMARY KEY,
  id_cita INT NULL UNIQUE,
  id_paciente INT NOT NULL,
  id_medico INT NOT NULL,
  fecha_hora_consulta DATETIME NOT NULL,
  tipo_consulta VARCHAR(20) NOT NULL DEFAULT 'Directa',
  anamnesis TEXT,
  examen_fisico TEXT,
  plan_tratamiento TEXT,
  observaciones TEXT,
  CONSTRAINT ck_consulta_tipo CHECK (tipo_consulta IN ('Programada','Directa','Emergencia')),
  CONSTRAINT fk_consulta_cita FOREIGN KEY (id_cita) REFERENCES cita(id_cita),
  CONSTRAINT fk_consulta_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente),
  CONSTRAINT fk_consulta_med FOREIGN KEY (id_medico) REFERENCES medico(id_medico),
  INDEX ix_consulta_paciente_fecha (id_paciente, fecha_hora_consulta)
) ENGINE=InnoDB;

CREATE TABLE signos_vitales (
  id_signos INT AUTO_INCREMENT PRIMARY KEY,
  id_consulta INT NOT NULL UNIQUE,
  presion_sistolica DECIMAL(5,2),
  presion_diastolica DECIMAL(5,2),
  frecuencia_cardiaca INT,
  frecuencia_respiratoria INT,
  temperatura DECIMAL(4,1),
  saturacion_oxigeno DECIMAL(5,2),
  peso DECIMAL(5,2),
  talla DECIMAL(4,2),
  imc DECIMAL(5,2),
  CONSTRAINT ck_signos_sat CHECK (saturacion_oxigeno IS NULL OR saturacion_oxigeno BETWEEN 0 AND 100),
  CONSTRAINT fk_signos_cons FOREIGN KEY (id_consulta) REFERENCES consulta(id_consulta)
) ENGINE=InnoDB;

CREATE TABLE consulta_diagnostico (
  id_consulta_diagnostico INT AUTO_INCREMENT PRIMARY KEY,
  id_consulta INT NOT NULL,
  id_diagnostico INT NOT NULL,
  tipo VARCHAR(15) NOT NULL DEFAULT 'Principal',
  observaciones VARCHAR(255),
  CONSTRAINT ck_cdiag_tipo CHECK (tipo IN ('Principal','Secundario')),
  CONSTRAINT fk_cdiag_cons FOREIGN KEY (id_consulta) REFERENCES consulta(id_consulta),
  CONSTRAINT fk_cdiag_diag FOREIGN KEY (id_diagnostico) REFERENCES diagnostico(id_diagnostico),
  UNIQUE KEY uq_consulta_diag (id_consulta, id_diagnostico)
) ENGINE=InnoDB;

CREATE TABLE prescripcion (
  id_prescripcion INT AUTO_INCREMENT PRIMARY KEY,
  id_consulta INT NOT NULL UNIQUE,
  fecha_emision DATE NOT NULL,
  indicaciones_generales TEXT,
  CONSTRAINT fk_presc_cons FOREIGN KEY (id_consulta) REFERENCES consulta(id_consulta)
) ENGINE=InnoDB;

CREATE TABLE prescripcion_detalle (
  id_prescripcion_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_prescripcion INT NOT NULL,
  id_medicamento INT NOT NULL,
  dosis VARCHAR(60) NOT NULL,
  frecuencia VARCHAR(60) NOT NULL,
  duracion VARCHAR(60),
  via_administracion VARCHAR(50),
  observaciones VARCHAR(255),
  CONSTRAINT fk_pdet_presc FOREIGN KEY (id_prescripcion) REFERENCES prescripcion(id_prescripcion),
  CONSTRAINT fk_pdet_med FOREIGN KEY (id_medicamento) REFERENCES medicamento(id_medicamento)
) ENGINE=InnoDB;

-- ===== Exámenes =====
CREATE TABLE orden_examen (
  id_orden INT AUTO_INCREMENT PRIMARY KEY,
  id_consulta INT NOT NULL,
  id_medico INT NOT NULL,
  fecha_orden DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(15) NOT NULL DEFAULT 'Pendiente',
  CONSTRAINT ck_orden_estado CHECK (estado IN ('Pendiente','En proceso','Completada','Anulada')),
  CONSTRAINT fk_orden_cons FOREIGN KEY (id_consulta) REFERENCES consulta(id_consulta),
  CONSTRAINT fk_orden_med FOREIGN KEY (id_medico) REFERENCES medico(id_medico)
) ENGINE=InnoDB;

CREATE TABLE orden_examen_detalle (
  id_orden_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_orden INT NOT NULL,
  id_examen INT NOT NULL,
  CONSTRAINT fk_odet_orden FOREIGN KEY (id_orden) REFERENCES orden_examen(id_orden),
  CONSTRAINT fk_odet_exam FOREIGN KEY (id_examen) REFERENCES examen(id_examen),
  UNIQUE KEY uq_orden_examen (id_orden, id_examen)
) ENGINE=InnoDB;

CREATE TABLE resultado_examen (
  id_resultado INT AUTO_INCREMENT PRIMARY KEY,
  id_orden_detalle INT NOT NULL UNIQUE,
  fecha_resultado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor_resultado VARCHAR(150),
  unidad VARCHAR(30),
  interpretacion VARCHAR(255),
  archivo_adjunto VARCHAR(255),
  id_medico_valida INT NULL,
  CONSTRAINT fk_res_odet FOREIGN KEY (id_orden_detalle) REFERENCES orden_examen_detalle(id_orden_detalle),
  CONSTRAINT fk_res_med FOREIGN KEY (id_medico_valida) REFERENCES medico(id_medico)
) ENGINE=InnoDB;

-- ===== Infraestructura y hospitalización =====
CREATE TABLE habitacion (
  id_habitacion INT AUTO_INCREMENT PRIMARY KEY,
  id_departamento INT NOT NULL,
  numero_habitacion VARCHAR(10) NOT NULL,
  tipo VARCHAR(20),
  CONSTRAINT fk_hab_dep FOREIGN KEY (id_departamento) REFERENCES departamento(id_departamento),
  UNIQUE KEY uq_hab (id_departamento, numero_habitacion)
) ENGINE=InnoDB;

CREATE TABLE cama (
  id_cama INT AUTO_INCREMENT PRIMARY KEY,
  id_habitacion INT NOT NULL,
  numero_cama VARCHAR(10) NOT NULL,
  estado VARCHAR(15) NOT NULL DEFAULT 'Disponible',
  CONSTRAINT ck_cama_estado CHECK (estado IN ('Disponible','Ocupada','Mantenimiento')),
  CONSTRAINT fk_cama_hab FOREIGN KEY (id_habitacion) REFERENCES habitacion(id_habitacion),
  UNIQUE KEY uq_cama (id_habitacion, numero_cama)
) ENGINE=InnoDB;

CREATE TABLE hospitalizacion (
  id_hospitalizacion INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT NOT NULL,
  id_cama INT NOT NULL,
  id_medico_tratante INT NOT NULL,
  fecha_ingreso DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_egreso DATETIME NULL,
  motivo_ingreso TEXT NOT NULL,
  diagnostico_ingreso VARCHAR(255),
  diagnostico_egreso VARCHAR(255),
  condicion_egreso VARCHAR(20),
  CONSTRAINT ck_hosp_cond CHECK (condicion_egreso IS NULL OR condicion_egreso IN ('Alta','Referencia','Fallecimiento')),
  CONSTRAINT ck_hosp_fechas CHECK (fecha_egreso IS NULL OR fecha_egreso >= fecha_ingreso),
  CONSTRAINT fk_hosp_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente),
  CONSTRAINT fk_hosp_cama FOREIGN KEY (id_cama) REFERENCES cama(id_cama),
  CONSTRAINT fk_hosp_med FOREIGN KEY (id_medico_tratante) REFERENCES medico(id_medico),
  INDEX ix_hosp_paciente (id_paciente)
) ENGINE=InnoDB;

-- ===== Auditoría =====
CREATE TABLE bitacora_acceso (
  id_bitacora INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_paciente INT NULL,
  tabla_afectada VARCHAR(60) NOT NULL,
  accion VARCHAR(15) NOT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  direccion_ip VARCHAR(45),
  CONSTRAINT fk_bit_usr FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  CONSTRAINT fk_bit_pac FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente),
  INDEX ix_bit_fecha (fecha_hora),
  INDEX ix_bit_paciente (id_paciente)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- OPCIONAL (no está en el documento): guardar el motivo de baja del historial
-- ALTER TABLE paciente ADD COLUMN motivo_archivado VARCHAR(255) NULL, ADD COLUMN fecha_archivado DATETIME NULL;

-- Usuario de aplicación (use la misma clave en .env):
-- CREATE USER 'hospital_app'@'localhost' IDENTIFIED BY 'cambie-esta-clave';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON historial_clinico.* TO 'hospital_app'@'localhost';
