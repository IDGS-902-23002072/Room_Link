import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useRoomLinkQuery } from '../../hooks/useRoomLinkQuery.js'
import { apiRequest } from '../../services/api.js'
import { formatMoment } from '../../utils/formatDate.js'
import { FeatureHeading, FeatureNotice } from '../cesar-ui.jsx'
import { Feedback, Panel } from '../roomlink/Workspace.jsx'
import { applicationsPath, applicationStatuses, hostLink, json, roomLink, roomPath } from './listings.js'

export function QueryStatus({ query, onRetry }) {
  if (query.loading) return <FeatureNotice>Cargando…</FeatureNotice>
  if (query.error) return <FeatureNotice error={query.error} retry={onRetry} />
  return null
}

function Status({ value }) {
  return <span className={`listing-status listing-status-${value}`}>{applicationStatuses[value] || 'Estado desconocido'}</span>
}

function ChatButton({ applicationId, token }) {
  const navigate = useNavigate()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  async function open() {
    setOpening(true)
    setError('')
    try {
      const room = await apiRequest('/api/v1/messages/rooms', { token, ...json('POST', { applicationId }) })
      navigate('/mensajes/' + encodeURIComponent(room.id))
    } catch (cause) {
      setError(cause.message)
      setOpening(false)
    }
  }

  return <><button className="button button-mint" disabled={opening} onClick={open} type="button">Abrir conversación</button><Feedback error={error} /></>
}

