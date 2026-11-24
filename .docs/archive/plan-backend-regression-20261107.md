# Plan activo — Backend completo sin deuda técnica, con gate de regresión en `main`

## [OBJETIVO ACTUAL]

Cerrar todas las funcionalidades del backend (módulos ya asignados a César + los no implementados aún de otros integrantes) sin dejar deuda técnica conocida, y dejar en marcha una **suite de regresión** que se ejecute automáticamente cuando el código llega a `main`, cubriendo typecheck, migraciones, pruebas unitarias, de integración contra MySQL 8 y un smoke end-to-end del sistema completo.

## [ALCANCE]

Incluye:
- Resolver deuda técnica detectada: merge conflict ya resuelto, RNF-01.2 (endpoints privados aplican sesión y RBAC) en los 4 módulos ajenos que hoy aceptan `userId` desde body/URL.
- Implementar los módulos y endpoints cuyas tablas existen en `src/db/schema/` pero no tienen código: **connections (accept/reject)**, **notifications**, **moderación extendida (users/messages)**, **sanctions**, **activity log**, **agreements**, **analytics**.
- Pruebas unitarias y de integración por cada módulo nuevo o modificado.
- Smoke/regression test end-to-end que recorre el flujo completo del dominio.
- Workflow `regression.yml` disparado en `push` a `main`, `pull_request` contra `main` y `workflow_dispatch`.
- Documentación actualizada: `README.md` del backend, `docs/api.md` nuevo, `session_state.md`.

Fuera de alcance:
- Cambios en frontend más allá de los contratos existentes (si una ruta cambia de forma incompatible, se documenta en el diff y se coordina).
- Enviar correos o validar OAuth real (siguen stubbeados hasta que haya credenciales).
- Despliegue en infraestructura real.

## [ARQUITECTURA/DISEÑO]

### Dos opciones evaluadas

1. **Extender el monolito modular MVC/DDD existente**: añadir cada módulo nuevo bajo `src/modules/<x>/` con el mismo patrón (`service`, `controller`, `routes`, `view`, `index`) y su repositorio en `src/infrastructure/repositories/Drizzle<X>Repository.ts`, siempre contra una interfaz del dominio en `src/domain/repositories/`.
2. **Partir módulos nuevos a microservicios o paquetes separados**: aislamiento mayor pero introduce un cambio arquitectónico transversal que contradice la arquitectura actualmente documentada.

**Se elige la opción 1**. Mantiene coherencia con los siete módulos ya implementados, respeta la Regla de Oro de Acceso a Datos (repos como única frontera DB) y no fuerza migraciones estructurales. Cada módulo nuevo expone sus puertos (interfaces de repositorio y de servicios externos) y mantiene el dominio libre de Hono y Drizzle. Aplica SOLID: SRP en servicios acotados, DIP a través de interfaces, OCP para los suscriptores de eventos (notifications escucha sin que los publishers lo sepan).

### Decisiones transversales

- **Eventos de dominio**: se reutiliza `DomainEventPublisher` ya existente; notifications se suscribe como consumidor para generar entradas (`notif_notifications`) a partir de `UserRegisteredEvent`, `ListingModeratedEvent`, `message.created`, `ConnectionAcceptedEvent`, `SanctionIssuedEvent`.
- **Autenticación transversal**: todas las rutas privadas usan `createAuthMiddleware`; el `userId` jamás llega por body ni URL cuando identifica al actor — se toma de `context.get("auth").userId`. Rutas públicas se enumeran explícitamente y se documentan.
- **RBAC**: `requireAdmin` ya existe. Se añade `requireRole(role)` genérico para soportar futuros roles (`reviewer`, etc.) sin tocar el middleware.
- **Views/DTOs**: ningún endpoint devuelve `passwordHash`, `tokenHash`, ni campos `*_hash`. Se añade un test de regresión que valida el serializado de cada módulo.
- **Integración de tests**: se agrega `backend/tests/integration/<modulo>.integration.test.ts` por módulo y un `backend/tests/smoke/regression.test.ts` que recorre un flujo completo.
- **Gate de regresión**: workflow `.github/workflows/regression.yml` nuevo. Corre contra el servicio MySQL 8.4 igual que `integration.yml`, encadena typecheck → db:check → unit → integration → smoke. Un fallo en cualquier paso rompe el merge a `main`.

