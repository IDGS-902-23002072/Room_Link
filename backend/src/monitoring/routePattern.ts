const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_ID = /^[A-Za-z0-9_-]{20,}$/;
const NUMERIC_ID = /^\d+$/;

/**
 * Sustituye cualquier identificador del camino por `:id`. Nunca se guarda la
 * URL original: solo el patrón, como exige el SLA (fuente F1).
 */
export function toRoutePattern(path: string): string {
  const clean = path.split("?")[0] ?? "/";
  const segments = clean.split("/").map((segment) => {
    if (!segment) return segment;
    if (UUID.test(segment) || LONG_ID.test(segment) || NUMERIC_ID.test(segment)) return ":id";
    return segment;
  });
  return segments.join("/") || "/";
}

export function shouldExclude(method: string, path: string): boolean {
  if (method.toUpperCase() === "OPTIONS") return true;
  if (path === "/health" || path.startsWith("/health/")) return true;
  if (path === "/ready" || path.startsWith("/ready/")) return true;
  if (path.startsWith("/uploads")) return true;
  // SSE de mensajería: es un stream, no una transacción del SLA.
  return /^\/api\/v1\/messages\/rooms\/[^/]+\/events$/.test(path);
}

export type EventSource = "real" | "test" | "synthetic";

export function parseSource(value: string | undefined): EventSource {
  return value === "test" || value === "synthetic" ? value : "real";
}
