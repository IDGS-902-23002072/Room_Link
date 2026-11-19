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

### Integración completa en `develop` (PRs recientes + `integracion/roberto`)
- **`integracion/roberto` (y PR #242 / `feature/roberto`)**: integrados los módulos completos de Roberto Vargas bajo la arquitectura endurecida con sesión/autorización:
  - **Perfil extendido (HU-02)**: galería de fotos (tope 6, soporte de URL y carga `multipart/form-data` en `/uploads/photos`, reordenamiento por `order` o `photoIds`), privacidad de contacto (`ContactPrivacy`), solicitud de verificación de identidad, redes sociales y preferencias de notificación por tipo.
  - **Search (HU-05)**: módulo `/api/v1/search` (`profiles`, `listings`, `count`) con `DrizzleSearchRepository` y validación de rangos.
  - **Agreements (HU-12)**: módulo `/api/v1/agreements` con agregado `Agreement`, snapshot inmutable de reglas y costos, firma digital con validación de participantes y versionado.
- **`feature/omar` (PR #241 y PR #238) + `feature/4-feed-habitaciones` (PR #240)**:
  - **Rooms Feed (HU-04)**: endpoint público `GET /api/v1/rooms/feed` con búsqueda por texto (`q`), rango de renta (`minRent`, `maxRent`), `excludeHostId` y paginación (`page`, `pageSize`).
  - **Analytics administrativo dual (`/api/v1/admin/analytics`)**: soporta tanto el corte diario (`GET /?from=&to=` y `POST /recompute?date=`) como el dashboard administrativo web (`GET /?start=&end=` con `kpis`, `monthlyUsers` y `monthlyListings`).
  - **CORS y configuración**: habilitados orígenes de desarrollo web Vite (`http://localhost:5173`, `http://127.0.0.1:5173`) además de Expo (`8081`), `railway.json` y script de seed/benchmark de compatibilidad (`db:seed:compatibility`, `db:benchmark:compatibility`).
  - **Frontend móvil y Web**: integrados el rediseño del feed de habitaciones, galería de fotos de perfil y portal web React (cuestionario, recomendaciones y dashboard de métricas).
- **`feature/cesar`**: integrado ajuste de versión de Bun en `CONTRIBUTING.md`.

### Unificación 100% del Frontend en `frontend/Room_Link` (2026-11-18)
- **Fase 1 (Auth + Rewire):** sesión (`src/auth/sesion.ts`, `api-auth.ts`, `SesionContext.tsx`, `ui.tsx`), pantallas `app/(auth)/` (login, registro, recuperar), gating en `app/_layout.tsx`, shim web de mapas (`PantallaUbicacion.web.tsx`) y rewire de todos los `api.ts` al token `Bearer` de sesión real.
- **Fase 3 (Chat HU-10 y Moderación HU-13):** portados `modulos/chats/` (bandeja, sala, historial, envío, lectura, contexto y reporte) y `modulos/moderacion/` (cola, denuncias e historial admin en `/moderacion` + reporte de anuncios en `FichaHabitacion`).
- **Fase 4 (Notificaciones HU-14 + Sistema Android):** implementado `modulos/notificaciones/` (`/notificaciones`, listado, lectura, marcar todas y preferencias In-App/Email) junto con `permisosSistema.ts` y permisos Android `POST_NOTIFICATIONS` en `app.json` (solicitud runtime en Android 13+, canal nativo, disparo de alertas a nivel sistema y sincronización en segundo plano).
- **Módulos restantes con UI móvil:** `modulos/acuerdos/` (`/acuerdos` — HU-12), `modulos/conexiones/` (`/conexiones` — gestión de solicitudes entrantes/salientes) y `modulos/sanciones/` (`/sanciones` — panel admin).
- **Cierre de unificación:** eliminada la app duplicada `frontend/src` y `frontend/App.js`, apuntando scripts, tests unitarios (`frontend/tests/modules.unit.test.js`), E2E (`mobile-auth.e2e.mjs`) y CI (`regression.yml`) a `frontend/Room_Link`.

### Métricas de calidad al cierre
- `npm run typecheck` / `bun run typecheck` → limpio (0 errores).
- `npm run db:check` / `bun run db:check` → limpio (`Everything's fine`).
- `npm run test:unit` / `bun run test:unit:bun` → **154/154** (18 suites unitarias).
- `npm run test:smoke` → **12/12** (flujo end-to-end in-memory cubriendo los 13 módulos del backend).
- `DB_PORT=3307 npm run test:integration` → **4/4** contra MySQL 8.4 real.
- `web` (`npm test`) → **4/4** tests pasando.

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