## [PASOS DE IMPLEMENTACIÓN (Checklist)]

### Fase 0 — Baseline estable
- [x] Resolver merge conflict en `backend/src/app.ts` (ambos imports conservados).
- [x] `npm run typecheck` pasa limpio.
- [x] `npm run test:unit` pasa (48/48 tras F1).
- [x] Archivar el plan previo de César en `.docs/archive/`.
- [x] Añadir scripts `test:smoke` y `test:regression` en `backend/package.json`.

### Fase 1 — Cerrar deuda RNF-01.2 en módulos ajenos (auth transversal)
- [x] `profile.routes.ts`: envolver con `createAuthMiddleware`; `POST` usa `userId` de la sesión; `PUT /:userId` con `requireSelfOrAdmin`.
- [x] `rooms.routes.ts`: `GET` públicos; `POST`/`PATCH`/`POST /photos` autenticados; `hostId` desde la sesión; `publish` valida ownership.
- [x] `applications.routes.ts`: todas autenticadas; `applicantId` desde la sesión; `decide` y `getByListing` validan host del listing vía `resolveListingHostId`.
- [x] `compatibility.routes.ts`: todas autenticadas con `requireSelfOrAdmin("userId")`.
- [x] Tests `tests/unit/authorization.unit.test.ts` + actualizaciones a `modules.unit.test.ts` y `compatibility.unit.test.ts`.
- [x] `docs/api.md` creado con mapa completo de rutas públicas/privadas/admin/self.

### Fase 2 — Flujo de conexiones (accept/reject)
- [x] `domain/entities/Connection.ts` + `domain/repositories/IConnectionRepository.ts`.
- [x] `modules/connections/` (service, controller, routes, view, index).
- [x] Endpoints: `GET /api/v1/connections?direction=`, `PATCH /api/v1/connections/:id`, `DELETE /api/v1/connections/:id`.
- [x] `accept` publica `ConnectionAcceptedEvent`.
- [x] `DrizzleConnectionRepository` sobre `connConnections` con manejo de `activePair{Low,High}`.
- [x] Tests unitarios (`tests/unit/connections.service.unit.test.ts`): solo addressee responde, no doble decisión, auto-conexión rechazada en el constructor del dominio, mensaje ≤500, solo requester cancela, 404 cuando no existe, listado por direction.
- [ ] Test de integración: solicitud → aceptación → apertura de chat autorizado (se agrega con la suite integración en F10/F11).

### Fase 3 — Notifications (RF-14)
- [x] `domain/entities/Notification.ts` + `INotificationRepository`.
- [x] `modules/notifications/`: service, controller, routes, view, index.
- [x] `InProcessEventBus` nuevo (composite): outbox persistente + listeners in-process; listeners con try/catch aislado.
- [x] `NotificationsEventConsumer` traduce `UserRegisteredEvent`, `ConnectionAcceptedEvent`, `ListingModeratedEvent`, `MessageSentEvent` en notificaciones; respeta `notif_preferences.inApp`.
- [x] `MessagingService.sendMessage` publica `MessageSentEvent` al bus de dominio.
- [x] Endpoints: `GET /api/v1/notifications`, `PATCH /:id/read`, `POST /mark-all-read`, `GET /preferences`, `PUT /preferences`.
- [x] `DrizzleNotificationRepository` sobre `notif_notifications` + `notif_preferences`.
- [x] Tests unitarios (`tests/unit/notifications.unit.test.ts`): default allowed, preferencia bloqueante, markRead solo dueño, markAllRead cuenta, preferences con huecos, invalid type, 4 tipos de evento mapean a notificación correcta, event desconocido no crashea, listener que lanza no rompe publish.
- [ ] Test de integración: publicar evento → notificación aparece en `GET /notifications` (se agrega con suite integración).

