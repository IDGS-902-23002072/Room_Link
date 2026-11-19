import PropTypes from 'prop-types'
import { useMemo, useReducer } from 'react'
import { AuthContext } from './auth-context.js'
import {
  clearSession,
  login as iniciarSesion,
  readSession,
  saveSession,
} from '../services/authService.js'

function authReducer(state, action) {
  switch (action.type) {
    case 'login':
      return { session: action.session, error: '' }
    case 'logout':
      return { session: null, error: '' }
    case 'error':
      return { ...state, error: action.message }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, null, () => {
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

  const value = useMemo(
    () => ({
      session: state.session,
      loadingSession: false,
      sessionError: state.error,
      async login(email, password) {
        const nextSession = await iniciarSesion(email, password)
        saveSession(nextSession)
        dispatch({ type: 'login', session: nextSession })
        return nextSession.user
      },
      logout() {
        clearSession()
        dispatch({ type: 'logout' })
      },
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
