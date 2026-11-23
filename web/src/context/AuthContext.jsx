import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from './auth-context.js'
import { apiRequest } from '../services/api.js'
import { clearSession, readSession, requestAuth, saveSession, startSession } from '../services/authService.js'

function getStoredSession() {
  try {
    return readSession()
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getStoredSession)
  const [loadingSession, setLoadingSession] = useState(Boolean(session))
  const [sessionError, setSessionError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const stored = getStoredSession()
    if (!stored) return
    const request = new AbortController()
    apiRequest('/api/v1/auth/me', { token: stored.token, signal: request.signal }).then((user) => {
      if (request.signal.aborted) return
      setSession((current) => current?.token === stored.token ? { ...current, user } : current)
    }).catch((error) => {
      if (request.signal.aborted) return
      if (error.status === 401 || error.status === 423) {
        if (getStoredSession()?.token === stored.token) clearSession()
        setSession((current) => current?.token === stored.token ? null : current)
        return
      }
      setSessionError(error.message)
    }).finally(() => {
      if (!request.signal.aborted) setLoadingSession(false)
    })
    return () => request.abort()
  }, [attempt])

  const value = useMemo(() => {
    function forgetSession() {
      setSession(null)
      setSessionError('')
      clearSession()
    }

    return {
      session,
      loadingSession,
      sessionError,
      forgetSession,
      retrySession() {
        setSessionError('')
        setLoadingSession(Boolean(getStoredSession()))
        setAttempt((value) => value + 1)
      },
      async authenticate(path, credentials) {
        const next = await startSession(path, credentials)
        saveSession(next)
        setSessionError('')
        setSession(next)
        return next.user
      },
      async becomeHost(acceptedTerms) {
        if (!session) throw new Error('Inicia sesión para continuar.')
        await requestAuth('become-host', { acceptedTerms }, session.token)
        const user = await apiRequest('/api/v1/auth/me', { token: session.token })
        if (!user.roles?.includes('host')) {
          throw new Error('RoomLink no confirmó el rol de arrendador.')
        }
        const current = getStoredSession()
        if (current?.token !== session.token) return
        const next = { ...current, user }
        saveSession(next)
        setSession(next)
      },
      async logout() {
        if (!session) return
        try {
          await requestAuth('logout', undefined, session.token)
        } finally {
          forgetSession()
        }
      },
    }
  }, [session, loadingSession, sessionError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
