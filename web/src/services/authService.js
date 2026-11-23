import { apiRequest } from './api.js'

const SESSION_KEY = '@roomlink/web/session'

export function requestAuth(path, body, token) {
  return apiRequest(`/api/v1/auth/${path}`, {
    token,
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function startSession(path, credentials) {
  const result = await requestAuth(path, credentials)
  if (!result.user?.id || !result.token) {
    throw new Error('La API no devolvió una sesión válida.')
  }
  return { user: result.user, token: result.token, expiresAt: result.expiresAt }
}

export function readSession() {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY)
    if (!stored) return null
    const session = JSON.parse(stored)
    return session?.user?.id && session?.token ? session : null
  } catch {
    throw new Error('No se pudo recuperar la sesión guardada en este navegador.')
  }
}

export function saveSession(session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    throw new Error('No se pudo guardar la sesión en este navegador.')
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    throw new Error('No se pudo cerrar la sesión guardada en este navegador.')
  }
}