### Fase 4 — Moderación extendida (users, messages)
- [x] Ports extendidos: `ReportReason`, `ReportTargetType`, `UserReportRecord`, `MessageReportRecord`, `AnyReportRecord`.
- [x] `ModerationService.reportUser`: valida motivo, auto-reporte, existencia del usuario y duplicados.
- [x] `ModerationService.reportMessage`: valida motivo, messageId entero, membresía del denunciante en el `room` y duplicados.
- [x] `ModerationService.listAllReports({targetType?, status?})` + `resolveReport({reportId, status})`.
- [x] Endpoints: `POST /reports/users/:userId`, `POST /reports/messages/:messageId`, `GET /admin/reports?targetType=`, `PATCH /admin/reports/:id`.
- [x] `DrizzleModerationRepository`: `userExists`, `hasOpenUserReport`, `createUserReport`, `getMessageRoomId`, `isRoomMember`, `hasOpenMessageReport`, `createMessageReport`, `listReports`, `findReportById`, `resolveReport`.
- [x] Tests unitarios (`reportUser` happy/self/missing/duplicate; `reportMessage` 404/forbidden/ok/invalidId; `resolveReport` open→resolved + doble; `listAllReports` filtrado).
- [ ] Test de integración: flujo completo (se agrega con la suite integración).

### Fase 5 — Sanctions
- [x] `domain/entities/Sanction.ts` (con `isActive`, `blocksSession`) + `ISanctionRepository`.
- [x] `modules/sanctions/`: service, controller, routes (admin-only), view, index.
- [x] Tipos del schema: `warning`, `temporary_suspension`, `permanent_ban`, `listing_removed`, `dismissed`.
- [x] Endpoints: `POST /api/v1/sanctions`, `GET /api/v1/sanctions?userId=`, `DELETE /api/v1/sanctions/:id`.
- [x] `AuthService.authenticate` consulta un `SessionGuard` opcional (inyectado desde `SanctionsService`) y devuelve `423 ACCOUNT_SANCTIONED` si hay sanción bloqueante vigente.
- [x] `SanctionsService.issue` publica `SanctionIssuedEvent`; `NotificationsEventConsumer` emite `account_sanction`.
- [x] `DrizzleSanctionRepository` sobre `mod_sanctions`.
- [x] Tests unitarios (`tests/unit/sanctions.unit.test.ts`): warning + evento, suspensión sin expiresAt, expiresAt pasado, target requerido, findBlockingSession vence/active, warnings no bloquean, revoke 404/409, invariantes de entity.
- [ ] Test de integración (suite F10/F11).

### Fase 6 — Activity log
- [x] `domain/entities/ActivityLogEntry.ts` + `IActivityLogRepository`.
- [x] `modules/activity-log/`: service, controller, routes (admin), view, consumer, index.
- [x] Decisión de diseño: en lugar de middleware por ruta, el `ActivityLogConsumer` se suscribe al bus y persiste **todo** evento publicado (`action = event.type`, `metadata = payload`). Cualquier módulo nuevo queda cubierto sin tocar el logger.
- [x] `AuthService` emite `LoginSucceededEvent` y `LoginFailedEvent` (con `reason` tipado).
- [x] Endpoint admin: `GET /api/v1/admin/activity-log` con `userId`, `action`, `from`, `to`, `limit`, `offset`.
- [x] `DrizzleActivityLogRepository` sobre `mod_activity_log`.
- [x] Tests unitarios (`tests/unit/activity-log.unit.test.ts`): service persiste y filtra, consumer registra 3 eventos distintos con actor correcto, entity requiere action.
- [ ] Test de integración (suite F10/F11).

