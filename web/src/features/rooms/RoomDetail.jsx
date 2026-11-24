import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { useAuth } from '../../hooks/useAuth.js'
import { goBack } from '../../routes/navigation.js'
import {
  applyToRoom,
  describeRules,
  formatAvailability,
  formatCostKind,
  formatRent,
  formatRoommates,
  formatRoomLocation,
  getHostCompatibility,
  getRoom,
  roomPhotoUrl,
} from './rooms.js'
import styles from './RoomDetail.module.css'

const MESSAGE_MAX_LENGTH = 500

export default function RoomDetail({ roomId }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState({ roomId: null, room: null, error: '' })
  const [score, setScore] = useState(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [applied, setApplied] = useState(false)
  const [applyError, setApplyError] = useState('')

  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const room = await getRoom(roomId)
        if (isActive()) setDetail({ roomId, room, error: '' })
        const hostScore = await getHostCompatibility(session.user.id, room.hostId, session.token)
        if (isActive()) setScore(hostScore)
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
    [roomId, session.token, session.user.id],
  )

  async function handleApply(event) {
    event.preventDefault()
    if (sending || applied) return
    setSending(true)
    setApplyError('')
    try {
      await applyToRoom(roomId, message, session.token)
      setApplied(true)
    } catch (cause) {
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
  const ownRoom = room.hostId === session.user.id
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
          </header>

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
                      {item.isIncluded ? 'Incluido' : formatRent(item.amount)}
                      {item.isProrated ? ' · prorrateado' : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>

        <aside className={styles.side}>
          <Card as="div" className={styles.block}>
            <p className={styles.price}>{formatRent(room.monthlyRent)}</p>
            <p className={styles.meta}>{formatAvailability(room.availableFrom)}</p>
            <p className={styles.meta}>{formatRoommates(room.maxRoommates)}</p>
            {typeof score === 'number' ? (
              <p className={styles.meta}>
                Afinidad con el anfitrión <Badge tone="accent">{Math.round(score)}%</Badge>
              </p>
            ) : null}

            {ownRoom ? (
              <Notice tone="info">Esta es tu propia publicación.</Notice>
            ) : !open ? (
              <Notice tone="warning">Esta habitación ya no recibe postulaciones.</Notice>
            ) : applied ? (
              <Notice tone="success">
                Tu postulación fue enviada. El anfitrión la revisará y te responderá.
              </Notice>
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
