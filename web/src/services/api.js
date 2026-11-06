const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
)

export async function apiRequest(path, { token, ...options } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    throw new Error(
      `No se pudo conectar con RoomLink API: ${error instanceof Error ? error.message : 'error de red'}`,
    )
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      body?.error || `La API respondió con estado ${response.status}.`,
    )
  }
  if (body === null) {
    throw new Error('La API devolvió una respuesta vacía o inválida.')
  }
  return body
}
