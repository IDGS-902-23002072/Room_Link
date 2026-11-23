import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar/Avatar.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import Meter from '../../components/Meter/Meter.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { goBack } from '../../routes/navigation.js'
import { getCandidate, sendConnectionRequest } from './compatibility.js'
import { DIMENSIONS, formatBudget } from './format.js'
import styles from './CandidateDetail.module.css'

function BackLink({ children, onClick }) {
  return (
    <Button className={styles.back} onClick={onClick} variant="quiet">
      ← {children}
    </Button>
  )
}

BackLink.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
}

export default function CandidateDetail({ candidateId }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState({
    candidateId: null,
    profile: null,
    error: '',
  })
  const [requestError, setRequestError] = useState('')
  const [sending, setSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const result = await getCandidate(session.user.id, candidateId, session.token)
        if (isActive()) setDetail({ candidateId, profile: result, error: '' })
      } catch (cause) {
        if (isActive()) {
          setDetail({
            candidateId,
            profile: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar el perfil.',
          })
        }
      }
    }),
    [candidateId, session.token, session.user.id],
  )

  async function requestConnection() {
    if (sending || requestSent) return
    setSending(true)
    setRequestError('')
    try {
      await sendConnectionRequest(session.user.id, candidateId, session.token)
      setRequestSent(true)
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.',
      )
    } finally {
      setSending(false)
    }
  }

  const goToList = () => goBack(navigate, '/recomendados')

  if (detail.candidateId !== candidateId) {
    return (
      <div className={styles.loading} role="status">
        Cargando perfil…
      </div>
    )
  }

  if (detail.error) {
    return (
      <section className={styles.page}>
        <BackLink onClick={goToList}>Volver a roomies</BackLink>
        <Notice tone="error">{detail.error}</Notice>
      </section>
    )
  }

  const profile = detail.profile
  if (!profile) return null

  return (
    <section className={styles.page}>
      <BackLink onClick={goToList}>Volver a roomies</BackLink>

      <Card className={styles.detail}>
        <div className={styles.identity}>
          <Avatar name={profile.fullName} size="lg" src={profile.photoUrl} />
          <h1 className={styles.name}>{profile.fullName}</h1>
          <p className={styles.meta}>
            {profile.age} años · {profile.zone || 'Zona no indicada'}
            {profile.city ? `, ${profile.city}` : ''}
          </p>

          {typeof profile.compatibilityScore === 'number' ? (
            <div className={styles.score}>
              <span>Compatibilidad contigo</span>
              <strong>{Math.round(profile.compatibilityScore)}%</strong>
            </div>
          ) : null}

          {requestError ? <Notice tone="error">{requestError}</Notice> : null}
          {requestSent ? <Notice tone="success">Solicitud de conexión enviada.</Notice> : null}

          <div className={styles.actions}>
            <Button
              aria-busy={sending}
              disabled={sending || requestSent}
              onClick={requestConnection}
            >
              {requestSent ? 'Solicitud enviada' : sending ? 'Enviando…' : 'Enviar solicitud'}
            </Button>
            <Button onClick={goToList} variant="secondary">
              Volver a roomies
            </Button>
          </div>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>Sobre mí</h2>
            <p>{profile.bio || 'Este perfil aún no tiene una descripción.'}</p>
          </section>

          <section className={styles.section}>
            <h2>Estilo de vida</h2>
            <div className={styles.tags}>
              <span>{formatBudget(profile.budgetMin, profile.budgetMax)}</span>
              {profile.occupation ? <span>{profile.occupation}</span> : null}
              {profile.compatibilitySummary?.slice(0, 4).map(({ dimension, level }) => (
                <span key={dimension}>
                  {DIMENSIONS[dimension] || dimension}: {level}
                </span>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2>Respuestas del test</h2>
            {profile.compatibilitySummary?.length ? (
              <div className={styles.answers}>
                {profile.compatibilitySummary.map(({ dimension, percentage }) => (
                  <div className={styles.answer} key={dimension}>
                    <strong>{DIMENSIONS[dimension] || dimension}</strong>
                    <Meter
                      label={`${DIMENSIONS[dimension] || dimension}: ${percentage}%`}
                      showEnds
                      value={percentage}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyCopy}>Este perfil aún no tiene un resumen de test.</p>
            )}
          </section>
        </div>
      </Card>
    </section>
  )
}

CandidateDetail.propTypes = {
  candidateId: PropTypes.string.isRequired,
}
