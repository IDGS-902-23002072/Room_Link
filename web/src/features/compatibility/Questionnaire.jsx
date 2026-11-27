import { useEffect, useMemo, useRef, useState } from 'react'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import Meter from '../../components/Meter/Meter.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import ProgressSteps from '../../components/ProgressSteps/ProgressSteps.jsx'
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
import ResultsRadar from './ResultsRadar.jsx'
import styles from './Questionnaire.module.css'

const STEPS = QUESTIONS.map(({ id, category }) => ({ id, title: category }))

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
  const [saved, setSaved] = useState(false)
  const savingRef = useRef(false)
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
          setSaved(true)
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
    if (answers[question.id] !== value) setSaved(false)
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
    setSaved(false)
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
    if (!complete || saving || saved || savingRef.current) return
    setError('')
    setNotice('')
    savingRef.current = true
    setSaving(true)
    try {
      await saveCompatibilityTest(userId, answers, token)
      setSaved(true)
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
      savingRef.current = false
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loading} role="status">
        Recuperando tu test…
      </div>
    )
  }

  if (showResults) {
    return (
      <section className={styles.resultsPage}>
        <PageHeader
          description="Así se distribuyen tus preferencias en cada dimensión."
          eyebrow="RESULTADOS · CONVIVENCIA"
          title="Tu perfil de convivencia"
        />

        <div className={styles.resultsLayout}>
          <Card className={styles.radarPanel}>
            <ResultsRadar summary={summary} />
          </Card>

          <div className={styles.dimensions}>
            {summary.map((item) => (
              <Card className={styles.dimension} key={item.dimension}>
                <span aria-hidden="true" className={styles.dimensionMark}>
                  {item.category.slice(0, 1)}
                </span>
                <div className={styles.dimensionBody}>
                  <div className={styles.dimensionHead}>
                    <h2>{item.category}</h2>
                    <Badge tone={item.level === 'alto' ? 'accent' : 'neutral'}>
                      {item.level}
                    </Badge>
                  </div>
                  <Meter label={`${item.category}: ${item.percentage}%`} value={item.percentage} />
                </div>
                <strong className={styles.dimensionValue}>{item.percentage}%</strong>
              </Card>
            ))}
          </div>
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        <div className={styles.resultActions}>
          <Button onClick={editTest} variant="secondary">Editar respuestas</Button>
          <Button disabled={!complete || saving || saved} onClick={finishTest}>
            {saving ? 'Guardando…' : saved ? 'Respuestas guardadas' : 'Guardar mis respuestas'}
          </Button>
          <Button href="/explorar">Explorar habitaciones</Button>
          <Button onClick={repeatTest} variant="secondary">Repetir test</Button>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <aside aria-label="Pasos del cuestionario" className={styles.sidebar}>
          <div className={styles.sidebarInner}>
            <h2>Cuestionario de convivencia</h2>
            <p>Paso {step + 1} de {QUESTIONS.length}</p>
            <ProgressSteps
              answered={answers}
              current={step}
              label="Pasos del cuestionario"
              steps={STEPS}
              variant="list"
            />
          </div>
        </aside>

        <div className={styles.main}>
          <Button className={styles.back} href="/explorar" variant="quiet">
            ← Volver a explorar
          </Button>

          <ProgressSteps
            answered={answers}
            className={styles.stepper}
            current={step}
            label="Progreso del cuestionario"
            steps={STEPS}
          />

          <header className={styles.heading}>
            <p className={styles.eyebrow}>
              PREGUNTA {step + 1} DE {QUESTIONS.length} · {question.category}
            </p>
            <h1>{question.prompt}</h1>
            <p className={styles.lead}>Elige la opción que más se acerque a tus hábitos o preferencias.</p>
          </header>

          <Card
            as="form"
            className={styles.questionCard}
            onSubmit={(event) => {
              event.preventDefault()
              goNext()
            }}
          >
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Selecciona una respuesta</legend>
              <div className={styles.options}>
                {question.options.map((option, index) => {
                  const value = index + 1
                  const selected = answers[question.id] === value
                  return (
                    <label className={`${styles.option}${selected ? ` ${styles.optionSelected}` : ''}`} key={option}>
                      <input
                        checked={selected}
                        className={styles.radio}
                        name={question.id}
                        onChange={() => answerQuestion(value)}
                        type="radio"
                        value={value}
                      />
                      <span aria-hidden="true" className={styles.scale}>{value}</span>
                      <span className={styles.optionText}>{option}</span>
                      {selected ? (
                        <span aria-hidden="true" className={styles.selectedMark}>
                          ✓ Seleccionada
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <p className={styles.hint}>
              Las respuestas se guardan como borrador en este navegador; en resultados puedes guardarlas en tu perfil.
            </p>
            {error ? <Notice tone="error">{error}</Notice> : null}
            {notice ? <Notice tone="info">{notice}</Notice> : null}

            <div className={styles.actions}>
              <Button
                disabled={step === 0}
                onClick={() => {
                  setError('')
                  setStep((current) => current - 1)
                }}
                variant="secondary"
              >
                Anterior
              </Button>
              <Button disabled={answers[question.id] === undefined} type="submit">
                {step === QUESTIONS.length - 1 ? 'Ver resultados' : 'Siguiente'}
              </Button>
            </div>
          </Card>

          <Button
            className={styles.finish}
            disabled={!complete || saving || saved}
            onClick={finishTest}
            variant="quiet"
          >
            {saving ? 'Guardando respuestas…' : saved ? 'Respuestas guardadas' : 'Finalizar y guardar test'}
          </Button>
        </div>
      </div>
    </section>
  )
}
