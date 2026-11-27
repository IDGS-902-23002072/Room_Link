-- Se ejecuta SOLO en la inicialización de un volumen MySQL vacío.
-- Crea un esquema y un usuario distintos de la base principal `roomlink`.
CREATE DATABASE IF NOT EXISTS roomlink_monitor
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'roomlink_monitor'@'%'
  IDENTIFIED BY 'roomlink_monitor_school';

GRANT SELECT, INSERT, UPDATE, DELETE ON roomlink_monitor.* TO 'roomlink_monitor'@'%';
GRANT CREATE, ALTER, DROP, INDEX ON roomlink_monitor.* TO 'roomlink_monitor'@'%';

FLUSH PRIVILEGES;
