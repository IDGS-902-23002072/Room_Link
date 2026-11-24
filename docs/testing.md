# Testing y CI — qué corre con cada cosa

Mapa de qué se ejecuta en cada script y en cada workflow de CI, para que no haya
dudas sobre qué cubre cada uno.

## Scripts por proyecto

### `backend/` (vitest, corre en Node y Bun)
| Script | Qué corre |
|---|---|
| `npm run typecheck` | `tsc --noEmit` (tipos). |
| `npm run db:check` | `drizzle-kit check` — consistencia de migraciones (offline). |
| `npm run test:unit` | Pruebas unitarias (`tests/unit/`), con fakes in-memory. Sin BD. |
| `npm run test:integration` | Pruebas de integración (`tests/integration/`) contra **MySQL real** (requiere `DB_*`). |
| `npm run test:smoke` | Smoke end-to-end in-memory (`tests/smoke/`), cubre los 13 módulos. |
| `npm run test:regression` | typecheck → db:check → unit → integration → smoke (todo encadenado). |
| `npm run test:unit:bun` | Unitarias con runtime Bun. |

### `frontend/` (app móvil React Native Web — vitest + E2E)
| Script | Qué corre |
|---|---|
| `npm test` | Unitarias de lógica/componentes (`vitest run`). Sin navegador. |
| `npm run build:web` | `expo export --platform web` → `dist/`. |
| `npm run test:e2e` | **E2E en navegador real** (`tests/e2e/*.e2e.mjs`, puppeteer-core). Requiere backend + build servido (ver abajo). |

### `web/` (portal admin React/Vite)
| Script | Qué corre |
|---|---|
| `npm test` | `node --test src/**/*.test.js`. |
| `npm run lint` | `oxlint`. |

## El E2E móvil (`frontend/tests/e2e/mobile-auth.e2e.mjs`)

Verifica lo que un smoke por curl **no** puede: que el cliente real (navegador)
consuma la API **cross-origin** — CORS + credenciales + Bearer token — y complete
el login hasta la pantalla autenticada. Un `curl` pasa aunque el CORS esté roto,
porque curl no aplica la política same-origin; solo el navegador la ejerce.

Variables de entorno (con defaults locales):
- `E2E_API_URL` → `http://localhost:3000/api/v1`
- `E2E_WEB_URL` → `http://localhost:8081`
- `CHROME_PATH` → `/usr/bin/google-chrome`

Para correrlo **localmente** necesitás, en paralelo:
1. MySQL arriba (`docker compose up -d`, expone 3307).
2. Backend: `cd backend && DB_PORT=3307 npm run start:node`.
3. Build del móvil servido en un origen permitido por CORS (8081):
   `cd frontend && npm run build:web && (cd dist && python3 -m http.server 8081)`.
4. `cd frontend && npm run test:e2e`.

> El puerto **8081** importa: el CORS del backend (`backend/src/app.ts`) permite
> `localhost:8081`, `127.0.0.1:8081` y los orígenes Vite `5173`. Servir el móvil
> en otro puerto hace que el navegador bloquee todas las llamadas.

## Workflows de CI — qué corre y cuándo

| Workflow | Trigger | Qué ejecuta |
|---|---|---|
| **ci.yml** | PR → `develop`/`main`, push → `develop` | Rápido, sin BD: frontend `npm test` (unit vitest); backend typecheck + db:check + unit (Bun) + compat Node. |
| **integration.yml** | push → `develop` | Backend: migraciones + `test:integration` contra MySQL (servicio). El frontend no tiene integration propia. |
| **regression.yml** | PR → `main`, push → `main`, manual | **Gate dev→main (por velocidad, solo acá).** Job `regression-backend`: typecheck → db:check → migrate → unit → integration → smoke (MySQL). Job `e2e-mobile`: levanta MySQL + backend + build/servido del móvil + corre el **E2E en navegador real**. |
| pr-labeler.yml | PR | Etiqueta el PR según el prefijo de la rama. |
| release.yml | tag `v*.*.*` | Build de release (EAS). |

Regla: lo **rápido** (lint, typecheck, unit) corre en cada PR vía `ci.yml`; lo
**pesado** (integración MySQL, smoke, E2E de navegador) corre en el gate
`regression.yml` **solo al llegar a `main`**.

## QA final por rol

El workflow `QA final RoomLink` ejecuta MySQL 8.4, Mailpit, la web Vite de producción y el cliente Expo exportado. Las pruebas crean usuarios y anuncios sintéticos en servicios de loopback. El administrador se aprovisiona en la base aislada de QA y solo para el ID creado por la prueba.

La suite [qa-roles.spec.mjs](../frontend/tests/e2e/qa-roles.spec.mjs) cubre arrendador persistente, solicitudes después de recargar, permisos, chat entre cuentas, lectura, reconexión, moderación, recuperación de sesión por correo, navegación con teclado y PWA offline. Ejecutar con el entorno arrancado y `E2E_API_URL`, `E2E_QA_WEB_URL`, `E2E_QA_MOBILE_URL`, `E2E_MAILPIT_URL` y `DB_*` del entorno QA:

```bash
cd frontend
npx playwright test --config=playwright.qa.config.mjs
```

La prueba SMTP usa el enlace entregado a Mailpit. La prueba unitaria de autenticación comprueba también la caducidad de 30 minutos. En web offline se sirve una pantalla local y se reintenta al recuperar red. Los datos privados, los tokens y las respuestas de API quedan fuera del caché del service worker.

Para validar el **APK instalado**, usa el flujo nativo [login-por-rol.yaml](../frontend/tests/maestro/login-por-rol.yaml) en un dispositivo Android conectado. Ejecuta una vez por cada cuenta de QA usando credenciales por variables y un título que identifique la pantalla esperada para su rol.

```bash
maestro test -e QA_EMAIL="$QA_EMAIL" -e QA_PASSWORD="$QA_PASSWORD" \
  -e QA_EXPECTED_SCREEN="$QA_EXPECTED_SCREEN" frontend/tests/maestro/login-por-rol.yaml
```

El ensayo de restauración requiere una base separada vacía con sufijo `_qa_restore`, un origen QA sin escrituras durante el ensayo y cliente MySQL 8. Compara tablas, vistas, triggers y conteos de usuarios, anuncios y postulaciones. El ensayo de disponibilidad ejecuta 40 lecturas locales con concurrencia 4 y registra p95.

```bash
bash scripts/verify-mysql-restore.sh roomlink roomlink_qa_restore
node scripts/qa-availability.mjs
```
