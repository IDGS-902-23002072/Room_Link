# Catálogo de SLI de Room_Link

Fórmulas, umbrales, SLO y periodos tomados de las secciones 7 y 8 del SLA (`IDGS1002 Proyecto 2.1 Omar Cordero.pdf`, páginas 11-28). Las rutas se verificaron en `backend/src/app.ts` y `backend/src/modules/*/*.routes.ts`. Los umbrales expresados en días, horas o minutos se convierten a milisegundos de forma equivalente, sin cambiar el valor del SLA.

| ID | Módulo | Tipo (tx/case/test/platform) | Umbral ms | SLO % | Método | Patrón de ruta real del backend | Estado |
|---|---|---|---|---|---|---|---|
| 1.1 | M1 · Autenticación | tx | 3000 | 95 | F1 | `/api/v1/auth/register` | ruta verificada en el backend |
| 1.2 | M1 · Autenticación | tx | 2000 | 95 | F1 | `/api/v1/auth/login` | ruta verificada en el backend |
| 1.3 | M1 · Autenticación | tx | 2000 | 95 | F1 | `/api/v1/auth/me` | ruta verificada en el backend |
| 1.4 | M1 · Autenticación | tx | 3000 | 90 | F1 | sin dato | sin ruta: baja de cuenta no implementada |
| 1.5 | M1 · Autenticación | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 2.1 | M2 · Perfil personal | tx | 3000 | 95 | F1 | `/api/v1/profiles` | ruta verificada en el backend |
| 2.2 | M2 · Perfil personal | tx | 2000 | 95 | F1 | `/api/v1/profiles/:userId` | ruta verificada en el backend |
| 2.3 | M2 · Perfil personal | tx | 3000 | 95 | F1 | `/api/v1/profiles/:userId` | ruta verificada en el backend |
| 2.4 | M2 · Perfil personal | tx | 8000 | 90 | F1 | `/api/v1/profiles/:userId/photos` | ruta verificada en el backend |
| 2.5 | M2 · Perfil personal | tx | 3000 | 90 | F1 | `/api/v1/profiles/:userId/photos/:photoId` | ruta verificada en el backend |
| 2.6 | M2 · Perfil personal | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 3.1 | M3 · Test de convivencia | tx | 3000 | 95 | F1 | `/api/v1/compatibility/:userId` | ruta verificada en el backend |
| 3.2 | M3 · Test de convivencia | tx | 2000 | 95 | F1 | `/api/v1/compatibility/:userId` | ruta verificada en el backend |
| 3.3 | M3 · Test de convivencia | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 4.1 | M4 · Motor de afinidades (feed) | tx | 2000 | 95 | F1 | `/api/v1/compatibility/:userId/feed` | ruta verificada en el backend |
| 4.2 | M4 · Motor de afinidades (feed) | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 5.1 | M5 · Búsqueda y filtros | tx | 3000 | 90 | F1 | `/api/v1/search/profiles` | ruta verificada en el backend |
| 5.2 | M5 · Búsqueda y filtros | tx | 3000 | 90 | F1 | `/api/v1/search/listings` | ruta verificada en el backend |
| 5.3 | M5 · Búsqueda y filtros | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 6.1 | M6 · Geolocalización | tx | 5000 | 90 | F1 | `/api/v1/geolocation/search` | ruta verificada; la geocodificación depende de proveedor externo |
| 6.2 | M6 · Geolocalización | tx | 3000 | 90 | F1 | `/api/v1/geolocation/rooms/:id/nearby` | ruta verificada en el backend |
| 6.3 | M6 · Geolocalización | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 7.1 | M7 · Publicación de habitaciones | tx | 3000 | 95 | F1 | `/api/v1/rooms` | ruta verificada en el backend |
| 7.2 | M7 · Publicación de habitaciones | tx | 2000 | 95 | F1 | `/api/v1/rooms` | ruta verificada en el backend |
| 7.3 | M7 · Publicación de habitaciones | tx | 2000 | 95 | F1 | `/api/v1/rooms/:id` | ruta verificada en el backend |
| 7.4 | M7 · Publicación de habitaciones | tx | 3000 | 95 | F1 | `/api/v1/rooms/:id/publish` | ruta verificada en el backend |
| 7.5 | M7 · Publicación de habitaciones | tx | 3000 | 90 | F1 | `/api/v1/rooms/:id` | ruta verificada en el backend |
| 7.6 | M7 · Publicación de habitaciones | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 8.1 | M8 · Reglas y finanzas | tx | 3000 | 90 | F1 | `/api/v1/rooms/:id/rules; /api/v1/rooms/:id/costs` | ruta verificada en el backend |
| 8.2 | M8 · Reglas y finanzas | tx | 2000 | 90 | F1 | `/api/v1/rooms/:id/rules; /api/v1/rooms/:id/costs` | ruta verificada en el backend |
| 8.3 | M8 · Reglas y finanzas | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 9.1 | M9 · Postulaciones | tx | 3000 | 95 | F1 | `/api/v1/applications` | ruta verificada en el backend |
| 9.2 | M9 · Postulaciones | tx | 2000 | 95 | F1 | `/api/v1/applications/listing/:listingId` | ruta verificada en el backend |
| 9.3 | M9 · Postulaciones | tx | 3000 | 95 | F1 | `/api/v1/applications/:id/decide` | ruta verificada en el backend |
| 9.4 | M9 · Postulaciones | tx | 2000 | 90 | F1 | `/api/v1/applications/me` | ruta verificada en el backend |
| 9.5 | M9 · Postulaciones | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 10.1 | M10 · Mensajería interna | tx | 2000 | 95 | F1 | `/api/v1/messages/rooms/:roomId/messages` | ruta verificada en el backend |
| 10.2 | M10 · Mensajería interna | tx | 2000 | 95 | F1 | `/api/v1/messages/rooms/:roomId/messages` | ruta verificada en el backend |
| 10.3 | M10 · Mensajería interna | tx | 2000 | 90 | F1 | `/api/v1/messages` | ruta verificada en el backend |
| 10.4 | M10 · Mensajería interna | case | 2000 | 90 | F4 | N/A (F4 · `chat_messages.sent_at` / `delivered_at`) | caso de entrega medido con tabla real; sin ruta HTTP |
| 10.5 | M10 · Mensajería interna | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 11.1 | M11 · Solicitudes de conexión | tx | 3000 | 95 | F1 | `/api/v1/connections` | ruta verificada en el backend |
| 11.2 | M11 · Solicitudes de conexión | tx | 3000 | 95 | F1 | `/api/v1/connections/:id` | ruta verificada en el backend |
| 11.3 | M11 · Solicitudes de conexión | tx | 2000 | 90 | F1 | `/api/v1/connections` | ruta verificada en el backend |
| 11.4 | M11 · Solicitudes de conexión | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 12.1 | M12 · Acuerdos de convivencia | tx | 3000 | 90 | F1 | `/api/v1/agreements` | ruta verificada en el backend |
| 12.2 | M12 · Acuerdos de convivencia | tx | 3000 | 90 | F1 | `/api/v1/agreements/:agreementId/accept` | ruta verificada en el backend |
| 12.3 | M12 · Acuerdos de convivencia | tx | 2000 | 90 | F1 | `/api/v1/agreements/by-user/:userId` | ruta verificada en el backend |
| 12.4 | M12 · Acuerdos de convivencia | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 13.1 | M13 · Moderación | tx | 3000 | 90 | F1 | `/api/v1/moderation/reports/listings/:listingId; /api/v1/moderation/reports/users/:userId; /api/v1/moderation/reports/messages/:messageId` | ruta verificada en el backend |
| 13.2 | M13 · Moderación | tx | 3000 | 90 | F1 | `/api/v1/moderation/admin/reports` | ruta verificada en el backend |
| 13.3 | M13 · Moderación | tx | 3000 | 90 | F1 | `/api/v1/sanctions` | ruta verificada en el backend |
| 13.4 | M13 · Moderación | case | 259200000 | 80 | F4 | N/A (F4 · `mod_reports.created_at` / `resolved_at`) | caso de atención medido con tabla real; 259200000 ms equivalen a 3 días |
| 13.5 | M13 · Moderación | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 14.1 | M14 · Notificaciones | tx | 2000 | 90 | F1 | `/api/v1/notifications` | ruta verificada en el backend |
| 14.2 | M14 · Notificaciones | tx | 2000 | 90 | F1 | `/api/v1/notifications/:id/read; /api/v1/notifications/mark-all-read` | ruta verificada en el backend |
| 14.3 | M14 · Notificaciones | case | 60000 | 90 | F4 | N/A (F4 · `notif_notifications.created_at`) | caso de aviso medido con tabla real; 60000 ms equivalen a 1 minuto |
| 14.4 | M14 · Notificaciones | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| 15.1 | M15 · Dashboard de métricas | tx | 5000 | 90 | F1 | `/api/v1/admin/analytics` | ruta verificada en el backend |
| 15.2 | M15 · Dashboard de métricas | tx | 5000 | 90 | F1 | `/api/v1/admin/analytics` | ruta verificada; gráficas mensuales con el rango de fechas del controlador |
| 15.3 | M15 · Dashboard de métricas | test | N/A | 90 | F3 | N/A (F3) | sin ruta HTTP; se mide con la última corrida de pruebas del mes |
| T.1 | Plataforma completa | platform | N/A | 95 | F2 | `/ready` | ruta real del monitor cada minuto; no existe `/api/v1/ready` |
| T.2 | Plataforma completa | platform | 43200000 | N/A (≤ 12 h) | F2 | `/ready` | racha derivada del monitor F2; 43200000 ms equivalen a 12 h; el SLA no da porcentaje |
| T.3 | Plataforma completa | tx | 3000 | 95 | F1 | `/api/v1/*` | patrón global de la API; F1 registra cualquier petición |
| T.4 | Plataforma completa | platform | N/A | 90 | F5 | sin dato | sin ruta: respaldo diario de la base de datos, evidencia F5; no expone HTTP |
| T.5 | Plataforma completa | platform | N/A | 90 | F6 | sin dato | sin ruta: incidentes y primera respuesta se registran en issues de GitHub (F6) |
| T.6 | Plataforma completa | platform | N/A | 80 | F6 | sin dato | sin ruta: reporte mensual entregado por correo; no hay ruta en el backend |

