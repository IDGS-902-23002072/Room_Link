import { useEffect, useRef, useState } from 'react'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
let googleScript

function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  googleScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client?hl=es'
    script.async = true
    script.onload = () => resolve(window.google.accounts.id)
    script.onerror = () => {
      script.remove()
      googleScript = undefined
      reject(new Error('No pudimos cargar el acceso con Google.'))
    }
    document.head.append(script)
  })
  return googleScript
}

export default function GoogleButton({ onCredential, enabled, registration }) {
  const container = useRef(null)
  const callback = useRef(onCredential)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { callback.current = onCredential }, [onCredential])

  useEffect(() => {
    if (!clientId || !enabled) return
    let active = true
    const element = container.current
    loadGoogle().then((google) => {
      if (!active) return
      google.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (active && credential) void callback.current(credential)
        },
      })
      google.renderButton(element, {
        theme: 'outline',
        shape: 'pill',
        size: 'large',
        text: registration ? 'signup_with' : 'continue_with',
        locale: 'es',
      })
    }).catch((cause) => {
      if (active) setError(cause.message)
    })
    return () => {
      active = false
      element.replaceChildren()
    }
  }, [enabled, registration, attempt])

  if (!clientId) return null
  if (!enabled) return registration ? <p className="auth-hint">Acepta los términos para registrarte con Google.</p> : null
  return (
    <div className="google-access">
      <div className="auth-divider"><span>o</span></div>
      <div ref={container} />
      {error && <button className="button button-mint" type="button" onClick={() => {
        setError('')
        setAttempt((value) => value + 1)
      }}>{error} Reintentar</button>}
    </div>
  )
}
