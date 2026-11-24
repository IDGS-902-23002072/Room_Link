import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useRoomLinkQuery } from '../../hooks/useRoomLinkQuery.js'
import { apiAssetUrl } from '../../services/api.js'
import { FeatureHeading, FeatureNotice } from '../cesar-ui.jsx'
import { Panel } from '../roomlink/Workspace.jsx'
import { ApplyToRoom, QueryStatus } from './Applications.jsx'
import { ListingTerms } from './ListingRules.jsx'
import { NearbyMap } from './ListingGeolocation.jsx'
import { hostLink, listingStatuses, money, roomLink, roomPath, roomsPath } from './listings.js'

const zoneLabel = (room) => [room.zone, room.city].filter(Boolean).join(', ') || room.address

function RoomCard({ room }) {
  return (
    <article className="room-panel listing-card">
      {room.photosCount > 0 && <img alt="" className="listing-cover" loading="lazy" src={apiAssetUrl(roomPath(room.id) + '/photos/first')} />}
      <div className="listing-card-body">
        <p className="listing-price">{money(room.monthlyRent)} <small>al mes</small></p>
        <h2><Link to={roomLink(room.id)}>{room.title}</Link></h2>
        {zoneLabel(room) && <p className="muted">{zoneLabel(room)}</p>}
        {room.description && <p className="listing-excerpt">{room.description}</p>}
        <Link className="button button-mint" to={roomLink(room.id)} aria-label={`Ver habitación: ${room.title}`}>Ver habitación</Link>
      </div>
    </article>
  )
}

export function ListingDirectory() {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [version, setVersion] = useState(0)
  const q = params.get('q') || ''
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1)
  const queryParams = new URLSearchParams({ q, page, excludeHostId: session.user.id })
  const query = useRoomLinkQuery(roomsPath + '/feed?' + queryParams, session.token, version)
  const turn = (to) => setParams({ ...(q ? { q } : {}), ...(to > 1 ? { page: to } : {}) })

  return (
    <section className="listing-page">
      <FeatureHeading title="Explorar habitaciones" description="Encuentra un lugar para compartir y revisa la ubicación, las reglas y los costos antes de postularte.">
        <Link className="button button-subtle" to="/mis-postulaciones">Mis postulaciones</Link>
      </FeatureHeading>
      <form className="listing-search" key={q} onSubmit={(event) => {
        event.preventDefault()
        const search = new FormData(event.currentTarget).get('q').trim()
        setParams(search ? { q: search } : {})
      }}>
        <label>Zona, ciudad o nombre<input name="q" type="search" defaultValue={q} /></label>
        <button className="button button-mint">Buscar</button>
        {q && <button className="button button-rose" type="button" onClick={() => setParams({})}>Limpiar búsqueda</button>}
      </form>
      <QueryStatus query={query} onRetry={() => setVersion((current) => current + 1)} />
      {!query.error && query.data?.items.length === 0 && <FeatureNotice>No encontramos habitaciones para esta búsqueda.</FeatureNotice>}
      <div className="listing-grid">{query.data?.items.map((room) => <RoomCard key={room.id} room={room} />)}</div>
      {(page > 1 || query.data?.hasMore) && <nav className="feature-actions" aria-label="Páginas de habitaciones">
        <button className="button button-subtle" disabled={page === 1 || query.loading} onClick={() => turn(page - 1)} type="button">Anterior</button>
        <span>Página {page}</span>
        <button className="button button-mint" disabled={!query.data?.hasMore} onClick={() => turn(page + 1)} type="button">Siguiente</button>
      </nav>}
    </section>
  )
}

function ListingAffinity({ room, session }) {
  const query = useRoomLinkQuery('/api/v1/compatibility/' + encodeURIComponent(session.user.id) + '/candidates/' + encodeURIComponent(room.hostId), session.token)
  const candidate = query.data
  if (!candidate) return null
  return (
    <Panel title="Afinidad con el anfitrión">
      {candidate.compatibilityScore == null ? <p className="muted">La afinidad estará disponible cuando ambos hayan completado el test.</p> : <p className="listing-price">{Math.round(candidate.compatibilityScore)}% de afinidad</p>}
      <Link className="access-link" to={'/perfil/candidato/' + encodeURIComponent(room.hostId)}>Ver perfil y compatibilidad</Link>
    </Panel>
  )
}

export function ListingDetail() {
  const { listingId } = useParams()
  const { session } = useAuth()
  const [version, setVersion] = useState(0)
  const query = useRoomLinkQuery(roomPath(listingId), session.token, version)
  const room = query.data
  const own = room?.hostId === session.user.id
  const showRoom = room && (own || room.status !== 'draft')

  return (
    <section className="listing-page">
      <Link className="access-link" to="/habitaciones">Volver a habitaciones</Link>
      <QueryStatus query={query} onRetry={() => setVersion((current) => current + 1)} />
      {room && !showRoom && <FeatureNotice error="Esta habitación aún no está publicada." />}
      {showRoom && <>
        <FeatureHeading title={room.title} description={`${money(room.monthlyRent)} al mes · ${listingStatuses[room.status]}`}>
          {own && <Link className="button button-mint" to={hostLink(room.id)}>Gestionar anuncio</Link>}
        </FeatureHeading>
        {room.photos?.length > 0 && <div className="listing-gallery" aria-label="Fotos de la habitación">
          {room.photos.map((photo, index) => <a key={photo.id} href={apiAssetUrl(roomPath(room.id) + '/photos/' + encodeURIComponent(photo.id))} target="_blank" rel="noreferrer">
            <img loading="lazy" alt={`Foto ${index + 1} de ${room.title}`} src={apiAssetUrl(roomPath(room.id) + '/photos/' + encodeURIComponent(photo.id))} />
          </a>)}
        </div>}
        {room.description && <p className="listing-description">{room.description}</p>}
        <Panel title="Ubicación">
          {room.location?.address && <p>{room.location.address}</p>}
          <NearbyMap key={room.id} room={room} token={session.token} />
        </Panel>
        <ListingTerms room={room} />
        {!own && <>
          <ListingAffinity room={room} session={session} />
          <ApplyToRoom key={room.id} room={room} token={session.token} />
          <Link className="access-link" to={'/anuncios/' + encodeURIComponent(room.id) + '/denunciar'}>Denunciar anuncio</Link>
        </>}
      </>}
    </section>
  )
}
