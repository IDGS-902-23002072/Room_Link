const defaultBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export async function apiRequest(path, { method = "GET", token, body, baseUrl = defaultBaseUrl } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: "include",
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error ?? "No fue posible completar la solicitud.");
    error.code = payload.code ?? "API_ERROR";
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function readableError(error) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}
