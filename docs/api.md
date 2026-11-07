# API de Room_Link — rutas y autorización

Documento vivo. Lista todas las rutas HTTP del backend, su requisito de autenticación/rol y el origen del `userId` del actor en cada operación.

- **Pública**: no requiere sesión. No se puede confiar en nada del cuerpo para identificar al actor.
- **Privada**: exige cookie `roomlink_session` o `Authorization: Bearer <token>`. El `userId` del actor viene de la sesión (`context.get("auth").userId`), nunca del body ni de la URL.
- **Admin**: además de sesión, el usuario debe tener el rol `admin`.
- **Self/Admin**: la sesión debe coincidir con el `:userId` de la ruta, o ser admin.

---

## `/api/v1/auth`

| Método | Ruta                      | Auth    | Descripción                                                                 |
|--------|---------------------------|---------|-----------------------------------------------------------------------------|
| POST   | `/register`               | Pública | Alta local. Exige email único, password ≥ 8 y `termsAccepted: true`.        |
| POST   | `/login`                  | Pública | Login local. Bloqueo 15 min tras 5 intentos fallidos.                       |
| POST   | `/oauth/google`           | Pública | Login/alta con Google (puerto `OAuthProfileProvider`).                      |
| POST   | `/password/forgot`        | Pública | Pide reset. Respuesta neutra: no filtra existencia de cuentas.              |
| POST   | `/password/reset`         | Pública | Reset con token hasheado (TTL 30 min). Revoca todas las sesiones.           |
| GET    | `/me`                     | Privada | Perfil de sesión.                                                           |
| POST   | `/logout`                 | Privada | Revoca la sesión actual.                                                    |

## `/api/v1/profiles`

| Método | Ruta         | Auth        | Notas                                                           |
|--------|--------------|-------------|-----------------------------------------------------------------|
| GET    | `/:userId`   | Privada     | Perfil público (DTO sin campos sensibles). Cualquier logueado.  |
| POST   | `/`          | Privada     | Crea perfil para el `userId` de la sesión.                      |
| PUT    | `/:userId`   | Self/Admin  | Solo el dueño o admin puede modificar.                          |

## `/api/v1/rooms`

| Método | Ruta                       | Auth    | Notas                                                             |
|--------|----------------------------|---------|-------------------------------------------------------------------|
| GET    | `/`                        | Pública | Listado paginado de listings publicados.                          |
| GET    | `/:id`                     | Pública | Detalle de un listing.                                            |
| GET    | `/host/:hostId`            | Pública | Listings por anfitrión.                                           |
| GET    | `/:id/photos/:photoId`     | Pública | Binario de una foto del listing.                                  |
| POST   | `/`                        | Privada | Crea listing. `hostId` se toma de la sesión, no del body.         |
| PATCH  | `/:id/publish`             | Privada | Solo el `hostId` del listing (o admin) puede publicar.            |
| POST   | `/photos`                  | Privada | Subida de fotos.                                                  |

## `/api/v1/applications`

| Método | Ruta                  | Auth    | Notas                                                                    |
|--------|-----------------------|---------|--------------------------------------------------------------------------|
| POST   | `/`                   | Privada | Crea solicitud. `applicantId` se toma de la sesión, no del body.         |
| GET    | `/listing/:listingId` | Privada | Solo el host del listing (o admin) ve sus solicitudes.                   |
| PATCH  | `/:id/decide`         | Privada | Solo el host del listing asociado (o admin) decide `accept`/`reject`.    |

## `/api/v1/compatibility`

Todas las rutas son privadas y validan que `:userId` coincida con la sesión (o admin).

| Método | Ruta                                 | Auth        | Notas                                              |
|--------|--------------------------------------|-------------|----------------------------------------------------|
| GET    | `/:userId`                           | Self/Admin  | Devuelve respuestas y resumen del test.            |
| PUT    | `/:userId`                           | Self/Admin  | Guarda las 7 dimensiones (enteros 1–5).            |
| GET    | `/:userId/feed?page=N`               | Self/Admin  | Hasta 12 perfiles ordenados por afinidad.          |
| GET    | `/:userId/candidates/:candidateId`   | Self/Admin  | Detalle de candidato con su afinidad.              |
| POST   | `/:userId/connections`               | Self/Admin  | Crea solicitud de conexión.                        |

## `/api/v1/connections`

| Método | Ruta          | Auth    | Notas                                                                                  |
|--------|---------------|---------|----------------------------------------------------------------------------------------|
| GET    | `/`           | Privada | Conexiones del usuario de sesión. Query `direction=incoming\|outgoing\|all` (default `all`). |
| PATCH  | `/:id`        | Privada | Solo el `addresseeId` puede responder. Body `{"decision":"accept"\|"reject","responseMessage":null}`. |
| DELETE | `/:id`        | Privada | Solo el `requesterId` puede cancelar mientras siga `pending`.                          |

`accept` publica `ConnectionAcceptedEvent`. Una conexión resuelta (`accepted`, `rejected`, `cancelled`) no admite más transiciones.

## `/api/v1/messages`

