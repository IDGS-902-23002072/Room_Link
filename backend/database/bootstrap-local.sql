CREATE DATABASE IF NOT EXISTS `roomlink`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

SET GLOBAL log_bin_trust_function_creators = 1;

CREATE USER IF NOT EXISTS 'roomlink_app'@'localhost'
  IDENTIFIED BY 'roomlink_school';
CREATE USER IF NOT EXISTS 'roomlink_app'@'127.0.0.1'
  IDENTIFIED BY 'roomlink_school';

GRANT ALL PRIVILEGES ON `roomlink`.* TO 'roomlink_app'@'localhost';
GRANT ALL PRIVILEGES ON `roomlink`.* TO 'roomlink_app'@'127.0.0.1';

FLUSH PRIVILEGES;
