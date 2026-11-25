import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar/Avatar.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import Field from '../../components/Field/Field.jsx'
import Meter from '../../components/Meter/Meter.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { useAuth } from '../../hooks/useAuth.js'
import { goBack } from '../../routes/navigation.js'
import { apiAssetUrl, apiRequest } from '../../services/api.js'
import { getPublicProfile } from '../roomlink/publicProfiles.js'
import { getCandidate } from '../compatibility/compatibility.js'
import { DIMENSIONS } from '../compatibility/format.js'
import {
  applyToRoom,
  describeApplicationStatus,
  describeRules,
  formatAvailability,
  formatCostAmount,
  formatCostKind,
  formatRent,
  formatRoommates,
  formatRoomLocation,
  getMyApplications,
  getRoom,
  indexApplications,
  formatShortDate,
  roomPhotoUrl,
} from './rooms.js'
import styles from './RoomDetail.module.css'

const MESSAGE_MAX_LENGTH = 500

function describeError(cause, fallback) {
  return cause instanceof Error ? cause.message : fallback
}

function mapUrl(location) {
  if (
    location?.latitude == null ||
    location?.longitude == null ||
    !Number.isFinite(Number(location.latitude)) ||
    !Number.isFinite(Number(location.longitude))
  ) return ''
  return `https://www.google.com/maps?q=${Number(location.latitude)},${Number(location.longitude)}`
}

