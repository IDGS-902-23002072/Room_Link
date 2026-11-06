import { useEffect, useMemo, useState } from 'react'
import { AppLink } from '../../components/AppLink.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  QUESTIONS,
  calculateSummary,
  clearLocalDraft,
  getCompatibilityTest,
  isCompleteAnswers,
  loadLocalDraft,
  saveCompatibilityTest,
  saveLocalDraft,
} from './compatibility.js'
import './compatibility.css'

function firstUnanswered(answers) {
  const index = QUESTIONS.findIndex(({ id }) => answers[id] === undefined)
  return index < 0 ? QUESTIONS.length - 1 : index
}

export default function Questionnaire() {
  const { session } = useAuth()
  const userId = session.user.id
  const token = session.token
  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    async function hydrate() {
      let draft = {}
      try {
        draft = loadLocalDraft(userId)
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo leer el borrador.')
        }
      }

      try {
        const result = await getCompatibilityTest(userId, token)
        if (!active) return
        if (result.completed && result.answers && isCompleteAnswers(result.answers)) {
          setAnswers(result.answers)
          setShowResults(true)
          return
        }
        setAnswers(draft)
        setStep(firstUnanswered(draft))
      } catch (cause) {
        if (!active) return
        setAnswers(draft)
        setStep(firstUnanswered(draft))
        setNotice(
          draft && Object.keys(draft).length
            ? 'Sin conexión con el servidor. Tus respuestas parciales se recuperaron de este navegador.'
            : 'No se pudo consultar el test en el servidor. Puedes comenzar y tus respuestas se guardarán localmente.',
        )
        if (cause instanceof Error && !cause.message.includes('No se pudo conectar')) {
          setError(cause.message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void hydrate()
    return () => {
      active = false
    }
  }, [token, userId])

  const question = QUESTIONS[step]
  const summary = useMemo(() => calculateSummary(answers), [answers])
  const complete = isCompleteAnswers(answers)

  function answerQuestion(value) {
    const nextAnswers = { ...answers, [question.id]: value }
    setAnswers(nextAnswers)
    setError('')
    setNotice('')
    try {
      saveLocalDraft(userId, nextAnswers)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el borrador.')
    }
  }

  function goNext() {
    if (answers[question.id] === undefined) {
      setError('Selecciona una respuesta para continuar.')
      return
    }
    setError('')
    if (step === QUESTIONS.length - 1) {
      setShowResults(true)
    } else {
      setStep((current) => current + 1)
    }
  }

  function editTest() {
    setStep(0)
    setShowResults(false)
    setError('')
    setNotice('')
  }

  function repeatTest() {
    setAnswers({})
    setStep(0)
    setShowResults(false)
    setError('')
    setNotice('')
    try {
      saveLocalDraft(userId, {})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el borrador.')
    }
  }

  async function finishTest() {
    if (!complete || saving) return
    setError('')
    setNotice('')
    setSaving(true)
    try {
      await saveCompatibilityTest(userId, answers, token)
      setNotice('Tus respuestas se guardaron correctamente.')
      setShowResults(true)
      try {
        clearLocalDraft(userId)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el borrador.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el test.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading-screen">Recuperando tu test…</div>
  }

  if (showResults) {
    return (
      <section className="compatibility-page">
        <div className="module-topline">
          <AppLink className="back-link" href="/explorar">← Volver a explorar</AppLink>
          <span className="eyebrow">MÓDULO 03 · TU TEST</span>
        </div>
        <div className="module-heading">
          <p className="eyebrow">ASÍ ES TU ESTILO</p>
          <h1>Tu perfil de convivencia</h1>
          <p className="muted">
            Estos porcentajes describen cada dimensión de tus respuestas.
          </p>
        </div>
        <div className="summary-grid">
          {summary.map((item) => (
            <article className="summary-card" key={item.dimension}>
              <div className="summary-heading">
                <h2>{item.category}</h2>
                <span className={`level-pill level-${item.level}`}>{item.level}</span>
              </div>
              <div className="summary-value">{item.percentage}<span>%</span></div>
              <div
                aria-label={`${item.category}: ${item.percentage}%`}
                className="meter-track"
                role="img"
              >
                <span style={{ width: `${item.percentage}%` }} />
              </div>
            </article>
          ))}
        </div>
        {error && <div className="form-error notice" role="alert">{error}</div>}
        {notice && <div className="inline-notice" role="status">{notice}</div>}
        <div className="result-actions">
          <button className="button button-secondary" onClick={editTest} type="button">
            Editar respuestas
          </button>
          <button className="button button-secondary" onClick={repeatTest} type="button">
            Repetir test
          </button>
          <button
            className="button button-primary"
            disabled={!complete || saving}
            onClick={finishTest}
            type="button"
          >
            {saving ? 'Guardando…' : 'Guardar respuestas'}
          </button>
          <AppLink className="button button-primary" href="/recomendados">
            Ver roomies compatibles
          </AppLink>
        </div>
      </section>
    )
  }

  return (
    <section className="compatibility-page">
      <div className="module-topline">
        <AppLink className="back-link" href="/explorar">← Volver a explorar</AppLink>
        <span className="eyebrow">MÓDULO 03 · TEST DE CONVIVENCIA</span>
      </div>
      <div className="module-heading">
        <p className="eyebrow">PREGUNTA {step + 1} DE {QUESTIONS.length}</p>
        <h1>Cuestionario de compatibilidad</h1>
        <p className="muted">Elige la opción que mejor te describa.</p>
      </div>
      <div
        aria-label={`Progreso: ${Math.round(((step + 1) / QUESTIONS.length) * 100)}%`}
        className="question-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={QUESTIONS.length}
        aria-valuenow={step + 1}
      >
        <span style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
      </div>
      <form
        className="question-card"
        onSubmit={(event) => {
          event.preventDefault()
          goNext()
        }}
      >
        <div className="question-count">0{step + 1}</div>
        <fieldset>
          <legend>{question.prompt}</legend>
          <div className="answer-options">
            {question.options.map((option, index) => {
              const value = index + 1
              const selected = answers[question.id] === value
              return (
                <label className={`answer-option${selected ? ' selected' : ''}`} key={option}>
                  <input
                    checked={selected}
                    name={question.id}
                    onChange={() => answerQuestion(value)}
                    type="radio"
                    value={value}
                  />
                  <span className="answer-scale">{value}</span>
                  <span>{option}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
        <div aria-live="polite" className="answer-hint">
          Escala de 1 a 5 · Selecciona una opción para continuar
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="inline-notice" role="status">{notice}</p>}
        <div className="question-actions">
          <button
            className="button button-secondary"
            disabled={step === 0}
            onClick={() => {
              setError('')
              setStep((current) => current - 1)
            }}
            type="button"
          >
            Anterior
          </button>
          <button
            className="button button-primary"
            disabled={answers[question.id] === undefined}
            type="submit"
          >
            {step === QUESTIONS.length - 1 ? 'Ver resultados' : 'Siguiente'}
          </button>
        </div>
      </form>
      <button
        className="finish-link"
        disabled={!complete || saving}
        onClick={finishTest}
        type="button"
      >
        {saving ? 'Guardando respuestas…' : 'Finalizar y guardar test'}
      </button>
    </section>
  )
}