### Fase 7 — Agreements (acuerdos de convivencia)
- [x] `domain/entities/Agreement.ts` (+ `AgreementAcceptance`) con `rulesSnapshot` inmutable y validación de reglas no vacías; `IAgreementRepository`.
- [x] `modules/agreements/`: service con `AgreementPolicies` inyectable (`getListingHostId`, `isAcceptedApplicant`), controller, routes, view, index.
- [x] Service: `createForListing` (solo host del listing), `getById` (404), `accept` (host o applicant aceptado, idempotente), `listAcceptances` (solo host).
- [x] Endpoints: `POST /api/v1/agreements`, `GET /api/v1/agreements/:id`, `POST /api/v1/agreements/:id/accept`, `GET /api/v1/agreements/:id/acceptances`.
- [x] Eventos: `AgreementCreatedEvent`, `AgreementAcceptedEvent` (solo al pasar de no-firmado a firmado).
- [x] `DrizzleAgreementRepository` sobre `agreement_agreements` + `agreement_acceptances`.
- [x] Tests unitarios (`tests/unit/agreements.unit.test.ts`): host-only create, listing inexistente, reglas vacías, accept allowed host/applicant/forbidden, idempotencia, listAcceptances host-only, 404.
- [ ] Test de integración (suite F10/F11).

### Fase 8 — Analytics
- [x] `domain/entities/DailyMetrics.ts` (rechaza contadores negativos) + `toUtcMidnight`.
- [x] Puertos `IAnalyticsRepository` (upsert/find/listRange) e `IAnalyticsSource` (7 contadores/promedios por día) → testing con stubs deterministas.
- [x] `modules/analytics/`: service, controller, routes (admin-only), view, index.
- [x] `recomputeDaily(day)` normaliza a UTC-midnight, llama al source en paralelo (7 queries), compone `DailyMetrics` y upsertea. Idempotente.
- [x] `getRange(from, to)` con validación de orden.
- [x] Endpoints: `POST /admin/analytics/recompute?date=`, `GET /admin/analytics?from=&to=`.
- [x] `DrizzleAnalyticsRepository` (UPSERT con `onDuplicateKeyUpdate` por PK `metric_date`) + `DrizzleAnalyticsSource` con 7 queries sobre `authUsers`, `roomListings`, `connConnections`, `appApplications`.
- [x] Tests unitarios (`tests/unit/analytics.unit.test.ts`): agrega todas, idempotente, future/invalid date, avg nulls, negativos, getRange inverso y feliz.
- [ ] Test de integración contra MySQL (suite F10/F11).
- [x] Documentación operativa: ejecutar `POST /recompute` desde cron externo diario apuntando al día anterior.

### Fase 9 — Hardening de DTOs y auditoría de respuestas
- [x] Middleware raíz con `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy` restringido (RNF-05.1).
- [x] `tests/unit/hardening.unit.test.ts` recorre respuestas de login, `/me`, `/notifications`, `/health` y 401 anónimo; recursivamente rechaza claves literales prohibidas y cualquier key que termine en `Hash`.
- [x] Guard explícita: `token` queda permitido (es el valor del cliente); `passwordHash`/`tokenHash` fallan la auditoría.
- [x] Contra-prueba: el helper detecta las claves prohibidas cuando existen.

### Fase 10 — Suite de regresión end-to-end
- [x] `tests/helpers/in-memory-repos.ts`: fakes compartidos de los 11 módulos (`InMemoryUserRepository`, `InMemoryProfileRepository`, `InMemoryRoomRepository`, `InMemoryApplicationRepository`, `InMemoryCompatibilityRepository`, `InMemoryConnectionRepository`, `InMemoryMessagingRepository`, `InMemoryModerationRepository`, `InMemorySanctionRepository`, `InMemoryNotificationRepository`, `InMemoryAgreementRepository`, `InMemoryActivityLogRepository`, `InMemoryAnalyticsRepository`, `ZeroAnalyticsSource`).
- [x] `tests/smoke/regression.test.ts` con 11 pasos: publicar listing (hostId de sesión), completar compatibility, enviar solicitud de conexión, aceptar conexión + abrir chat, intercambiar mensajes + delivered/read, aplicar + accept, crear agreement + firmar, reportar listing + resolver, emitir sanción warning, consultar notifications/activity-log/analytics, chequear headers de seguridad en respuestas.
- [x] Guard recursivo en cada payload: rechaza `*Hash` y claves literales sensibles.
- [x] Script `npm run test:smoke` operativo con los fakes (sin MySQL).
- [x] Fix de wiring en `app.ts`: `sanctions` y los consumers ahora comparten `resolvedBus = authDependencies.eventPublisher ?? defaultBus`, no dos publishers distintos. Antes `SanctionsService` publicaba al outbox Drizzle y el resto a otro bus; ahora todos van al mismo.

