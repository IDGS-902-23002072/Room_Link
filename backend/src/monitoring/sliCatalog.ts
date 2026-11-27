export interface SliDefinition {
  id: string;
  module: string;
  type: "tx" | "case" | "test" | "platform";
  thresholdMs: number | null;
  sloPercent: number | null;
  method: string;
  routePattern: string | null;
}

/** Generado desde docs/sli-catalog.md. No editar a mano: los valores vienen del SLA. */
export const SLI_CATALOG: SliDefinition[] = [
  { id: "1.1", module: "M1 · Autenticación", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/auth/register" },
  { id: "1.2", module: "M1 · Autenticación", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/auth/login" },
  { id: "1.3", module: "M1 · Autenticación", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/auth/me" },
  { id: "1.4", module: "M1 · Autenticación", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: null },
  { id: "1.5", module: "M1 · Autenticación", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "2.1", module: "M2 · Perfil personal", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/profiles" },
  { id: "2.2", module: "M2 · Perfil personal", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/profiles/:userId" },
  { id: "2.3", module: "M2 · Perfil personal", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/profiles/:userId" },
  { id: "2.4", module: "M2 · Perfil personal", type: "tx", thresholdMs: 8000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/profiles/:userId/photos" },
  { id: "2.5", module: "M2 · Perfil personal", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/profiles/:userId/photos/:photoId" },
  { id: "2.6", module: "M2 · Perfil personal", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "3.1", module: "M3 · Test de convivencia", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/compatibility/:userId" },
  { id: "3.2", module: "M3 · Test de convivencia", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/compatibility/:userId" },
  { id: "3.3", module: "M3 · Test de convivencia", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "4.1", module: "M4 · Motor de afinidades (feed)", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/compatibility/:userId/feed" },
  { id: "4.2", module: "M4 · Motor de afinidades (feed)", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "5.1", module: "M5 · Búsqueda y filtros", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/search/profiles" },
  { id: "5.2", module: "M5 · Búsqueda y filtros", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/search/listings" },
  { id: "5.3", module: "M5 · Búsqueda y filtros", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "6.1", module: "M6 · Geolocalización", type: "tx", thresholdMs: 5000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/geolocation/search" },
  { id: "6.2", module: "M6 · Geolocalización", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/geolocation/rooms/:id/nearby" },
  { id: "6.3", module: "M6 · Geolocalización", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "7.1", module: "M7 · Publicación de habitaciones", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/rooms" },
  { id: "7.2", module: "M7 · Publicación de habitaciones", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/rooms" },
  { id: "7.3", module: "M7 · Publicación de habitaciones", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/rooms/:id" },
  { id: "7.4", module: "M7 · Publicación de habitaciones", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/rooms/:id/publish" },
  { id: "7.5", module: "M7 · Publicación de habitaciones", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/rooms/:id" },
  { id: "7.6", module: "M7 · Publicación de habitaciones", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "8.1", module: "M8 · Reglas y finanzas", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "`/api/v1/rooms/:id/rules" },
  { id: "8.2", module: "M8 · Reglas y finanzas", type: "tx", thresholdMs: 2000, sloPercent: 90.0, method: "F1", routePattern: "`/api/v1/rooms/:id/rules" },
  { id: "8.3", module: "M8 · Reglas y finanzas", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "9.1", module: "M9 · Postulaciones", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/applications" },
  { id: "9.2", module: "M9 · Postulaciones", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/applications/listing/:listingId" },
  { id: "9.3", module: "M9 · Postulaciones", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/applications/:id/decide" },
  { id: "9.4", module: "M9 · Postulaciones", type: "tx", thresholdMs: 2000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/applications/me" },
  { id: "9.5", module: "M9 · Postulaciones", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "10.1", module: "M10 · Mensajería interna", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/messages/rooms/:roomId/messages" },
  { id: "10.2", module: "M10 · Mensajería interna", type: "tx", thresholdMs: 2000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/messages/rooms/:roomId/messages" },
  { id: "10.3", module: "M10 · Mensajería interna", type: "tx", thresholdMs: 2000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/messages" },
  { id: "10.4", module: "M10 · Mensajería interna", type: "case", thresholdMs: 2000, sloPercent: 90.0, method: "F4", routePattern: "N/A (F4 · `chat_messages.sent_at` / `delivered_at`)" },
  { id: "10.5", module: "M10 · Mensajería interna", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "11.1", module: "M11 · Solicitudes de conexión", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/connections" },
  { id: "11.2", module: "M11 · Solicitudes de conexión", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/connections/:id" },
  { id: "11.3", module: "M11 · Solicitudes de conexión", type: "tx", thresholdMs: 2000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/connections" },
  { id: "11.4", module: "M11 · Solicitudes de conexión", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "12.1", module: "M12 · Acuerdos de convivencia", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/agreements" },
  { id: "12.2", module: "M12 · Acuerdos de convivencia", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/agreements/:agreementId/accept" },
  { id: "12.3", module: "M12 · Acuerdos de convivencia", type: "tx", thresholdMs: 2000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/agreements/by-user/:userId" },
  { id: "12.4", module: "M12 · Acuerdos de convivencia", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "13.1", module: "M13 · Moderación", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "`/api/v1/moderation/reports/listings/:listingId" },
  { id: "13.2", module: "M13 · Moderación", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/moderation/admin/reports" },
  { id: "13.3", module: "M13 · Moderación", type: "tx", thresholdMs: 3000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/sanctions" },
  { id: "13.4", module: "M13 · Moderación", type: "case", thresholdMs: 259200000, sloPercent: 80.0, method: "F4", routePattern: "N/A (F4 · `mod_reports.created_at` / `resolved_at`)" },
  { id: "13.5", module: "M13 · Moderación", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "14.1", module: "M14 · Notificaciones", type: "tx", thresholdMs: 2000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/notifications" },
  { id: "14.2", module: "M14 · Notificaciones", type: "tx", thresholdMs: 2000, sloPercent: 90.0, method: "F1", routePattern: "`/api/v1/notifications/:id/read" },
  { id: "14.3", module: "M14 · Notificaciones", type: "case", thresholdMs: 60000, sloPercent: 90.0, method: "F4", routePattern: "N/A (F4 · `notif_notifications.created_at`)" },
  { id: "14.4", module: "M14 · Notificaciones", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "15.1", module: "M15 · Dashboard de métricas", type: "tx", thresholdMs: 5000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/admin/analytics" },
  { id: "15.2", module: "M15 · Dashboard de métricas", type: "tx", thresholdMs: 5000, sloPercent: 90.0, method: "F1", routePattern: "/api/v1/admin/analytics" },
  { id: "15.3", module: "M15 · Dashboard de métricas", type: "test", thresholdMs: null, sloPercent: 90.0, method: "F3", routePattern: null },
  { id: "T.1", module: "Plataforma completa", type: "platform", thresholdMs: null, sloPercent: 95.0, method: "F2", routePattern: "/ready" },
  { id: "T.2", module: "Plataforma completa", type: "platform", thresholdMs: 43200000, sloPercent: null, method: "F2", routePattern: "/ready" },
  { id: "T.3", module: "Plataforma completa", type: "tx", thresholdMs: 3000, sloPercent: 95.0, method: "F1", routePattern: "/api/v1/*" },
  { id: "T.4", module: "Plataforma completa", type: "platform", thresholdMs: null, sloPercent: 90.0, method: "F5", routePattern: null },
  { id: "T.5", module: "Plataforma completa", type: "platform", thresholdMs: null, sloPercent: 90.0, method: "F6", routePattern: null },
  { id: "T.6", module: "Plataforma completa", type: "platform", thresholdMs: null, sloPercent: 80.0, method: "F6", routePattern: null },
];

export const SLI_BY_ID = new Map(SLI_CATALOG.map((sli) => [sli.id, sli]));

/** Asociación explícita método + patrón → SLI, verificada contra las rutas reales. */
const ROUTE_SLI_MAP: Array<{ method: string; pattern: string; sliId: string }> = [
  { method: "POST", pattern: "/api/v1/auth/register", sliId: "1.1" },
  { method: "POST", pattern: "/api/v1/auth/login", sliId: "1.2" },
  { method: "GET", pattern: "/api/v1/auth/me", sliId: "1.3" },
  { method: "POST", pattern: "/api/v1/profiles", sliId: "2.1" },
  { method: "GET", pattern: "/api/v1/profiles/:userId", sliId: "2.2" },
  { method: "PUT", pattern: "/api/v1/profiles/:userId", sliId: "2.3" },
  { method: "POST", pattern: "/api/v1/profiles/:userId/photos", sliId: "2.4" },
  { method: "DELETE", pattern: "/api/v1/profiles/:userId/photos/:photoId", sliId: "2.5" },
  { method: "PUT", pattern: "/api/v1/compatibility/:userId", sliId: "3.1" },
  { method: "GET", pattern: "/api/v1/compatibility/:userId", sliId: "3.2" },
  { method: "GET", pattern: "/api/v1/compatibility/:userId/feed", sliId: "4.1" },
  { method: "GET", pattern: "/api/v1/search/profiles", sliId: "5.1" },
  { method: "GET", pattern: "/api/v1/search/listings", sliId: "5.2" },
  { method: "GET", pattern: "/api/v1/geolocation/search", sliId: "6.1" },
  { method: "GET", pattern: "/api/v1/geolocation/rooms/:id/nearby", sliId: "6.2" },
  { method: "POST", pattern: "/api/v1/rooms", sliId: "7.1" },
  { method: "GET", pattern: "/api/v1/rooms", sliId: "7.2" },
  { method: "GET", pattern: "/api/v1/rooms/feed", sliId: "7.2" },
  { method: "GET", pattern: "/api/v1/rooms/:id", sliId: "7.3" },
  { method: "PATCH", pattern: "/api/v1/rooms/:id/publish", sliId: "7.4" },
  { method: "PATCH", pattern: "/api/v1/rooms/:id", sliId: "7.5" },
  { method: "GET", pattern: "/api/v1/rooms/:id/rules", sliId: "8.2" },
  { method: "GET", pattern: "/api/v1/rooms/:id/costs", sliId: "8.2" },
  { method: "PUT", pattern: "/api/v1/rooms/:id/rules", sliId: "8.1" },
  { method: "PUT", pattern: "/api/v1/rooms/:id/costs", sliId: "8.1" },
  { method: "POST", pattern: "/api/v1/applications", sliId: "9.1" },
  { method: "GET", pattern: "/api/v1/applications/listing/:listingId", sliId: "9.2" },
  { method: "PATCH", pattern: "/api/v1/applications/:id/decide", sliId: "9.3" },
  { method: "GET", pattern: "/api/v1/applications/me", sliId: "9.4" },
  { method: "POST", pattern: "/api/v1/messages/rooms/:roomId/messages", sliId: "10.1" },
  { method: "GET", pattern: "/api/v1/messages/rooms/:roomId/messages", sliId: "10.2" },
  { method: "GET", pattern: "/api/v1/messages", sliId: "10.3" },
  { method: "POST", pattern: "/api/v1/connections", sliId: "11.1" },
  { method: "PATCH", pattern: "/api/v1/connections/:id", sliId: "11.2" },
  { method: "DELETE", pattern: "/api/v1/connections/:id", sliId: "11.2" },
  { method: "GET", pattern: "/api/v1/connections", sliId: "11.3" },
  { method: "POST", pattern: "/api/v1/agreements", sliId: "12.1" },
  { method: "POST", pattern: "/api/v1/agreements/:agreementId/accept", sliId: "12.2" },
  { method: "GET", pattern: "/api/v1/agreements/:agreementId", sliId: "12.3" },
  { method: "POST", pattern: "/api/v1/moderation/reports/listings/:listingId", sliId: "13.1" },
  { method: "POST", pattern: "/api/v1/moderation/reports/users/:userId", sliId: "13.1" },
  { method: "GET", pattern: "/api/v1/moderation/admin/reports", sliId: "13.2" },
  { method: "POST", pattern: "/api/v1/sanctions", sliId: "13.3" },
  { method: "GET", pattern: "/api/v1/notifications", sliId: "14.1" },
  { method: "PATCH", pattern: "/api/v1/notifications/:id/read", sliId: "14.2" },
  { method: "GET", pattern: "/api/v1/admin/analytics", sliId: "15.1" },
];

export const findSliByRoute = (method: string, path: string): SliDefinition | null => {
  const normalized = method.toUpperCase();
  const match = ROUTE_SLI_MAP.find(
    (entry) => entry.method === normalized && matchesPattern(path, entry.pattern),
  );
  if (match) return SLI_BY_ID.get(match.sliId) ?? null;
  // T.3 cubre cualquier petición a la API sin SLI específico.
  if (path.startsWith("/api/v1/")) return SLI_BY_ID.get("T.3") ?? null;
  return null;
};

function matchesPattern(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("^" + escaped.replace(/:[A-Za-z0-9_]+/g, "[^/]+") + "$");
  return regex.test(path);
}
