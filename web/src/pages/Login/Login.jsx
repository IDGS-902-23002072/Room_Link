import PropTypes from 'prop-types'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'

function Login({ onLogin }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      onLogin(user)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">ROOMLINK · BIENVENIDO</p>
        <h1>Encuentra tu lugar</h1>
        <p className="muted">
          Inicia sesión para descubrir perfiles compatibles y continuar tu test.
        </p>
        <label className="field">
          Correo electrónico
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="field">
          Contraseña
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-wide" disabled={submitting}>
          {submitting ? 'Conectando…' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}

Login.propTypes = {
  onLogin: PropTypes.func.isRequired,
}

export default Login
