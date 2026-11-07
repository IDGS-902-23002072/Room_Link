# Postman — Room_Link Backend

## Importar

1. Postman → **Import** → arrastra `room-link.postman_collection.json`.
2. Se crea la colección **Room_Link Backend** con variables al nivel de colección (no requiere Environment aparte).
3. Ajustá la variable `base` si no usás `http://localhost:3000`.

## Flujo típico

1. **Auth > POST /auth/register** o **POST /auth/login** — el *test script* guarda `token` automáticamente en la colección.
2. Cualquier otra request usa `Authorization: Bearer {{token}}` por herencia.
3. Para rutas admin, ejecutá primero el login con un usuario de rol `admin` (seedeado o creado manualmente desde la DB).
4. Las variables `listingId`, `connectionId`, `roomId`, `applicationId`, `agreementId`, `reportId`, `sanctionId`, `userId`, `messageId`, `notificationId` se setean a mano con los ids que devuelve cada creación (o agregando `pm.collectionVariables.set(...)` en los Tests de cada request).

## Convenciones

- Rutas **públicas**: `/health`, `/ready`, `GET /rooms`, `GET /rooms/:id`, `GET /rooms/host/:hostId`, `GET /rooms/:id/photos/:photoId`, y las de registro/login/OAuth/reset. Están marcadas con `auth: noauth` dentro de la colección.
- Rutas **admin**: requieren que el `token` sea de un usuario con rol `admin`.
- Rutas con **`:userId` self/admin** (compatibility): solo el dueño o admin.
- SSE: `GET /messages/rooms/:roomId/events` abre un stream; Postman lo muestra como `text/event-stream`.

## Mapa de carpetas → módulos

| Carpeta Postman | Módulo del backend |
|---|---|
| System | `/health`, `/ready` |
| Auth | `src/modules/auth` |
| Profile | `src/modules/profile` |
| Rooms | `src/modules/rooms` |
| Applications | `src/modules/applications` |
| Compatibility | `src/modules/compatibility` |
| Connections | `src/modules/connections` (F2) |
| Messaging | `src/modules/messaging` |
| Agreements | `src/modules/agreements` (F7) |
| Notifications | `src/modules/notifications` (F3) |
| Moderation | `src/modules/moderation` (ampliado F4) |
| Sanctions (admin) | `src/modules/sanctions` (F5) |
| Admin · Activity log | `src/modules/activity-log` (F6) |
| Admin · Analytics | `src/modules/analytics` (F8) |

Contrato completo en [`docs/api.md`](../api.md).
