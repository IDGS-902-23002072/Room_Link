import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import interior from '../../assets/roomlink-interior.webp'
import { Brand } from '../../features/cesar-ui.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { requestAuth } from '../../services/authService.js'
import GoogleButton from './GoogleButton.jsx'

const registrationFields = { EMAIL_ALREADY_EXISTS: 'email', WEAK_PASSWORD: 'password', TERMS_REQUIRED: 'terms' }

const forms = {
  login: ['Inicia sesión', 'Entra a tu cuenta para conversar con tus roomies y retomar tu búsqueda.', 'Iniciar sesión'],
  register: ['Crea tu cuenta', 'Da el primer paso para encontrar un hogar compartido.', 'Crear cuenta'],
  forgot: ['Recupera tu acceso', 'Escribe tu correo para solicitar instrucciones de recuperación.', 'Solicitar instrucciones'],
  reset: ['Elige una contraseña', 'Crea una nueva contraseña para volver a entrar a RoomLink.', 'Guardar contraseña'],
}

export default function Login({ mode }) {
  const { authenticate, session, forgetSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [search] = useSearchParams()
  const [email, setEmail] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const linkToken = search.get('token')?.trim()
  const [token, setToken] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [message, setMessage] = useState(location.state?.message ?? '')
  const [title, description, action] = forms[mode]
  const login = mode === 'login'
  const register = mode === 'register'
  const forgot = mode === 'forgot'
  const reset = mode === 'reset'

  async function submit(task) {
    if (busy.current) return
    busy.current = true
    setError('')
    setFieldError(null)
    setMessage('')
    setSubmitting(true)
    try {
      await task()
    } catch (cause) {
      const field = register && registrationFields[cause.code]
      if (field) setFieldError({ field, message: cause.message })
      else setError(cause.message)
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await submit(async () => {
      const normalizedEmail = email.trim()
      if (login) return authenticate('login', { email: normalizedEmail, password })
      if (register) {
        if (password.length < 8) {
          setFieldError({ field: 'password', message: 'La contraseña debe tener al menos 8 caracteres.' })
          return
        }
        if (!accepted) {
          setFieldError({ field: 'terms', message: 'Acepta los términos de servicio para continuar.' })
          return
        }
        await requestAuth('register', { email: normalizedEmail, password, termsAccepted: accepted })
        navigate('/login', {
          replace: true,
          state: { ...location.state, email: normalizedEmail, message: 'Tu cuenta está lista. Ya puedes iniciar sesión.' },
        })
        return
      }
      if (forgot) {
        const result = await requestAuth('password/forgot', { email: normalizedEmail })
        setMessage(result.message)
        return
      }
      if (password !== confirmation) throw new Error('Las contraseñas deben coincidir.')
      const result = await requestAuth('password/reset', { token: linkToken || token.trim(), password })
      if (session) forgetSession()
      navigate('/login', { replace: true, state: { message: result.message } })
    })
  }

  function fieldFeedback(field) {
    return fieldError?.field === field
      ? <span id={`access-error-${field}`} className="feature-error" role="alert">{fieldError.message}</span>
      : null
  }

  function fieldAttributes(field) {
    return fieldError?.field === field
      ? { 'aria-invalid': true, 'aria-describedby': `access-error-${field}` }
      : {}
  }

  return (
    <main className="access-page">
      <section className="access-panel" aria-labelledby="access-title">
        <Brand to="/login" />
        <form className="access-form" onSubmit={handleSubmit}>
          <div className="access-intro">
            <h1 id="access-title">{title}</h1>
            <p>{description}</p>
          </div>
          {!reset && <div>
            <label className="field">
              Correo electrónico
              <input autoComplete="email" type="email" placeholder="nombre@correo.com" required value={email} {...fieldAttributes('email')} onChange={(event) => { setEmail(event.target.value); setFieldError(null) }} />
            </label>
            {fieldFeedback('email')}
          </div>}
          {reset && !linkToken && <label className="field">
            Código de recuperación
            <input autoComplete="one-time-code" required value={token} onChange={(event) => setToken(event.target.value)} />
          </label>}
          {!forgot && <div className="access-password">
            <label className="field">
              {reset ? 'Nueva contraseña' : 'Contraseña'}
              <input autoComplete={login ? 'current-password' : 'new-password'} required minLength={reset ? 8 : undefined} type={visible ? 'text' : 'password'} placeholder={login ? 'Tu contraseña' : 'Mínimo 8 caracteres'} value={password} {...fieldAttributes('password')} onChange={(event) => { setPassword(event.target.value); setFieldError(null) }} />
            </label>
            <button className="password-toggle" type="button" onClick={() => setVisible((value) => !value)}>{visible ? 'Ocultar' : 'Mostrar'}</button>
          </div>}
          {fieldFeedback('password')}
          {reset && <label className="field">
            Confirma la contraseña
            <input autoComplete="new-password" required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>}
          {login && <Link className="access-link forgot-link" to="/recuperar" state={location.state}>¿Olvidaste tu contraseña?</Link>}
          {register && <div>
            <label className="access-check">
              <input type="checkbox" checked={accepted} {...fieldAttributes('terms')} onChange={(event) => { setAccepted(event.target.checked); setFieldError(null) }} />
              Acepto los términos de servicio y el aviso de privacidad.
            </label>
            {fieldFeedback('terms')}
          </div>}
          {error && <p className="feature-feedback feature-error" role="alert">{error}</p>}
          {message && <p className="feature-feedback feature-success" role="status">{message}</p>}
          <button className="button button-mint button-wide" disabled={submitting}>
            {submitting ? 'Un momento…' : action}
          </button>
          {(login || register) && <GoogleButton registration={register} enabled={!submitting && (login || accepted)} onCredential={(idToken) => submit(() => authenticate('oauth/google', { idToken, termsAccepted: accepted }))} />}
          {login ? (
            <p className="access-switch">¿Primera vez aquí? <Link className="access-link" to="/registro" state={location.state}>Crea una cuenta</Link></p>
          ) : (
            <p className="access-switch">
              {forgot && <Link className="access-link" to="/restablecer">Ya tengo un código</Link>}
              <Link className="access-link" to="/login" state={{ from: location.state?.from }}>Volver a iniciar sesión</Link>
            </p>
          )}
        </form>
        <p className="access-footer">RoomLink · Hogares compartidos</p>
      </section>
      <aside className="access-visual" style={{ backgroundImage: `linear-gradient(180deg, transparent 45%, rgb(18 38 33 / 75%)), url(${interior})` }}>
        <p>Encuentra tu próximo hogar.</p>
      </aside>
    </main>
  )
}