export function ApplyToRoom({ room, token }) {
  const [version, setVersion] = useState(0)
  const query = useRoomLinkQuery(applicationsPath + '/me', token, version)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [error, setError] = useState('')
  const application = query.data?.find(({ listingId }) => listingId === room.id) || submitted

  async function send(event) {
    event.preventDefault()
    if (submitting || application || !query.data || query.error || room.status !== 'published') return
    setError('')
    setSubmitting(true)
    try {
      setSubmitted(await apiRequest(applicationsPath, { token, ...json('POST', { listingId: room.id, message: message.trim() || null }) }))
    } catch (cause) {
      if (cause.code === 'APPLICATION_ALREADY_SENT') {
        setSubmitted({ status: 'pending' })
        setVersion((current) => current + 1)
      } else {
        setError(cause.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Panel title="Postularme a esta habitación">
      <QueryStatus query={query} onRetry={() => setVersion((current) => current + 1)} />
      {application ? <>
        <p role="status"><strong>Postulación enviada</strong> {application.id && <Status value={application.status} />}</p>
        <Link className="access-link" to="/mis-postulaciones">Ver mis postulaciones</Link>
      </> : room.status !== 'published' ? <p className="muted">Esta habitación ya no recibe postulaciones.</p> : query.data && !query.error && (
        <form className="listing-form room-stack" onSubmit={send}>
          <label>Mensaje para el anfitrión (opcional)<textarea maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
          <Feedback error={error} />
          <button className="button button-mint" disabled={submitting}>{submitting ? 'Enviando…' : 'Enviar postulación'}</button>
        </form>
      )}
    </Panel>
  )
}

function HistoryItem({ application, token }) {
  const { data } = useRoomLinkQuery(roomPath(application.listingId), token)
  return (
    <article className="room-panel listing-application">
      <div className="listing-row">
        <h2><Link to={roomLink(application.listingId)}>{data?.title || 'Ver habitación'}</Link></h2>
        <Status value={application.status} />
      </div>
      <p className="muted">Enviada el <time dateTime={application.createdAt}>{formatMoment(application.createdAt)}</time></p>
      {application.decidedAt && <p className="muted">Actualizada el <time dateTime={application.decidedAt}>{formatMoment(application.decidedAt)}</time></p>}
      {application.message && <p className="listing-description">{application.message}</p>}
      {application.status === 'accepted' && <ChatButton token={token} applicationId={application.id} />}
    </article>
  )
}

const newestFirst = (items) => [...items].sort((first, second) => second.createdAt.localeCompare(first.createdAt))

export function MyApplications() {
  const { session } = useAuth()
  const [version, setVersion] = useState(0)
  const query = useRoomLinkQuery(applicationsPath + '/me', session.token, version)
  return (
    <section className="listing-page">
      <FeatureHeading title="Mis postulaciones" description="Consulta el estado de las habitaciones que solicitaste.">
        <Link className="button button-mint" to="/habitaciones">Explorar habitaciones</Link>
      </FeatureHeading>
      <QueryStatus query={query} onRetry={() => setVersion((current) => current + 1)} />
      {query.data?.length === 0 && !query.error && <FeatureNotice>Todavía no has enviado postulaciones.</FeatureNotice>}
      <div className="room-stack">
        {newestFirst(query.data || []).map((application) => <HistoryItem key={application.id} application={application} token={session.token} />)}
      </div>
    </section>
  )
}

function Applicant({ item, token, deciding, onDecision }) {
  const candidate = useRoomLinkQuery('/api/v1/profiles/' + encodeURIComponent(item.applicantId), token)
  const canDecide = item.status === 'pending' || item.status === 'waitlisted'

  return (
    <article className="room-panel listing-application">
      <div className="listing-row">
        <h2>{candidate.data?.fullName || 'Postulante'}</h2>
        <Status value={item.status} />
      </div>
      <p className="muted"><time dateTime={item.createdAt}>{formatMoment(item.createdAt)}</time> · {item.compatibilityScore == null ? 'Afinidad sin calcular' : `${Math.round(item.compatibilityScore)}% de afinidad`}</p>
      {item.message && <p className="listing-description">{item.message}</p>}
      {candidate.data && <details className="listing-description">
        <summary>Perfil del postulante</summary>
        <p>{[candidate.data.age != null && `${candidate.data.age} años`, candidate.data.occupation].filter(Boolean).join(' · ')}</p>
        <p>{candidate.data.bio || 'Este perfil aún no tiene biografía.'}</p>
        <Link to={`/perfil/candidato/${encodeURIComponent(item.applicantId)}`}>Ver perfil y compatibilidad</Link>
      </details>}
      <div className="feature-actions">
        {canDecide && <>
          <button className="button button-mint" disabled={deciding} type="button" onClick={() => onDecision(item.id, 'accept')}>Aceptar</button>
          {item.status === 'pending' && <button className="button button-subtle" disabled={deciding} type="button" onClick={() => onDecision(item.id, 'waitlist')}>Poner en lista de espera</button>}
          <button className="button button-rose" disabled={deciding} type="button" onClick={() => onDecision(item.id, 'reject')}>Rechazar</button>
        </>}
        {item.status === 'accepted' && <ChatButton token={token} applicationId={item.id} />}
      </div>
    </article>
  )
}

export function HostApplications() {
  const { listingId } = useParams()
  const { session } = useAuth()
  const [version, setVersion] = useState(0)
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [offerClose, setOfferClose] = useState(false)
  const room = useRoomLinkQuery(roomPath(listingId), session.token, version)
  const isOwner = room.data?.hostId === session.user.id
  const query = useRoomLinkQuery(isOwner ? applicationsPath + '/listing/' + encodeURIComponent(listingId) : null, session.token, version)
  const refresh = () => setVersion((current) => current + 1)

  async function act(path, body, notice, onSuccess) {
    setDeciding(true)
    setError('')
    setFeedback('')
    try {
      await apiRequest(path, { token: session.token, ...(body ? json('PATCH', body) : { method: 'PATCH' }) })
      refresh()
      setFeedback(notice)
      onSuccess?.()
    } catch (cause) {
      setError(cause.message)
      refresh()
    } finally {
      setDeciding(false)
    }
  }

  return (
    <section className="listing-page">
      <Link className="access-link" to="/anfitrion">Volver a mis habitaciones</Link>
      <FeatureHeading title="Postulaciones recibidas" description={room.data?.title || 'Bandeja de la habitación'} />
      <QueryStatus query={room} onRetry={refresh} />
      {room.data && !isOwner && <FeatureNotice error="Solo el anfitrión puede gestionar estas postulaciones." />}
      {isOwner && <>
        <Link className="access-link" to={hostLink(listingId)}>Gestionar anuncio</Link>
        <Feedback error={error}>{feedback}</Feedback>
        {offerClose && ['published', 'paused'].includes(room.data.status) && (
          <Panel title="¿Ya encontraste roomie?">
            <p>Si cierras el anuncio, dejará de recibir postulaciones.</p>
            <div className="feature-actions">
              <button className="button button-rose" type="button" disabled={deciding} onClick={() => act(roomPath(listingId) + '/close', null, 'Anuncio cerrado.', () => setOfferClose(false))}>Cerrar anuncio</button>
              <button className="button button-subtle" type="button" onClick={() => setOfferClose(false)}>Dejarlo como está</button>
            </div>
          </Panel>
        )}
        <QueryStatus query={query} onRetry={refresh} />
        {query.data?.length === 0 && !query.error && <FeatureNotice>Todavía no hay postulaciones para esta habitación.</FeatureNotice>}
        <div className="room-stack">
          {newestFirst(query.data || []).map((item) => <Applicant key={item.id} item={item} token={session.token} deciding={deciding}
            onDecision={(id, decision) => act(applicationsPath + '/' + encodeURIComponent(id) + '/decide', { decision },
              ({ accept: 'Postulación aceptada.', reject: 'Postulación rechazada.', waitlist: 'Postulación en lista de espera.' })[decision],
              decision === 'accept' ? () => setOfferClose(true) : null)} />)}
        </div>
      </>}
    </section>
  )
}
