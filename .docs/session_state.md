# Estado de sesión

## [QUÉ SE LLEVA (Done)]

- Kanban oficial del dueño verificado con 180 elementos: [Room_Link - Kanban #4](https://github.com/users/IDGS-902-23002072/projects/4).
- Proyecto personal duplicado eliminado.
- Issues propias `#181`–`#230` cerradas como duplicadas porque GitHub exige permiso administrativo para eliminarlas definitivamente.
- Las 31 issues oficiales de autenticación, mensajería y moderación de publicaciones quedaron asignadas a `bhask4ra`.
- Alcance de César identificado y documentado en el plan activo.
- Backend de autenticación, mensajería y moderación de publicaciones implementado con puertos, repositorios y rutas.
- Frontend Expo web/móvil inicializado con las nueve vistas del alcance de César.
- Gate unitario en verde: 36 pruebas backend y 3 pruebas frontend; export web exitoso.
- Gate de integración MySQL en verde: 4 pruebas contra el MySQL 8 de Docker (`DB_PORT=3307`).
- Smoke test backend + MySQL en verde: boot, `/ready` conectado, registro→login→`/me` con cookie `HttpOnly; SameSite=Strict`, 401 en rutas protegidas sin sesión, bloqueo de cuenta al 6º intento (`423 ACCOUNT_LOCKED`), moderación `admin`-only (`403 ADMIN_REQUIRED` para seeker), inbox de mensajería autorizado.
- Vulnerabilidades npm evaluadas (4 backend, 5 frontend): todas moderadas y transitivas de tooling de desarrollo/build; se acepta el riesgo documentado (ver Pending).

## [QUÉ FALTA (Pending)]

- **Vulnerabilidades npm (riesgo aceptado, sin fix limpio):** las 4 de backend provienen de `esbuild <=0.24.2` transitiva vía `drizzle-kit` (ya en su última versión 0.31.11, `devDependency`, ausente del árbol de producción; el advisory es del dev-server de esbuild). Las 5 de frontend provienen de `glob`/`minimatch` bajo `@expo/cli` y `@expo/fingerprint` (ya en expo 58.0.23, última; tooling de build, no viaja al bundle del dispositivo). El único `npm audit fix --force` disponible hace un **downgrade mayor** (drizzle-kit→0.18.1, expo→53) que es una regresión; no se aplica. Revisar al subir drizzle-kit/expo a una versión futura que corte la dependencia transitiva.
- Validación externa real de Google OAuth y envío de correo cuando existan credenciales (los puertos ya se prueban de forma determinista).
- Revisión visual en dispositivo/emulador (requiere emulador o device físico).
- Solicitar al dueño del repositorio la eliminación permanente de `#181`–`#230` solo si también se desea borrar el historial de las duplicadas.

## [QUÉ SE HIZO HOY (Today's Diff)]

- Se desbloqueó el gate de integración MySQL: el `Access denied` era un conflicto de puerto, no de credenciales. MariaDB 11.8 del sistema ocupa el `:3306`; el MySQL 8.4 real del proyecto corre en el contenedor `room-link-mysql` publicado en `:3307`. Las 4 pruebas pasan con `DB_PORT=3307 npm run test:integration`.
- Se ejecutó el smoke test de backend + MySQL (ver Done) cubriendo los flujos de César (auth, mensajería, moderación).
- Se auditaron las dependencias npm de ambos proyectos y se documentó la aceptación de riesgo (ver Pending).

## [ESPERAS EXTERNAS ABIERTAS]

- Google OAuth y el envío real de correo requieren credenciales externas; sus puertos sí quedan probados de forma determinista.
- Revisión visual del frontend en emulador/dispositivo.

## [NOTA DE ENTORNO: MySQL]

- El `:3306` del host lo atiende **MariaDB 11.8** (el `mysqld` del sistema es un symlink a `mariadbd`); las migraciones del proyecto **no** funcionan sobre MariaDB (CHECK/JSON/triggers/collation). El MySQL 8 correcto es el contenedor Docker en **`:3307`**. Para backend y pruebas de integración desde el host: `DB_PORT=3307`. Ver `docs/database.md`.
