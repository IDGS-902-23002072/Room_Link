import PropTypes from 'prop-types'
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

function QuestionnaireSteps({ step, answers }) {
  return (
    <aside aria-label="Pasos del cuestionario" className="questionnaire-sidebar">
      <h2>Cuestionario de convivencia</h2>
      <p>Paso {step + 1} de {QUESTIONS.length}</p>
      <ol>
        {QUESTIONS.map(({ id, category }, index) => {
          const answered = answers[id] !== undefined
          const current = step === index
          return (
            <li className={current ? 'current' : answered ? 'answered' : ''} key={id}>
              <span aria-hidden="true">{answered ? '✓' : index + 1}</span>
              <span>{category}</span>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

QuestionnaireSteps.propTypes = {
  answers: PropTypes.objectOf(PropTypes.number).isRequired,
  step: PropTypes.number.isRequired,
}

function QuestionStepper({ step, answers }) {
  return (
    <ol aria-label="Progreso del cuestionario" className="question-stepper">
      {QUESTIONS.map(({ id }, index) => (
        <li
          aria-current={index === step ? 'step' : undefined}
          className={index === step ? 'current' : answers[id] !== undefined ? 'answered' : ''}
          key={id}
        >
          {answers[id] !== undefined && index !== step ? '✓' : index + 1}
        </li>
      ))}
    </ol>
  )
}

QuestionStepper.propTypes = {
  answers: PropTypes.objectOf(PropTypes.number).isRequired,
  step: PropTypes.number.isRequired,
}

function ResultsRadar({ summary }) {
  const center = 100
  const radius = 68
  const angleFor = (index) => (-Math.PI / 2) + (index * Math.PI * 2) / summary.length
  const pointFor = (index, scale) => {
    const angle = angleFor(index)
    return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`
  }
  const resultPoints = summary
    .map(({ percentage }, index) => pointFor(index, percentage / 100))
    .join(' ')

  return (
    <section aria-label="Gráfica de preferencias por dimensión" className="results-radar">
      <svg aria-hidden="true" viewBox="0 0 200 200">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            className="radar-grid"
            key={scale}
            points={summary.map((_, index) => pointFor(index, scale)).join(' ')}
          />
        ))}
        {summary.map(({ category }, index) => (
          <line
            className="radar-axis"
            key={category}
            x1={center}
            x2={center + Math.cos(angleFor(index)) * radius}
            y1={center}
            y2={center + Math.sin(angleFor(index)) * radius}
          />
        ))}
        <polygon className="radar-result" points={resultPoints} />
        {summary.map(({ percentage }, index) => (
          <circle
            className="radar-point"
            key={index}
            cx={center + Math.cos(angleFor(index)) * radius * percentage / 100}
            cy={center + Math.sin(angleFor(index)) * radius * percentage / 100}
            r="3"
          />
        ))}
      </svg>
      <div className="radar-labels">
        {summary.map(({ category, percentage }) => (
          <span key={category}>{category}<strong>{percentage}%</strong></span>
        ))}
      </div>
    </section>
  )
}

ResultsRadar.propTypes = {
  summary: PropTypes.arrayOf(PropTypes.shape({
    category: PropTypes.string.isRequired,
    percentage: PropTypes.number.isRequired,
  })).isRequired,
}

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
      <section className="compatibility-page results-page">
        <header className="results-heading">
          <p className="eyebrow">MÓDULO 03 · RESULTADOS</p>
          <h1>Tu perfil de convivencia</h1>
          <p className="muted">Así se distribuyen tus preferencias en cada dimensión.</p>
        </header>
        <div className="results-layout">
          <ResultsRadar summary={summary} />
          <div className="results-dimensions">
            {summary.map((item) => (
              <article className="result-dimension" key={item.dimension}>
                <span className="dimension-mark" aria-hidden="true">{item.category.slice(0, 1)}</span>
                <div className="result-dimension-copy">
                  <div className="summary-heading">
                    <h2>{item.category}</h2>
                    <span className={`level-pill level-${item.level}`}>{item.level}</span>
                  </div>
                  <div
                    aria-label={`${item.category}: ${item.percentage}%`}
                    className="meter-track"
                    role="img"
                  >
                    <span style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
                <strong className="result-dimension-value">{item.percentage}%</strong>
              </article>
            ))}
          </div>
        </div>
        {error && <div className="form-error notice" role="alert">{error}</div>}
        {notice && <div className="inline-notice" role="status">{notice}</div>}
        <div className="result-actions wireframe-result-actions">
          <button className="button button-secondary" onClick={editTest} type="button">
            Editar respuestas
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
          <button className="button button-secondary" onClick={repeatTest} type="button">
            Repetir test
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="compatibility-page questionnaire-layout">
      <QuestionnaireSteps step={step} answers={answers} />
      <div className="questionnaire-main">
        <div className="questionnaire-topline">
          <AppLink className="back-link" href="/explorar">← Volver a explorar</AppLink>
          <span className="eyebrow">TEST DE CONVIVENCIA</span>
        </div>
        <QuestionStepper step={step} answers={answers} />
        <header className="questionnaire-heading">
          <p className="eyebrow">PREGUNTA {step + 1} DE {QUESTIONS.length} · {question.category}</p>
          <h1>{question.prompt}</h1>
          <p className="muted">Elige la opción que mejor te describa.</p>
        </header>
        <form
          className="question-card"
          onSubmit={(event) => {
            event.preventDefault()
            goNext()
          }}
        >
          <fieldset>
            <legend>Selecciona una respuesta</legend>
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
            Escala de 1 a 5 · Tus respuestas se guardan automáticamente
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
      </div>
    </section>
  )
}
