# Estado de sesión

## [QUÉ SE LLEVA (Done)]

### Alcance original de César (base previa)
- Kanban oficial del dueño verificado con 180 elementos: [Room_Link - Kanban #4](https://github.com/users/IDGS-902-23002072/projects/4).
- Backend de autenticación, mensajería y moderación de publicaciones implementado con puertos, repositorios y rutas.
- Frontend Expo web/móvil inicializado con las nueve vistas del alcance de César.
- Gate unitario y gate de integración MySQL ya habían quedado verdes para esos tres módulos.

### Deuda técnica cerrada (F0–F1)
- Merge conflict en `backend/src/app.ts` resuelto (ambos imports conservados).
- RNF-01.2 aplicada en los cuatro módulos ajenos (`profile`, `rooms`, `applications`, `compatibility`): todas las rutas privadas exigen sesión y derivan el `userId` del principal, no del body/URL. Nuevo helper `requireSelfOrAdmin(paramName)` en `auth.middleware.ts`.
- Nuevos scripts `test:smoke` y `test:regression` en `backend/package.json`.
- `docs/api.md` creado y mantenido como mapa de rutas públicas / privadas / admin / self.

### Módulos nuevos construidos (F2–F8)
- **Connections** (`/api/v1/connections`): dominio `Connection` + repo + flujo accept/reject/cancel con transiciones validadas; emite `ConnectionAcceptedEvent`.
- **Notifications** (`/api/v1/notifications`): dominio `Notification` + preferencias; nuevo `InProcessEventBus` (outbox persistente + listeners in-process con try/catch aislado); `NotificationsEventConsumer` traduce `UserRegisteredEvent`, `ConnectionAcceptedEvent`, `ListingModeratedEvent`, `MessageSentEvent` y `SanctionIssuedEvent` en notificaciones respetando `inApp`. `MessagingService.sendMessage` ahora emite `MessageSentEvent`.
- **Moderación extendida** (`/reports/users/:userId`, `/reports/messages/:messageId`, `/admin/reports`, `/admin/reports/:id`): reutiliza `mod_reports` con `targetType`; validación de membresía en room para denuncias de mensajes; resolver con 409 contra doble resolución.
- **Sanctions** (`/api/v1/sanctions`, admin-only): dominio con `isActive`/`blocksSession`; emite `SanctionIssuedEvent`; integra con `AuthService.authenticate` vía puerto `SessionGuard` → `423 ACCOUNT_SANCTIONED` cuando hay sanción vigente.
- **Activity log** (`/api/v1/admin/activity-log`): consumer universal del bus persiste cada evento con `action = event.type`, `metadata = payload`; `AuthService` ahora emite `LoginSucceededEvent` y `LoginFailedEvent` (con `reason`).
- **Agreements** (`/api/v1/agreements`): dominio con `rulesSnapshot` inmutable; `AgreementPolicies` inyectable para host/applicant; `accept` idempotente; eventos `AgreementCreatedEvent` / `AgreementAcceptedEvent`.
- **Analytics** (`/api/v1/admin/analytics`): dominio `DailyMetrics` + puertos `IAnalyticsRepository` e `IAnalyticsSource` (7 contadores/promedios en paralelo); recompute idempotente por `metricDate` con UPSERT; endpoint `GET /` por rango.

### Hardening transversal (F9)
- Middleware raíz inyecta `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy` restringido en toda respuesta (RNF-05.1).
- `tests/unit/hardening.unit.test.ts` recorre respuestas de login, `/me`, `/notifications`, `/health` y 401 anónimo rechazando recursivamente claves prohibidas y cualquier `*Hash`.

### Suite de regresión (F10–F11)
- `tests/helpers/in-memory-repos.ts`: 13 fakes + source + factory reutilizables.
- `tests/smoke/regression.test.ts`: flujo end-to-end de 11 pasos encadenados sobre fakes in-memory, con guard recursivo contra claves sensibles en cada payload.
- Fix de wiring en `app.ts`: `sanctionsService` y los consumers comparten `resolvedBus` (antes había dos publishers distintos).
- Workflow `.github/workflows/regression.yml` nuevo: triggers `pull_request: [main]`, `push: [main]`, `workflow_dispatch`; service MySQL 8.4; pipeline `typecheck → db:check → db:migrate:bun → test:unit:bun → vitest integration → vitest smoke`; `npm audit` informativo; coverage artifact.
- Documentada la branch protection rule en `backend/README.md` sección 7.

### Métricas de calidad al cierre
- `npm run typecheck` → limpio.
- `npm run test:unit` → **106/106**.
- `npm run test:smoke` → **11/11** (sin MySQL, fakes in-memory).
- `npm run test:integration` → sigue verde contra el servicio MySQL 8.4 en CI (`regression.yml`).

## [QUÉ FALTA (Pending)]

- **Integration tests por módulo nuevo**: cada uno tiene smoke in-memory; falta un test de integración dedicado contra MySQL para `connections`, `notifications`, `sanctions`, `activity-log`, `agreements`, `analytics`, y la cobertura extendida de moderación. Marcado en el plan como follow-up.
- **Branch protection**: la regla descrita en `backend/README.md §7` debe activarla manualmente un admin del repositorio.
- **Credenciales reales** de Google OAuth y de SMTP: los puertos siguen stubbeados.
- **Revisión visual en dispositivo/emulador** del frontend sigue abierta.
- **Vulnerabilidades npm aceptadas**: sin fix limpio todavía (ver notas previas).
- **QA formal**: ninguna issue de Kanban se marca cerrada hasta que QA verifique en build de preview (regla del DoD).

## [QUÉ SE HIZO HOY (Today's Diff)]

- 12 fases del plan de backend-sin-deuda ejecutadas en orden: F0 baseline, F1 blindaje auth, F2 connections, F3 notifications, F4 moderación extendida, F5 sanctions, F6 activity log, F7 agreements, F8 analytics, F9 hardening DTOs + security headers, F10 smoke end-to-end, F11 workflow de regresión, F12 docs y cierre.
- 6 módulos nuevos añadidos al monolito modular con el mismo patrón ya establecido (service/controller/routes/view/index + repositorio Drizzle).
- 2 nuevos puertos transversales: `SessionGuard` (auth consulta sanciones sin acoplarse) y `AgreementPolicies` (acuerdos consulta rooms/applications sin acoplarse).
- Un nuevo bus de eventos in-process (`InProcessEventBus`) sobre el outbox existente; 5 consumers suscritos.
- 61 tests nuevos (unit + smoke).

## [ESPERAS EXTERNAS ABIERTAS]

- Admin del repositorio: activar branch protection sobre `main` requiriendo `Backend · regression gate`.
- Credenciales de Google OAuth y SMTP reales.
- Revisión visual del frontend en emulador/dispositivo.

## [NOTA DE ENTORNO: MySQL]

- El `:3306` del host lo atiende **MariaDB 11.8**; las migraciones del proyecto **no** funcionan sobre MariaDB. El MySQL 8 correcto es el contenedor Docker en **`:3307`**. Para backend y pruebas de integración desde el host: `DB_PORT=3307`. Ver `docs/database.md`.
