import PropTypes from 'prop-types'
import { useState } from 'react'
import Badge from '../../components/Badge/Badge.jsx'
import Card from '../../components/Card/Card.jsx'
import {
  describeApplicationStatus,
  formatAvailability,
  formatHostName,
  formatRent,
  formatRoomLocation,
  roomCoverUrl,
} from './rooms.js'
import styles from './RoomCard.module.css'

export default function RoomCard({ applicationStatus, compatibility, onOpen, room }) {
  const [coverFailed, setCoverFailed] = useState(false)
  const hasCover = room.photosCount > 0 && !coverFailed

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

          <div className={styles.host}>
            <span>Publica {formatHostName(room)}</span>
            {typeof compatibility === 'number' ? (
              <Badge tone="accent">{compatibility}% afín</Badge>
            ) : null}
          </div>
        </div>
      </button>
    </Card>
  )
}

RoomCard.propTypes = {
  applicationStatus: PropTypes.string,
  compatibility: PropTypes.number,
  onOpen: PropTypes.func.isRequired,
  room: PropTypes.shape({
    availableFrom: PropTypes.string,
    hostName: PropTypes.string,
    id: PropTypes.string.isRequired,
    monthlyRent: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    photosCount: PropTypes.number,
    title: PropTypes.string.isRequired,
  }).isRequired,
}