export default function RoomDetail({ roomId }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState({ roomId: null, room: null, error: '' })
  const [hostDetails, setHostDetails] = useState({
    roomId: null,
    profile: null,
    photos: [],
    candidate: null,
    profileError: '',
    compatibilityError: '',
    compatibilityUnavailable: false,
  })
  const [agreementsState, setAgreementsState] = useState({
    roomId: null,
    items: [],
    error: '',
    loading: true,
  })
  const [photoIndex, setPhotoIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [applied, setApplied] = useState(false)
  const [appStatus, setAppStatus] = useState({ roomId: null, status: null })
  const [applyError, setApplyError] = useState('')

  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const room = await getRoom(roomId)
        if (isActive()) setDetail({ roomId, room, error: '' })
      } catch (cause) {
        if (isActive()) {
          setDetail({
            roomId,
            room: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar la habitación.',
          })
        }
      }
    }),
    [roomId],
  )

  const loadedRoom = detail.roomId === roomId ? detail.room : null
  const hostId = loadedRoom?.hostId ?? ''
  const ownRoom = hostId === session.user.id

  useEffect(
    () => asyncEffect(async (isActive) => {
      if (!hostId) return
      const [profileResult, candidateResult] = await Promise.allSettled([
        getPublicProfile(hostId, session.token),
        ownRoom ? Promise.resolve(null) : getCandidate(session.user.id, hostId, session.token),
      ])
      if (!isActive()) return
      setHostDetails({
        roomId,
        profile: profileResult.status === 'fulfilled' ? profileResult.value.profile : null,
        photos: profileResult.status === 'fulfilled' ? profileResult.value.photos : [],
        candidate: candidateResult.status === 'fulfilled' ? candidateResult.value : null,
        profileError: profileResult.status === 'rejected'
          ? describeError(profileResult.reason, 'No se pudo cargar el perfil.')
          : '',
        compatibilityError: candidateResult.status === 'rejected' && candidateResult.reason?.status !== 404
          ? describeError(candidateResult.reason, 'No se pudo consultar la compatibilidad.')
          : '',
        compatibilityUnavailable: candidateResult.status === 'rejected'
          && candidateResult.reason?.status === 404,
      })
    }),
    [hostId, ownRoom, roomId, session.token, session.user.id],
  )

  useEffect(
    () => asyncEffect(async (isActive) => {
      if (!loadedRoom) return
      setAgreementsState({ roomId, items: [], error: '', loading: true })
      const path = ownRoom
        ? `/api/v1/agreements/by-listing/${encodeURIComponent(roomId)}`
        : `/api/v1/agreements/by-user/${encodeURIComponent(session.user.id)}`
      try {
        const result = await apiRequest(path, { token: session.token })
        if (!Array.isArray(result?.items)) {
          throw new Error('Los acuerdos devolvieron una respuesta inválida.')
        }
        const items = result.items.filter((item) => (
          item.listingId === roomId
          && [item.hostId, ...(Array.isArray(item.roomieIds) ? item.roomieIds : [])]
            .includes(session.user.id)
        ))
        if (isActive()) setAgreementsState({ roomId, items, error: '', loading: false })
      } catch (cause) {
        if (isActive()) {
          setAgreementsState({
            roomId,
            items: [],
            error: describeError(cause, 'No se pudieron cargar los acuerdos asociados.'),
            loading: false,
          })
        }
      }
    }),
    [loadedRoom, ownRoom, roomId, session.token, session.user.id],
  )

  // Al abrir (o recargar) la habitación se consulta si ya existe una postulación.
  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const mine = indexApplications(await getMyApplications(session.token))
        if (isActive()) setAppStatus({ roomId, status: mine[roomId] ?? null })
      } catch {
        if (isActive()) setAppStatus({ roomId, status: null })
      }
    }),
    [roomId, session.token],
  )

  async function handleApply(event) {
    event.preventDefault()
    if (sending || applied) return
    setSending(true)
    setApplyError('')
    try {
      await applyToRoom(roomId, message, session.token)
      setApplied(true)
      setAppStatus({ roomId, status: 'pending' })
    } catch (cause) {
      // 409: el servidor ya tenía la postulación; se trata como enviada.
      if (cause?.status === 409) {
        setApplied(true)
        setAppStatus({ roomId, status: 'pending' })
        return
      }
      setApplyError(cause instanceof Error ? cause.message : 'No se pudo enviar tu postulación.')
    } finally {
      setSending(false)
    }
  }

  const back = (
    <Button className={styles.back} onClick={() => goBack(navigate, '/explorar')} variant="quiet">
      ← Volver a habitaciones
    </Button>
  )

  if (detail.roomId !== roomId) {
    return (
      <section className={styles.page}>
        {back}
        <div className={styles.loading} role="status">Cargando habitación…</div>
      </section>
    )
  }

  if (!detail.room) {
    return (
      <section className={styles.page}>
        {back}
        <Notice tone="error">{detail.error || 'No se encontró la habitación.'}</Notice>
      </section>
    )
  }

  const { room } = detail
  const photos = Array.isArray(room.photos) ? room.photos : []
  const currentPhoto = photos[Math.min(photoIndex, photos.length - 1)]
  const rules = describeRules(room.rules)
  const costItems = Array.isArray(room.costItems) ? room.costItems : []
  const host = hostDetails.roomId === roomId ? hostDetails : null
  const hostName = host?.profile?.fullName
    ?? host?.candidate?.fullName
    ?? 'Anfitrión'
  const hostPhoto = host?.photos.find((photo) => photo.isMain) ?? host?.photos[0]
  const hostPhotoUrl = hostPhoto?.url
    ? apiAssetUrl(hostPhoto.url)
    : host?.candidate?.photoUrl
      ? apiAssetUrl(host.candidate.photoUrl)
      : undefined
  const agreements = agreementsState.roomId === roomId ? agreementsState : null
  const locationUrl = mapUrl(room.location)
  const checkingApplication = appStatus.roomId !== roomId
  const existingStatus = appStatus.roomId === roomId ? appStatus.status : null
  const open = room.status === undefined || room.status === 'published'

  return (
    <section className={styles.page}>
      {back}

      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.gallery}>
            {currentPhoto ? (
              <img
                alt={`Foto ${Math.min(photoIndex, photos.length - 1) + 1} de ${photos.length} de ${room.title}`}
                className={styles.photo}
                src={roomPhotoUrl(room.id, currentPhoto.id)}
              />
            ) : (
              <div className={styles.noPhoto}>Esta habitación aún no tiene fotos</div>
            )}
            {photos.length > 1 ? (
              <ul aria-label="Fotos de la habitación" className={styles.thumbs}>
                {photos.map((photo, index) => (
                  <li key={photo.id}>
                    <button
                      aria-label={`Ver foto ${index + 1}`}
                      aria-pressed={index === photoIndex}
                      className={styles.thumb}
                      onClick={() => setPhotoIndex(index)}
                      type="button"
                    >
                      <img alt="" loading="lazy" src={roomPhotoUrl(room.id, photo.id)} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <header className={styles.header}>
            <h1>{room.title}</h1>
            <p>{formatRoomLocation({ ...room.location, address: room.location?.address })}</p>
            <p className={styles.published}>
              {room.publishedAt ? `Publicado el ${formatShortDate(room.publishedAt)}` : ''}
              {room.updatedAt ? ` · Actualizado el ${formatShortDate(room.updatedAt)}` : ''}
            </p>
          </header>

          <Card as="section" className={styles.block}>
            <h2>Publicado por</h2>
            <Link
              aria-label={`Ver perfil de ${hostName}`}
              className={styles.hostLink}
              to={`/perfil/candidato/${encodeURIComponent(room.hostId)}`}
            >
              <Avatar name={hostName} size="md" src={hostPhotoUrl} />
              <span>
                <strong>{hostName}</strong>
                <span>Ver perfil completo <span aria-hidden="true">→</span></span>
              </span>
            </Link>
            {!host ? <p className={styles.meta} role="status">Cargando el perfil de quien publica…</p> : null}
            {host?.profileError ? (
              <p className={styles.dataError} role="status">No se pudo cargar toda la información del perfil: {host.profileError}</p>
            ) : null}
            {!ownRoom && host?.candidate ? (
              <div className={styles.compatibility}>
                <h3>Compatibilidad contigo</h3>
                {typeof host.candidate.compatibilityScore === 'number' ? (
                  <p className={styles.score}>
                    Afinidad general <Badge tone="accent">{Math.round(host.candidate.compatibilityScore)}%</Badge>
                  </p>
                ) : <p className={styles.meta}>La afinidad general no está disponible.</p>}
                {host.candidate.compatibilitySummary?.length ? (
                  <>
                    <h4>Respuestas del test de quien publica</h4>
                    <p className={styles.meta}>
                      El porcentaje general compara ambos perfiles; este desglose representa sus respuestas, no una comparación por dimensión.
                    </p>
                    <div className={styles.dimensions}>
                      {host.candidate.compatibilitySummary.map(({ dimension, percentage }) => (
                        <div className={styles.dimension} key={dimension}>
                          <strong>{DIMENSIONS[dimension] ?? dimension}</strong>
                          <Meter
                            label={`${DIMENSIONS[dimension] ?? dimension}: ${percentage}% en las respuestas del test`}
                            value={percentage}
                          />
                          <span>{percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={styles.meta}>No hay respuestas por dimensión disponibles para este perfil.</p>
                )}
              </div>
            ) : null}
            {!ownRoom && host?.compatibilityUnavailable ? (
              <p className={styles.meta}>No hay un resumen de compatibilidad disponible para este perfil.</p>
            ) : null}
            {!ownRoom && host?.compatibilityError ? (
              <p className={styles.dataError} role="status">No se pudo consultar la compatibilidad: {host.compatibilityError}</p>
            ) : null}
          </Card>

          <Card as="section" className={styles.block}>
            <h2>Ubicación</h2>
            {room.location?.address ? <p className={styles.text}>{room.location.address}</p> : null}
            {locationUrl ? (
              <a className={styles.textLink} href={locationUrl} rel="noreferrer" target="_blank">
                Abrir ubicación en Google Maps <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            ) : (
              <p className={styles.meta}>No se compartieron coordenadas del mapa.</p>
            )}
          </Card>

          {room.description ? (
            <Card as="div" className={styles.block}>
              <h2>Descripción</h2>
              <p className={styles.text}>{room.description}</p>
            </Card>
          ) : null}

          {rules.length ? (
            <Card as="div" className={styles.block}>
              <h2>Reglas de la casa</h2>
              <dl className={styles.rows}>
                {rules.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          {costItems.length ? (
            <Card as="div" className={styles.block}>
              <h2>Costos</h2>
              <dl className={styles.rows}>
                {costItems.map((item) => (
                  <div key={item.id ?? item.concept}>
                    <dt>
                      {item.concept} <small>({formatCostKind(item.kind)})</small>
                    </dt>
                    <dd>
                      {item.isIncluded ? 'Incluido' : formatCostAmount(item.amount)}
                      {item.isProrated ? ' · prorrateado' : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          <Card as="section" className={styles.block}>
            <h2>Acuerdos asociados</h2>
            {agreements?.loading || !agreements ? (
              <p className={styles.meta} role="status">Consultando acuerdos…</p>
            ) : agreements.error ? (
              <Notice tone="error">{agreements.error}</Notice>
            ) : agreements.items.length ? (
              <div className={styles.agreements}>
                {agreements.items.map((agreement) => {
                  const participants = [...new Set([agreement.hostId, ...(agreement.roomieIds ?? [])])]
                  const accepted = (agreement.acceptances ?? []).filter((item) => item.acceptedAt).length
                  const snapshotRules = describeRules(agreement.rulesSnapshot)
                  const snapshotCosts = Array.isArray(agreement.rulesSnapshot?.costs)
                    ? agreement.rulesSnapshot.costs
                    : []
                  return (
                    <article className={styles.agreement} key={agreement.id}>
                      <div className={styles.agreementHeader}>
                        <div>
                          <h3>Versión {agreement.version}</h3>
                          <p className={styles.meta}>
                            Creado el {formatShortDate(agreement.createdAt)} · {accepted} de {participants.length} aceptaciones
                          </p>
                        </div>
                        <Badge tone={agreement.fullyAccepted ? 'success' : 'warning'}>
                          {agreement.fullyAccepted ? 'Aceptado por todos' : 'Pendiente'}
                        </Badge>
                      </div>
                      <details className={styles.terms}>
                        <summary>Ver condiciones de esta versión</summary>
                        {snapshotRules.length ? (
                          <dl className={styles.rows}>
                            {snapshotRules.map(({ label, value }) => (
                              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                            ))}
                          </dl>
                        ) : null}
                        {snapshotCosts.length ? (
                          <dl className={styles.rows}>
                            {snapshotCosts.map((item, index) => (
                              <div key={item.id ?? item.concept ?? index}>
                                <dt>{item.concept ?? 'Costo'} <small>({formatCostKind(item.kind)})</small></dt>
                                <dd>{item.isIncluded ? 'Incluido' : formatCostAmount(item.amount)}{item.isProrated ? ' · prorrateado' : ''}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        {agreement.rulesSnapshot?.commonAreasNotes ? (
                          <p className={styles.text}>{agreement.rulesSnapshot.commonAreasNotes}</p>
                        ) : null}
                        {agreement.rulesSnapshot?.extraRules ? (
                          <p className={styles.text}>{agreement.rulesSnapshot.extraRules}</p>
                        ) : null}
                      </details>
                      <Link className={styles.textLink} to={`/acuerdos/revisar/${encodeURIComponent(agreement.id)}`}>
                        Abrir acuerdo
                      </Link>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className={styles.meta}>
                {ownRoom
                  ? 'Esta publicación todavía no tiene acuerdos asociados.'
                  : 'No tienes acuerdos asociados a esta publicación.'}
              </p>
            )}
          </Card>
        </div>

        <aside className={styles.side}>
          <Card as="div" className={styles.block}>
            <p className={styles.price}>{formatRent(room.monthlyRent)}</p>
            <p className={styles.meta}>{formatAvailability(room.availableFrom)}</p>
            <p className={styles.meta}>{formatRoommates(room.maxRoommates)}</p>

            {ownRoom ? (
              <Notice tone="info">Esta es tu propia publicación.</Notice>
            ) : !open ? (
              <Notice tone="warning">Esta habitación ya no recibe postulaciones.</Notice>
            ) : existingStatus || applied ? (
              <Notice tone="success">
                {describeApplicationStatus(existingStatus ?? 'pending')}. El anfitrión la
                revisará y te responderá.
              </Notice>
            ) : checkingApplication ? (
              <p className={styles.meta} role="status">Comprobando tu postulación…</p>
            ) : (
              <form className={styles.form} onSubmit={handleApply}>
                <Field
                  hint={`Opcional · ${message.length}/${MESSAGE_MAX_LENGTH}`}
                  htmlFor="apply-message"
                  label="Mensaje para el anfitrión"
                >
                  <textarea
                    maxLength={MESSAGE_MAX_LENGTH}
                    name="message"
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Cuéntale brevemente quién eres y por qué te interesa…"
                    rows={4}
                    value={message}
                  />
                </Field>
                {applyError ? <Notice tone="error">{applyError}</Notice> : null}
                <Button aria-busy={sending} disabled={sending} type="submit">
                  {sending ? 'Enviando…' : 'Postularme'}
                </Button>
              </form>
            )}
          </Card>
        </aside>
      </div>
    </section>
  )
}

RoomDetail.propTypes = {
  roomId: PropTypes.string.isRequired,
}