| Método | Ruta                               | Auth     | Notas                                                                 |
|--------|------------------------------------|----------|-----------------------------------------------------------------------|
| GET    | `/`                                | Privada  | Inbox del `userId` de sesión.                                         |
| POST   | `/rooms`                           | Privada  | Abre sala desde `connectionId` o `applicationId` aceptados.           |
| GET    | `/rooms/:roomId/messages`          | Privada  | Historial paginado (hasta 100).                                       |
| POST   | `/rooms/:roomId/messages`          | Privada  | Envía mensaje (1–4000 chars).                                         |
| PATCH  | `/rooms/:roomId/delivered`         | Privada  | Marca entrega del recipiente actual.                                  |
| PATCH  | `/rooms/:roomId/read`              | Privada  | Marca leído del recipiente actual.                                    |
| GET    | `/rooms/:roomId/context`           | Privada  | Metadatos del interlocutor y origen.                                  |
| GET    | `/rooms/:roomId/events`            | Privada  | SSE: `message.created`, `message.delivered`, `message.read`.          |

## `/api/v1/notifications`

| Método | Ruta              | Auth    | Notas                                                                 |
|--------|-------------------|---------|-----------------------------------------------------------------------|
| GET    | `/`               | Privada | Lista con `unreadOnly`, `limit` (≤100), `offset`. Devuelve `unreadCount`. |
| PATCH  | `/:id/read`       | Privada | Marca leída. Solo el dueño.                                           |
| POST   | `/mark-all-read`  | Privada | Marca todas; devuelve `{ updated: N }`.                               |
| GET    | `/preferences`    | Privada | 8 tipos con defaults (`inApp: true, email: true`).                    |
| PUT    | `/preferences`    | Privada | Body `{"preferences":[{type,inApp,email}, …]}` hace upsert por tipo.  |

Eventos consumidos y notificación generada:

| Evento                       | Destinatario                 | Tipo generado         |
|------------------------------|------------------------------|-----------------------|
| `UserRegisteredEvent`        | `payload.userId`             | `system`              |
| `ConnectionAcceptedEvent`    | `payload.requesterId`        | `connection_accepted` |
| `ListingModeratedEvent`      | `host` del listing           | `listing_moderated`   |
| `MessageSentEvent`           | `payload.recipientId`        | `new_message`         |
| `SanctionIssuedEvent`        | `payload.userId`             | `account_sanction`    |

Los listeners corren in-process sobre `InProcessEventBus`; el bus delega siempre a `coreOutboxEvents` (persistencia garantizada). Un listener que falla no interrumpe la publicación.

## `/api/v1/moderation`

| Método | Ruta                                          | Auth    | Notas                                                                 |
|--------|-----------------------------------------------|---------|-----------------------------------------------------------------------|
| POST   | `/reports/listings/:listingId`                | Privada | Denuncia un anuncio (reason: `fraud`, `spam`, `inappropriate`, `other`). |
| POST   | `/reports/users/:userId`                      | Privada | Denuncia un usuario (reason del catálogo general).                    |
| POST   | `/reports/messages/:messageId`                | Privada | Denuncia un mensaje; el denunciante debe ser miembro de esa sala.     |
| GET    | `/admin/reports`                              | Admin   | Lista todas; filtros `?targetType=listing\|user\|message`, `?status=`. |
| PATCH  | `/admin/reports/:id`                          | Admin   | Resuelve con `{"status":"resolved"\|"dismissed"}`. Idempotente, rechaza doble resolución. |
| POST   | `/admin/queue/:listingId`                     | Admin   | Encola para revisión manual.                                          |
| GET    | `/admin/queue`                                | Admin   | Lista pendientes.                                                     |
| PATCH  | `/admin/queue/:listingId`                     | Admin   | `approved`, `rejected`, `removed`. Rechazo/baja ⇒ motivo.             |
| GET    | `/admin/history`                              | Admin   | Decisiones históricas.                                                |

Motivos generales (`reason`): `fraud`, `harassment`, `spam`, `inappropriate`, `fake_profile`, `other`.
Para denuncias de mensaje: `messageId` debe ser entero positivo y el denunciante tiene que ser miembro del `room` de ese mensaje.

## `/api/v1/sanctions`

Todas admin-only.

| Método | Ruta              | Auth    | Notas                                                                 |
|--------|-------------------|---------|-----------------------------------------------------------------------|
| POST   | `/`               | Admin   | Emite sanción. Body `{adminId (de sesión), userId?, listingId?, type, reason, expiresAt?, reportId?}`. |
| GET    | `/?userId=`       | Admin   | Lista sanciones históricas del usuario.                               |
| DELETE | `/:id`            | Admin   | Revoca (marca `expiresAt = now`). Rechaza si ya no estaba activa.     |

Tipos (`type`): `warning`, `temporary_suspension` (requiere `expiresAt` futuro), `permanent_ban`, `listing_removed`, `dismissed`.

**Integración con sesiones**: si un usuario tiene una sanción `temporary_suspension` o `permanent_ban` vigente, `AuthService.authenticate` devuelve `423 ACCOUNT_SANCTIONED` y las rutas privadas quedan bloqueadas hasta que la sanción caduque o sea revocada.

