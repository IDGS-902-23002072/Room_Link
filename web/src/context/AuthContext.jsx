import { useMemo, useState } from 'react'
import { AuthContext } from './auth-context.js'
import {
  clearSession,
  login as iniciarSesion,
  readSession,
  saveSession,
} from '../services/authService.js'

export function AuthProvider({ children }) {
  const [initialSession] = useState(() => {
    try {
      return { session: readSession(), error: '' }
    } catch (error) {
      return {
        session: null,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo recuperar la sesión.',
      }
    }
  })
  const [session, setSession] = useState(initialSession.session)
  const [sessionError, setSessionError] = useState(initialSession.error)

  const value = useMemo(
    () => ({
      session,
      loadingSession: false,
      sessionError,
      async login(email, password) {
        const nextSession = await iniciarSesion(email, password)
        saveSession(nextSession)
        setSession(nextSession)
        setSessionError('')
        return nextSession.user
      },
      logout() {
        clearSession()
        setSession(null)
      },
    }),
    [session, sessionError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