### Fase 11 — Gate de regresión en CI
- [x] `.github/workflows/regression.yml` creado con triggers `push: [main]`, `pull_request: [main]`, `workflow_dispatch` y `concurrency` con `cancel-in-progress: false`.
- [x] Service MySQL 8.4 incorporado en el job; healthcheck con `mysqladmin ping`.
- [x] Pipeline encadenado: `typecheck` → `db:check` → `db:migrate:bun` → `test:unit:bun` → `vitest tests/integration/` → `vitest tests/smoke/` → `upload-artifact` de coverage.
- [x] Step de `npm audit` con `continue-on-error: true` (no bloquea; registra aceptación documentada).
- [x] Branch protection documentada en `backend/README.md` sección 7 (activación manual por admin del repo).
- [x] YAML validado con parser Python.

### Fase 12 — Documentación y cierre
- [ ] Crear `docs/api.md`: tabla completa con método, ruta, auth requerida, rol, descripción, body de ejemplo, códigos de error.
- [ ] Actualizar `backend/README.md`: sección de módulos ampliada, listado completo de rutas, cómo correr smoke localmente.
- [ ] Actualizar `.docs/session_state.md`: mover Pending a Done conforme avance, listar fases cerradas.
- [ ] Al cerrar las 12 fases, archivar este plan en `.docs/archive/` con fecha.

## [CRITERIOS DE ACEPTACIÓN]

- `npm run typecheck` pasa sin errores.
- `npm run db:check` pasa.
- `npm run test:unit` cubre los 12 módulos (7 existentes + 5 nuevos) con cero fallas.
- `npm run test:integration` corre contra MySQL 8.4 con cero fallas; cubre al menos un happy-path por módulo nuevo y los flujos del alcance de César.
- `npm run test:smoke` recorre el flujo completo del dominio sin errores.
- Workflow `regression.yml` corre verde en `pull_request` contra `main` sobre una rama con el trabajo completo.
- Ninguna ruta privada acepta identificadores del usuario como parámetros de entrada confiables; todas derivan el actor de la sesión.
- Ninguna respuesta serializa campos sensibles (`*_hash`, `token`, `secret`).
- El código no contiene marcadores de merge conflict ni `TODO:` bloqueantes nuevos.
- `docs/api.md` existe y lista todos los endpoints con su contrato de auth.
- `.docs/session_state.md` refleja el estado al cierre.
- Las 180 issues del Kanban oficial que correspondan a los módulos implementados aparecen con PR enlazado; **ninguna se marca como cerrada hasta que QA la verifique en build de preview**.

## [DEPENDENCIAS EXTERNAS]

- MySQL 8.4 corriendo (Docker Compose en la raíz o CI service).
- Credenciales reales de Google OAuth y SMTP: pendientes; los puertos siguen stubbeados.
- Acceso de admin al repo GitHub para activar la branch protection rule (solo documentar; no bloquea el desarrollo).

## [RIESGOS Y MITIGACIONES]

- **Scope amplio**: 5 módulos nuevos + hardening + smoke + CI. Mitigación: fases independientes, cada una mergeable por separado; si una fase queda larga, se pausa y se documenta aquí el reajuste.
- **Cambios de contrato en rutas ajenas** (Fase 1): el frontend puede romperse si consume body para `userId`. Mitigación: antes de cada cambio, buscar consumidores en `frontend/Room_Link/` y dejar nota en el PR.
- **Tiempo del smoke en CI**: puede crecer. Mitigación: ejecutar siembra mínima, usar transacciones por test donde el runtime lo permita, timeout de job explícito.
- **Idempotencia de analytics**: un recompute parcial podría sobreescribir métricas. Mitigación: UPSERT atómico por `metricDate`, test que recomputa dos veces y verifica identidad del resultado.
