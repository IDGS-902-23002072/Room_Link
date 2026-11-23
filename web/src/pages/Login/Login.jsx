import PropTypes from 'prop-types'
import { useState } from 'react'
import BrandMark from '../../components/BrandMark/BrandMark.jsx'
import Button from '../../components/Button/Button.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import styles from './Login.module.css'

const HIGHLIGHTS = [
  'Perfiles con hábitos y rutinas compatibles',
  'Un test breve para encontrar afinidades reales',
  'Un espacio tranquilo para decidir con calma',
]

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
    <main className={styles.page}>
      <aside className={styles.story} aria-label="Sobre RoomLink">
        <BrandMark />

        <div className={styles.storyCopy}>
          <p className={styles.storyEyebrow}>CONVIVENCIA CON INTENCIÓN</p>
          <h1 className={styles.storyTitle}>Un hogar empieza con las personas correctas.</h1>
          <p className={styles.storyLead}>
            RoomLink te ayuda a encontrar roomies que comparten tus hábitos, tu ritmo y
            tu forma de vivir. Sin prisas y con información clara.
          </p>
        </div>

        <ul className={styles.highlights}>
          {HIGHLIGHTS.map((item) => (
            <li key={item}>
              <span aria-hidden="true" className={styles.check}>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className={styles.storyFoot}>Encuentra tu lugar · Convive mejor</p>
      </aside>

      <section aria-labelledby="login-title" className={styles.panel}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>BIENVENIDO DE NUEVO</p>
          <h2 className={styles.title} id="login-title">Inicia sesión</h2>
          <p className={styles.lead}>
            Ingresa para descubrir perfiles compatibles y continuar tu test de convivencia.
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <Field htmlFor="login-email" label="Correo electrónico">
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                spellCheck={false}
                type="email"
                value={email}
              />
            </Field>

            <Field htmlFor="login-password" label="Contraseña">
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                spellCheck={false}
                type="password"
                value={password}
              />
            </Field>

            {error ? <Notice tone="error">{error}</Notice> : null}

            <Button
              aria-busy={submitting}
              className={styles.submit}
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Conectando…' : 'Iniciar sesión'}
            </Button>
            <span aria-live="polite" className="sr-only" role="status">
              {submitting ? 'Conectando…' : ''}
            </span>
          </form>

          <p className={styles.help}>
            ¿Es tu primera vez? Al entrar podrás completar el test de convivencia.
          </p>
        </div>
      </section>
    </main>
  )
}

Login.propTypes = {
  onLogin: PropTypes.func.isRequired,
}

export default Login
