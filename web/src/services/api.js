export const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(
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
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    throw new Error(
      `No se pudo conectar con RoomLink API: ${error instanceof Error ? error.message : 'error de red'}`,
    )
  }

  if (response.status === 204) return null
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(
      body?.error || `La API respondió con estado ${response.status}.`,
    )
    error.status = response.status
    throw error
  }
  if (body === null) {
    throw new Error('La API devolvió una respuesta vacía o inválida.')
  }
  return body
}
