export const API_URL = (import.meta.env?.VITE_API_URL ?? (import.meta.env?.PROD ? '' : 'http://localhost:3000')).replace(/\/+$/, '')

export function apiUrl(path) {
  return `${API_URL}${path}`
}

export function apiAssetUrl(path) {
  return new URL(path, API_URL || window.location.origin).href
}

export async function apiFetch(path, { token, accept = 'application/json', ...options } = {}) {
  let response
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        Accept: accept,
        ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new Error('No se pudo conectar con RoomLink. Revisa tu conexión e inténtalo de nuevo.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw Object.assign(new Error(body?.error || `La API respondió con estado ${response.status}.`), {
      status: response.status,
      code: body?.code,
    })
  }
  return response
}

export async function apiRequest(path, options) {
  const response = await apiFetch(path, options)
  if (response.status === 204) return null
  return response.json().catch(() => {
    throw new Error('La API devolvió una respuesta vacía o inválida.')
  })
}
