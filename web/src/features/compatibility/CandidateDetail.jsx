import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar/Avatar.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import Meter from '../../components/Meter/Meter.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { apiAssetUrl } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { useRoomLinkQuery } from '../../hooks/useRoomLinkQuery.js'
import { goBack } from '../../routes/navigation.js'
import { getPublicProfile } from '../roomlink/publicProfiles.js'
import { readLocal, writeLocal } from '../roomlink/storage.js'
import { calculateSummary, getCandidate, isCompleteAnswers, sendConnectionRequest } from './compatibility.js'
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
    publicProfile: null,
    photos: [],
    compatibilityError: '',
    compatibilityUnavailable: false,
    error: '',
  })
  const [requestError, setRequestError] = useState('')
  const [sending, setSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [history, setHistory] = useState(() => readLocal(session.user.id, 'candidate-history', {}))
  const [historyError, setHistoryError] = useState('')
  const ownTest = useRoomLinkQuery(`/api/v1/compatibility/${encodeURIComponent(session.user.id)}`, session.token)
  const connections = useRoomLinkQuery('/api/v1/connections', session.token, connectionAttempt)
  const activeConnection = connections.data?.find(({ requesterId, addresseeId, status }) => (
    (requesterId === candidateId || addresseeId === candidateId)
    && ['pending', 'accepted'].includes(status)
  ))
  const connectionLabel = activeConnection?.status === 'accepted' ? 'Conexión aceptada'
    : activeConnection?.requesterId === candidateId ? 'Solicitud recibida'
    : activeConnection || requestSent ? 'Solicitud enviada' : null

  useEffect(
    () => asyncEffect(async (isActive) => {
      const [publicResult, compatibilityResult] = await Promise.allSettled([
        getPublicProfile(candidateId, session.token),
        getCandidate(session.user.id, candidateId, session.token),
      ])
      if (!isActive()) return
      if (publicResult.status === 'rejected') {
        setDetail({
          candidateId,
          profile: null,
          publicProfile: null,
          photos: [],
          compatibilityError: '',
          compatibilityUnavailable: false,
          error: publicResult.reason instanceof Error
            ? publicResult.reason.message
            : 'No se pudo cargar el perfil.',
        })
        return
      }
      setDetail({
        candidateId,
        profile: compatibilityResult.status === 'fulfilled' ? compatibilityResult.value : null,
        publicProfile: publicResult.value.profile,
        photos: publicResult.value.photos,
        compatibilityError: compatibilityResult.status === 'rejected'
          && compatibilityResult.reason?.status !== 404
          ? compatibilityResult.reason instanceof Error
            ? compatibilityResult.reason.message
            : 'No se pudo consultar la compatibilidad.'
          : '',
        compatibilityUnavailable: compatibilityResult.status === 'rejected'
          && compatibilityResult.reason?.status === 404,
        error: '',
      })
    }),
    [candidateId, session.token, session.user.id],
  )

  async function requestConnection() {
    if (sending || requestSent || connectionLabel || connections.loading || connections.error) return
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
  const publicProfile = detail.publicProfile
  if (!publicProfile) return null
  const name = profile?.fullName ?? publicProfile.fullName
  const age = profile?.age ?? publicProfile.age
  const bio = profile?.bio ?? publicProfile.bio
  const occupation = profile?.occupation ?? publicProfile.occupation
  const ownAnswers = ownTest.data?.completed && isCompleteAnswers(ownTest.data.answers) ? calculateSummary(ownTest.data.answers) : []
  const candidateAnswers = new Map((profile?.compatibilitySummary ?? []).map(({ dimension, percentage }) => [dimension, percentage]))
  const comparison = ownAnswers.flatMap(({ dimension, category, percentage }) => candidateAnswers.has(dimension)
    ? [{ dimension, category, mine: percentage, theirs: candidateAnswers.get(dimension), difference: Math.abs(percentage - candidateAnswers.get(dimension)) }]
    : [])

  function updateHistory(status) {
    const next = { ...history }
    if (next[candidateId]?.status === status) delete next[candidateId]
    else next[candidateId] = { id: candidateId, name, status }
    try {
      writeLocal(session.user.id, 'candidate-history', next)
      setHistory(next)
      setHistoryError('')
    } catch (error) {
      setHistoryError(error.message)
    }
  }
  const mainPhoto = detail.photos.find((photo) => photo.isMain) ?? detail.photos[0]
  const photoUrl = mainPhoto?.url
    ? apiAssetUrl(mainPhoto.url)
    : profile?.photoUrl
      ? apiAssetUrl(profile.photoUrl)
      : undefined
  const hasSharedContact = publicProfile.phone || publicProfile.instagram || publicProfile.facebook
  const phoneLink = publicProfile.phone?.replace(/[^\d+]/g, '')

  return (
    <section className={styles.page}>
      <BackLink onClick={goToList}>Volver a roomies</BackLink>

      <Card className={styles.detail}>
        <div className={styles.identity}>
          <Avatar name={name} size="lg" src={photoUrl} />
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.meta}>
            {age != null ? `${age} años · ` : ''}
            {[profile?.zone, profile?.city].filter(Boolean).join(' · ') || 'Zona no indicada'}
          </p>
          {publicProfile.isVerified ? (
            <span className={styles.verification}>Identidad verificada</span>
          ) : null}

          {typeof profile?.compatibilityScore === 'number' ? (
            <div className={styles.score}>
              <span>Compatibilidad contigo</span>
              <strong>{Math.round(profile.compatibilityScore)}%</strong>
            </div>
          ) : null}

          {requestError ? <Notice tone="error">{requestError}</Notice> : null}
          {connections.error ? (
            <Notice tone="error">No se pudo consultar el estado de la conexión.</Notice>
          ) : null}
          {requestSent ? <Notice tone="success">Solicitud de conexión enviada.</Notice> : null}

          <div className={styles.actions}>
            {connections.error ? (
              <Button onClick={() => setConnectionAttempt((value) => value + 1)} variant="secondary">
                Reintentar consulta
              </Button>
            ) : null}
            <Button
              aria-busy={sending}
              disabled={
                sending
                || requestSent
                || Boolean(connectionLabel)
                || connections.loading
                || Boolean(connections.error)
              }
              onClick={requestConnection}
            >
              {connectionLabel || (sending ? 'Enviando…' : connections.loading ? 'Consultando…' : 'Enviar solicitud')}
            </Button>
            <Button onClick={goToList} variant="secondary">
              Volver a roomies
            </Button>
          </div>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>Sobre mí</h2>
            <p>{bio || 'Este perfil aún no tiene una descripción.'}</p>
          </section>

          <section className={styles.section}>
            <h2>Estilo de vida</h2>
            <div className={styles.tags}>
              {profile ? <span>{formatBudget(profile.budgetMin, profile.budgetMax)}</span> : null}
              {occupation ? <span>{occupation}</span> : null}
              {profile?.compatibilitySummary?.slice(0, 4).map(({ dimension, level }) => (
                <span key={dimension}>
                  {DIMENSIONS[dimension] || dimension}: {level}
                </span>
              ))}
            </div>
          </section>

          {detail.photos.length ? (
            <section className={styles.section}>
              <h2>Fotos del perfil</h2>
              <div className={styles.photos}>
                {detail.photos.map((photo, index) => (
                  <img
                    alt={`Foto ${index + 1} de ${name}`}
                    className={styles.photo}
                    key={photo.id}
                    loading="lazy"
                    src={apiAssetUrl(photo.url)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.section}>
            <h2>Comparación de hábitos</h2>
            {comparison.length > 0 ? <>
              <div className="candidate-comparison">
                <table aria-label="Comparación de hábitos">
                  <thead><tr><th scope="col">Hábito</th><th scope="col">Tú</th><th scope="col">{name}</th></tr></thead>
                  <tbody>{comparison.map(({ dimension, category, mine, theirs }) => (
                    <tr key={dimension}><th scope="row">{category}</th><td>{mine}%</td><td>{theirs}%</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <p>Puntos en común: {comparison.filter(({ difference }) => difference <= 25).map(({ category }) => category).join(', ') || 'Sin coincidencias cercanas'}</p>
              <p>Hábitos para conversar: {comparison.filter(({ difference }) => difference >= 50).map(({ category }) => category).join(', ') || 'Sin diferencias marcadas'}</p>
            </> : <p>{ownTest.loading ? 'Consultando tu test…' : 'La comparación requiere respuestas de ambos perfiles.'}</p>}
            <div className="feature-actions">
              <button className="button button-secondary" type="button" aria-pressed={history[candidateId]?.status === 'saved'} onClick={() => updateHistory('saved')}>Guardar perfil</button>
              <button className="button button-secondary" type="button" aria-pressed={history[candidateId]?.status === 'discarded'} onClick={() => updateHistory('discarded')}>Descartar perfil</button>
            </div>
            {historyError && <Notice tone="error">{historyError}</Notice>}
          </section>
          <section className={styles.section}>
            <h2>Respuestas del test</h2>
            {profile?.compatibilitySummary?.length ? (
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
            ) : detail.compatibilityUnavailable ? (
              <p className={styles.emptyCopy}>
                Este perfil aún no cuenta con información de compatibilidad disponible.
              </p>
            ) : detail.compatibilityError ? (
              <p className={styles.emptyCopy}>
                No se pudo consultar la compatibilidad: {detail.compatibilityError}
              </p>
            ) : (
              <p className={styles.emptyCopy}>Este perfil aún no tiene un resumen de test.</p>
            )}
          </section>

          <section className={styles.section}>
            <h2>Datos compartidos</h2>
            {hasSharedContact ? (
              <dl className={styles.contact}>
                {publicProfile.phone ? (
                  <div>
                    <dt>Teléfono</dt>
                    <dd><a href={`tel:${phoneLink}`}>{publicProfile.phone}</a></dd>
                  </div>
                ) : null}
                {publicProfile.instagram ? (
                  <div><dt>Instagram</dt><dd>{publicProfile.instagram}</dd></div>
                ) : null}
                {publicProfile.facebook ? (
                  <div><dt>Facebook</dt><dd>{publicProfile.facebook}</dd></div>
                ) : null}
              </dl>
            ) : (
              <p className={styles.emptyCopy}>No ha compartido datos de contacto para esta vista.</p>
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