**Evento**: cada emisión publica `SanctionIssuedEvent`; notifications genera una entrada `account_sanction` para el usuario afectado.

## `/api/v1/agreements`

| Método | Ruta                 | Auth    | Notas                                                                             |
|--------|----------------------|---------|-----------------------------------------------------------------------------------|
| POST   | `/`                  | Privada | Crea acuerdo. Solo el host del listing. Body `{listingId, rules: {...}}`.         |
| GET    | `/:id`               | Privada | Detalle del acuerdo (incluye `rulesSnapshot` inmutable).                          |
| POST   | `/:id/accept`        | Privada | Firma. Solo el host o un applicant con status `accepted` del mismo listing.       |
| GET    | `/:id/acceptances`   | Privada | Lista aceptaciones. Solo el host.                                                 |

- Al crear se publica `AgreementCreatedEvent`.
- Cada aceptación nueva publica `AgreementAcceptedEvent` (idempotente: re-aceptar no vuelve a emitir).
- El `rulesSnapshot` se guarda como JSON inmutable; para cambiar reglas se crea otro acuerdo.

## `/api/v1/admin/analytics`

| Método | Ruta              | Auth    | Notas                                                                                     |
|--------|-------------------|---------|-------------------------------------------------------------------------------------------|
| POST   | `/recompute?date=YYYY-MM-DD` | Admin | Recalcula y UPSERT por `metricDate`. Idempotente. Rechaza fechas futuras.          |
| GET    | `/?from=YYYY-MM-DD&to=YYYY-MM-DD` | Admin | Métricas en rango. Devuelve `{ items: [{metricDate, usersRegistered, …}] }`. |

Métricas por día (UTC): `usersRegistered`, `activeListings`, `connectionsSent`, `connectionsAccepted`, `listingsClosed`, `avgDaysToClose`, `avgAffinityScore`.

**Operación**: ejecutar `POST /recompute` desde un cron diario externo (p.ej. GitHub Actions schedule, systemd timer o crontab del host) apuntando al día anterior.

## `/api/v1/admin/activity-log`

| Método | Ruta  | Auth  | Notas                                                                                     |
|--------|-------|-------|-------------------------------------------------------------------------------------------|
| GET    | `/`   | Admin | Query: `userId`, `action`, `from`, `to` (ISO), `limit` (≤500), `offset`. Devuelve `{items, total}`. |

Cada evento publicado al bus se persiste como una fila en `mod_activity_log` con `action = event.type` y `metadata = payload`. La fuente del actor es, en orden: `payload.userId` → `payload.actorId` → `payload.adminId` → `null`.

Eventos cubiertos actualmente: `UserRegisteredEvent`, `LoginSucceededEvent`, `LoginFailedEvent` (con `reason`: `user_not_found`, `locked`, `inactive`, `invalid_password`), `ConnectionAcceptedEvent`, `ListingModeratedEvent`, `MessageSentEvent`, `SanctionIssuedEvent`. Cualquier evento futuro aparece automáticamente sin tocar código del logger.

## Sistema

| Método | Ruta       | Auth    | Descripción                                   |
|--------|------------|---------|-----------------------------------------------|
| GET    | `/health`  | Pública | Liveness. Siempre 200 si el proceso corre.    |
| GET    | `/ready`   | Pública | Readiness. 200 si MySQL responde, 503 si no.  |

---

## Convenciones de seguridad

- **Nunca** en respuesta: `passwordHash`, `tokenHash`, `secret`, hashes de reset, hashes de sesión, o cualquier clave terminada en `Hash`. Verificado por `tests/unit/hardening.unit.test.ts`, que recorre las respuestas de login, `/me`, notifications, health y errores anónimos.
- `token` (de sesión del cliente) sí se devuelve en login/OAuth: es el valor que el frontend usa como Bearer, no el hash guardado en server.
- **Cabeceras de seguridad transversales** aplicadas a toda respuesta (RNF-05.1): `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Cookies de sesión: `HttpOnly; Secure (prod); SameSite=Strict`.
- CORS: solo `FRONTEND_ORIGIN` (default `http://localhost:8081`) y `http://127.0.0.1:8081`.
- Códigos de error estandarizados: `AUTH_REQUIRED`, `INVALID_SESSION`, `ADMIN_REQUIRED`, `FORBIDDEN`, `TERMS_REQUIRED`, `WEAK_PASSWORD`, `EMAIL_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ACCOUNT_INACTIVE`, `INVALID_RESET_TOKEN`, `CHAT_ORIGIN_REQUIRED`, `CHAT_ORIGIN_NOT_AUTHORIZED`, `CHAT_ACCESS_DENIED`, `INVALID_MESSAGE_BODY`, `INVALID_LIMIT`, `INVALID_REPORT_REASON`, `LISTING_NOT_FOUND`, `SELF_REPORT_NOT_ALLOWED`, `DUPLICATE_REPORT`, `REPORT_DESCRIPTION_TOO_LONG`, `INVALID_REVIEW_DECISION`, `REVIEW_REASON_REQUIRED`.