## SLI sin ruta

- **1.4** — sin ruta: baja de cuenta no implementada. `auth.routes.ts` no registra ninguna ruta de eliminación de cuenta; solo registro, inicio de sesión, OAuth, contraseña, sesión, cierre de sesión y cambio a arrendador.
- **T.4** — sin ruta: respaldo diario de la base de datos. La evidencia es el registro de respaldos (F5), no un endpoint HTTP del backend.
- **T.5** — sin ruta: primera respuesta a incidentes. Los incidentes y sus fechas se registran como issues de GitHub (F6), fuera de la API.
- **T.6** — sin ruta: reporte mensual entregado. Se entrega por correo al representante del cliente; no existe una ruta en el backend que lo exponga.

Los SLI `test` usan `N/A (F3)` y los SLI `case` usan `N/A (F4 ...)` porque no son peticiones HTTP: se miden con pruebas Vitest o con tablas reales de la base de datos. T.1 y T.2 sí tienen ruta real (`/ready`, F2).

## Reglas de medición aplicadas

Reglas generales de la sección 8, textuales:

- Periodo de cada SLO: un mes calendario completo, del día 1 a las 00:00 al último día del mes a las 23:59:59, hora de (León, Guanajuato, UTC-6). No es un periodo fijo de 30 días: los meses duran entre 28 y 31 días y cada uno se evalúa por separado, sin arrastrar el resultado del anterior. El primer periodo es diciembre de 2026 y el último, mayo de 2027 (6 periodos).
- Pruebas automáticas: los SLI de reglas se calculan con la última corrida completa de pruebas del mes.
- Qué se cuenta: solo la actividad real de usuarios. Se excluyen las cuentas de prueba, los mantenimientos avisados y los casos de la sección 11.
- Tx buena: la que el sistema atiende sin error del servidor (status menor a 500) y dentro del tiempo del SLI. Un rechazo esperado (por ejemplo, contraseña incorrecta o falta de permiso) también es buena.
- Pocas tx: si un SLI tiene menos de 30 tx en el mes, se evalúa con el acumulado de los 3 meses más recientes.
- Redondeo: los resultados se muestran con 1 decimal y se truncan, no se redondean hacia arriba.

Fuentes de datos de la sección 8, textuales:

- F1 Bitácora de peticiones de la API: Registro que el servidor guarda por cada petición: fecha y hora, método, ruta, status (resultado) y duración en milisegundos. Se exporta a CSV al cerrar el mes. Se conserva 90 días.
- F2 Monitor de disponibilidad: Un servicio gratuito de monitoreo consulta GET /ready cada minuto y guarda si respondió bien o no, con la fecha y hora.
- F3 Pruebas automáticas: Resultado de las pruebas Vitest que corre GitHub Actions en cada versión. Cada prueba sale aprobada o fallida y el reporte queda guardado.
- F4 Base de datos: Tablas del sistema con fechas de creación y proceso (por ejemplo chat_messages, mod_reports, core_outbox_events). El cliente consulta con un usuario de solo lectura.
- F5 Registro de respaldos: Archivo con la fecha, el tamaño y el resultado de cada respaldo diario.
- F6 Issues de GitHub: Incidentes y entregables con su fecha de apertura, primera respuesta y cierre.
