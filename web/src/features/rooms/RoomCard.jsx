import PropTypes from 'prop-types'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar/Avatar.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Card from '../../components/Card/Card.jsx'
import { apiAssetUrl } from '../../services/api.js'
import {
  describeApplicationStatus,
  formatAvailability,
  formatHostName,
  formatRent,
  formatRoomLocation,
  roomCoverUrl,
} from './rooms.js'
import styles from './RoomCard.module.css'

export default function RoomCard({
  applicationStatus,
  hostProfile,
  hostProfileError,
  hostProfileLoading,
  onOpen,
  room,
}) {
  const [coverFailed, setCoverFailed] = useState(false)
  const hasCover = room.photosCount > 0 && !coverFailed
  const hostName = formatHostName(room)

  return (
    <Card className={styles.card}>
      <button
        aria-label={`Ver habitación ${room.title}`}
        className={styles.open}
        onClick={onOpen}
        type="button"
      >
        <div className={styles.cover}>
          {hasCover ? (
            <img
              alt=""
              className={styles.image}
              height="240"
              loading="lazy"
              onError={() => setCoverFailed(true)}
              src={roomCoverUrl(room.id)}
              width="400"
            />
          ) : (
            <span aria-hidden="true" className={styles.placeholder}>Sin fotos</span>
          )}
          <span className={styles.price}>{formatRent(room.monthlyRent)}</span>
          {applicationStatus ? (
            <span className={styles.applied}>{describeApplicationStatus(applicationStatus)}</span>
          ) : null}
        </div>

        <div className={styles.body}>
          <h2 className={styles.title}>{room.title}</h2>
          <p className={styles.location}>{formatRoomLocation(room)}</p>
          <p className={styles.meta}>{formatAvailability(room.availableFrom)}</p>
        </div>
      </button>
      <div className={styles.host}>
        <Link
          aria-label={`Ver perfil de ${hostName}`}
          className={styles.hostProfile}
          to={`/perfil/candidato/${encodeURIComponent(room.hostId)}`}
        >
          <Avatar
            className={styles.hostAvatar}
            name={hostName}
            size="sm"
            src={hostProfile?.photoUrl ? apiAssetUrl(hostProfile.photoUrl) : undefined}
          />
          <span>Publica {hostName}</span>
        </Link>
        {hostProfileLoading ? (
          <span className={styles.unavailable} role="status">Cargando afinidad…</span>
        ) : typeof hostProfile?.compatibilityScore === 'number' ? (
          <Badge tone="accent">{Math.round(hostProfile.compatibilityScore)}% afín</Badge>
        ) : (
          <span className={styles.unavailable}>
            {hostProfileError ? 'No se pudo consultar la afinidad' : 'Afinidad no disponible'}
          </span>
        )}
      </div>
    </Card>
  )
}

RoomCard.propTypes = {
  applicationStatus: PropTypes.string,
  hostProfile: PropTypes.shape({
    compatibilityScore: PropTypes.number,
    photoUrl: PropTypes.string,
  }),
  hostProfileError: PropTypes.string,
  hostProfileLoading: PropTypes.bool,
  onOpen: PropTypes.func.isRequired,
  room: PropTypes.shape({
    availableFrom: PropTypes.string,
    hostId: PropTypes.string.isRequired,
    hostName: PropTypes.string,
    id: PropTypes.string.isRequired,
    monthlyRent: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    photosCount: PropTypes.number,
    title: PropTypes.string.isRequired,
  }).isRequired,
}
