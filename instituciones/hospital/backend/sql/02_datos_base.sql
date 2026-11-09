-- Datos mínimos y FICTICIOS para poder operar. Los roles son obligatorios; el resto es de demostración.
USE historial_clinico;

INSERT INTO rol (nombre_rol, descripcion) VALUES
 ('administrador','Administración total del sistema'),
 ('medico','Atención clínica de pacientes'),
 ('enfermeria','Apoyo clínico y hospitalización'),
 ('recepcion','Registro administrativo y citas');

INSERT INTO departamento (nombre_departamento, ubicacion, extension_telefono) VALUES
 ('Medicina Interna','Torre A, nivel 2','201'),
 ('Pediatría','Torre B, nivel 1','101'),
 ('Emergencias','Planta baja','100');

INSERT INTO especialidad (nombre_especialidad, descripcion) VALUES
 ('Medicina Interna','Atención de adultos'),
 ('Pediatría','Atención de niños y adolescentes'),
 ('Medicina de Emergencia','Atención de urgencias');

INSERT INTO seguro (nombre_aseguradora, telefono_contacto, direccion) VALUES
 ('Aseguradora Demo A','22000001','Ciudad de Guatemala'),
 ('Aseguradora Demo B','22000002','Quetzaltenango');

INSERT INTO diagnostico (codigo_cie10, nombre_diagnostico) VALUES
 ('J00','Rinofaringitis aguda (resfriado común)'),
 ('I10','Hipertensión esencial (primaria)'),
 ('E11.9','Diabetes mellitus tipo 2 sin complicaciones');

INSERT INTO medicamento (nombre_generico, nombre_comercial, presentacion, concentracion, via_administracion) VALUES
 ('Paracetamol','Demo-Paracetamol','Tableta','500 mg','Oral'),
 ('Amoxicilina','Demo-Amoxi','Cápsula','500 mg','Oral'),
 ('Ibuprofeno','Demo-Ibu','Tableta','400 mg','Oral');

INSERT INTO examen (nombre_examen, tipo_examen, unidad_medida, valor_referencia) VALUES
 ('Hematología completa','Laboratorio',NULL,'Según parámetro'),
 ('Glucosa en ayunas','Laboratorio','mg/dL','70 - 100'),
 ('Radiografía de tórax','Imagen',NULL,NULL);

INSERT INTO alergia (nombre_alergia, tipo) VALUES
 ('Penicilina','Medicamento'),
 ('Polen','Ambiental'),
 ('Maní','Alimento');

INSERT INTO medico (colegiado, primer_nombre, primer_apellido, id_especialidad, id_departamento, estado) VALUES
 ('C-0001','Médico','Demo Uno',1,1,'Activo'),
 ('C-0002','Médico','Demo Dos',3,3,'Activo');

INSERT INTO habitacion (id_departamento, numero_habitacion, tipo) VALUES (1,'201','Doble'),(1,'202','Individual');
INSERT INTO cama (id_habitacion, numero_cama) VALUES (1,'A'),(1,'B'),(2,'A');
