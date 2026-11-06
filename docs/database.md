# Base de datos MySQL

Room_Link usa MySQL 8.4, Drizzle ORM y el driver `mysql2`. El esquema inicial contiene 38 tablas, 4 vistas, 6 triggers y los pesos iniciales del cálculo de compatibilidad.

> No uses MariaDB para validar las migraciones: aunque el cliente `mariadb` puede conectarse a MySQL, el servidor debe ser MySQL 8 por las diferencias en `CHECK`, JSON, triggers, expresiones predeterminadas y collation.

## Credenciales locales del proyecto

Estas credenciales son deliberadamente simples porque el proyecto no se desplegarán en producción:

| Campo | Valor |
|---|---|
| Base | `roomlink` |
| Usuario | `roomlink_app` |
| Contraseña | `roomlink_school` |
| Contraseña root de Docker | `roomlink_root` |
| Puerto de MySQL local | `3306` |
| Puerto publicado por Docker | `3307` |

Docker usa `3307` para no entrar en conflicto con una instalación local que ya esté usando `3306`.

## Opción A: MySQL con Docker

Desde la raíz del repositorio:

```bash
docker compose up --build --wait
docker compose ps --all
```

Esto levanta MySQL, espera su healthcheck y ejecuta las migraciones en un contenedor Node.js de una sola ejecución. El resultado correcto muestra `room-link-mysql` como `healthy` y `room-link-migrate-1` como `Exited (0)`.

Para ejecutar el backend desde la computadora anfitriona hay que usar el puerto publicado `3307`.

Bash, macOS o Linux:

```bash
cd backend
DB_PORT=3307 npm run dev:node
# o
DB_PORT=3307 bun run dev:bun
```

PowerShell:

```powershell
cd backend
$env:DB_PORT = "3307"
npm run dev:node
# o: bun run dev:bun
```

Comprobaciones:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Para detener sin borrar datos:

```bash
docker compose down
```

Para reiniciar completamente la base de desarrollo se puede usar el siguiente comando. **Elimina todos los datos guardados en el volumen de Room_Link**:

```bash
docker compose down --volumes
docker compose up --build --wait
```

## Opción B: MySQL sin Docker

### 1. Instalar MySQL 8

- Windows: instala MySQL Community Server con MySQL Installer y conserva el puerto `3306`.
- macOS con Homebrew: `brew install mysql` y después `brew services start mysql`.
- Ubuntu/Debian: `sudo apt install mysql-server` y después `sudo systemctl enable --now mysql`.

En Windows el nombre del servicio puede variar (`MySQL80`, por ejemplo). Puede iniciarse desde la aplicación Servicios o con `net start <nombre-del-servicio>` en una terminal con permisos de administrador.

### 2. Crear la base y el usuario

El script debe ejecutarse con una cuenta administradora porque crea usuarios y habilita la creación de triggers cuando binary logging está activo.

Bash, macOS, Linux o `cmd.exe`:

```bash
cd backend
mysql -u root -p < database/bootstrap-local.sql
```

PowerShell:

```powershell
cd backend
Get-Content database/bootstrap-local.sql | mysql -u root -p
```

Si Ubuntu configuró root mediante autenticación del sistema, usa:

```bash
sudo mysql < database/bootstrap-local.sql
```

### 3. Instalar dependencias y migrar

Con Node.js:

```bash
cd backend
npm install
npm run db:migrate:node
npm run dev:node
```

Con Bun:

```bash
cd backend
bun install
bun run db:migrate:bun
bun run dev:bun
```

No hay que configurar variables: estos comandos usan `127.0.0.1:3306` y las credenciales de la tabla anterior.

## Cambiar el esquema

1. Modifica los módulos de `backend/src/db/schema/`.
2. Genera una migración con `npm run db:generate` o `bun run db:generate`.
3. Revisa el SQL nuevo dentro de `backend/drizzle/`.
4. Aplica con `npm run db:migrate:node` o `bun run db:migrate:bun`.
5. Ejecuta `npm run typecheck`, las pruebas unitarias y las pruebas de integración.

Las vistas y triggers viven en migraciones SQL personalizadas porque Drizzle no representa todas esas capacidades declarativamente. No edites una migración que ya haya sido compartida y aplicada por otros integrantes; crea otra.

## Pruebas de integración

Con MySQL local en `3306`:

```bash
cd backend
npm run test:integration
```

Contra el contenedor publicado en `3307`:

```bash
cd backend
DB_PORT=3307 npm run test:integration
```

Las pruebas verifican el número de tablas y vistas, datos de referencia, mayoría de edad, publicación con tres fotos, postulaciones y unicidad de conexiones activas.
