import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useRoomLinkQuery } from '../../hooks/useRoomLinkQuery.js'
import { apiAssetUrl, apiRequest } from '../../services/api.js'
import { FeatureHeading, FeatureNotice } from '../cesar-ui.jsx'
import { Feedback, Panel } from '../roomlink/Workspace.jsx'
import { QueryStatus } from './Applications.jsx'
import { AddressSearch } from './ListingGeolocation.jsx'
import { MapPanel } from './MapPanel.jsx'
import { EditListingTerms, ListingTerms } from './ListingRules.jsx'
import { coordinates, hostLink, listingStatuses, money, roomLink, roomPath, roomsPath } from './listings.js'

export function HostListings() {
  const { session } = useAuth()
  const [version, setVersion] = useState(0)
  const host = session.user.roles?.includes('host')
  const query = useRoomLinkQuery(host ? roomsPath + '/host/' + encodeURIComponent(session.user.id) : null, session.token, version)

  return (
    <section className="listing-page">
      <FeatureHeading title="Mis habitaciones" description="Administra tus anuncios y revisa quién quiere postularse.">
        <Link className="button button-mint" to={host ? '/anfitrion/habitaciones/nueva' : '/perfil/cuenta'}>
          {host ? 'Nueva habitación' : 'Activar cuenta de anfitrión'}
        </Link>
      </FeatureHeading>
      <QueryStatus query={query} onRetry={() => setVersion((current) => current + 1)} />
      {query.data?.length === 0 && !query.error && <FeatureNotice>Aún no tienes habitaciones.</FeatureNotice>}
      <div className="room-stack">{query.data?.map((room) => (
        <article className="room-panel listing-row" key={room.id}>
          <div>
            <h2><Link to={hostLink(room.id)}>{room.title}</Link></h2>
            <p className="muted">{money(room.monthlyRent)} al mes · {listingStatuses[room.status]}</p>
          </div>
          <div className="feature-actions">
            <Link className="button button-subtle" to={hostLink(room.id)}>Gestionar anuncio</Link>
            <Link className="button button-mint" to={hostLink(room.id) + '/postulaciones'}>Ver postulaciones</Link>
          </div>
        </article>
      ))}</div>
    </section>
  )
}

function ListingForm({ room, token, onSaved }) {
  const [loc, setLoc] = useState(() => ({
    address: room?.location?.address || '',
    latitude: room?.location?.latitude ?? '',
    longitude: room?.location?.longitude ?? '',
  }))
  const [photos, setPhotos] = useState(room?.photos || [])
  const [files, setFiles] = useState([])
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')

  function changeLocation(event) {
    const { name, value } = event.target
    setLoc((current) => ({ ...current, [name]: value }))
  }

  function choosePhotos(event) {
    const selected = Array.from(event.target.files)
    setPhotoError('')
    setFiles([])
    if (selected.length + photos.length > 10) {
      setPhotoError('Puedes guardar hasta 10 fotos por habitación.')
      event.target.value = ''
      return
    }
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setPhotoError('Usa archivos JPG, PNG o WebP de hasta 8 MB cada uno.')
      event.target.value = ''
      return
    }
    setFiles(selected)
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    if (!coordinates(loc) || loc.address.trim().length < 3) {
      setError('Indica una dirección y selecciona el punto en el mapa.')
      return
    }
    if (photoError || files.length + photos.length > 10) return
    if (room && room.status !== 'draft' && files.length + photos.length < 3) {
      setError('Conserva al menos 3 fotos en una habitación publicada.')
      return
    }

    const body = new FormData(event.currentTarget)
    body.set('address', loc.address.trim())
    body.set('latitude', loc.latitude)
    body.set('longitude', loc.longitude)
    if (room) {
      body.set('photosOrder', JSON.stringify([
        ...photos.map(({ id }) => ({ type: 'existing', id })),
        ...files.map((_, fileIndex) => ({ type: 'new', fileIndex })),
      ]))
    }
    files.forEach((file) => body.append('photos', file))

    setWorking(true)
    try {
      const result = await apiRequest(room ? roomPath(room.id) : roomsPath, { token, method: room ? 'PATCH' : 'POST', body })
      onSaved(result.room || result)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <form className="listing-form room-panel" onSubmit={save}>
      <fieldset className="listing-fields" disabled={working}>
        <legend>Datos de la habitación</legend>
        <label>Título<input name="title" required minLength={5} maxLength={200} defaultValue={room?.title} /></label>
        <label>Renta mensual en MXN<input name="monthlyRent" type="number" required min="0.01" max="99999999.99" step="0.01" defaultValue={room?.monthlyRent} /></label>
        <label>Disponible a partir de<input name="availableFrom" type="date" required defaultValue={room?.availableFrom} /></label>
        <label>Máximo de habitantes<input name="maxRoommates" type="number" min="1" max="100" step="1" defaultValue={room?.maxRoommates} /></label>
        <label className="listing-wide">Descripción<textarea name="description" required maxLength={5000} defaultValue={room?.description} /></label>
      </fieldset>
      <fieldset disabled={working}>
        <legend>Ubicación</legend>
        <AddressSearch disabled={working} token={token} onSelect={({ label, latitude, longitude }) => {
          setLoc({ address: label, latitude, longitude })
        }} />
        <label>Dirección<input name="address" required minLength={3} maxLength={500} onChange={changeLocation} value={loc.address} /></label>
        <p className="muted" id="listing-location-help">Selecciona un punto en el mapa o escribe las coordenadas.</p>
        <MapPanel location={loc} onPick={working ? undefined : (latitude, longitude) => setLoc((current) => ({ ...current, latitude, longitude }))} />
        <div className="listing-fields" aria-describedby="listing-location-help">
          <label>Latitud<input autoComplete="off" inputMode="decimal" name="latitude" onChange={changeLocation} required type="number" min="-90" max="90" step="any" value={loc.latitude} /></label>
          <label>Longitud<input autoComplete="off" inputMode="decimal" name="longitude" onChange={changeLocation} required type="number" min="-180" max="180" step="any" value={loc.longitude} /></label>
        </div>
      </fieldset>
      <fieldset disabled={working}>
        <legend>Fotos de la habitación</legend>
        <p className="muted">Elige entre 3 y 10 fotos para publicar. Puedes continuar con menos si vas a guardar un borrador.</p>
        {photos.length > 0 && <div className="listing-gallery">
          {photos.map((photo, index) => <div key={photo.id}>
            <img alt={`Foto actual ${index + 1}`} src={apiAssetUrl(roomPath(room.id) + '/photos/' + encodeURIComponent(photo.id))} />
            <button className="button button-rose" type="button" onClick={() => setPhotos((items) => items.filter(({ id }) => id !== photo.id))}>Quitar foto {index + 1}</button>
          </div>)}
        </div>}
        <label>Agregar fotos<input accept="image/jpeg,image/png,image/webp" multiple onChange={choosePhotos} type="file" /></label>
        <p role="status">{photos.length + files.length} fotos seleccionadas</p>
      </fieldset>
      <Feedback error={error || photoError} />
      <button className="button button-mint" disabled={working} type="submit">{working ? 'Guardando…' : room ? 'Guardar datos del anuncio' : 'Guardar y continuar a reglas y costos'}</button>
    </form>
  )
}

export function NewListing() {
  const { session } = useAuth()
  const navigate = useNavigate()
  return (
    <section className="listing-page">
      <Link className="access-link" to="/anfitrion">Volver a mis habitaciones</Link>
      <FeatureHeading title="Nueva habitación" description="Agrega los datos del anuncio. Después podrás completar las reglas y los costos." />
      {session.user.roles?.includes('host') ? (
        <ListingForm token={session.token} onSaved={(room) => navigate(hostLink(room.id), { replace: true })} />
      ) : <Link className="button button-mint" to="/perfil/cuenta">Activar cuenta de anfitrión</Link>}
    </section>
  )
}

function ManageListing({ room, token, refresh }) {
  const [mode, setMode] = useState('terms')
  const [reviewed, setReviewed] = useState(false)
  const [working, setWorking] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updatedStatus, setUpdatedStatus] = useState(null)
  const status = updatedStatus || room.status
  const [photoCount, setPhotoCount] = useState(room.photosCount)

  async function changeStatus(action) {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(roomPath(room.id) + '/' + action, { token, method: 'PATCH' })
      setUpdatedStatus((result.room || result).status)
      setNotice(result.message || 'Estado del anuncio actualizado.')
      setConfirmation(false)
      refresh()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <FeatureHeading title={room.title} description={listingStatuses[status]}>
        <div className="feature-actions">
          <Link className="button button-subtle" to={roomLink(room.id)}>Ver anuncio</Link>
          <Link className="button button-mint" to={hostLink(room.id) + '/postulaciones'}>Ver postulaciones</Link>
        </div>
      </FeatureHeading>
      {status !== 'closed' && <nav className="feature-actions" aria-label="Edición del anuncio">
        <button aria-pressed={mode === 'details'} className="button button-subtle" onClick={() => setMode('details')} type="button">Datos y fotos</button>
        <button aria-pressed={mode === 'terms'} className="button button-subtle" onClick={() => setMode('terms')} type="button">Reglas y costos</button>
      </nav>}
      {status === 'closed' ? <ListingTerms room={room} /> : mode === 'details' ? (
        <ListingForm room={room} token={token} onSaved={(updated) => {
          setPhotoCount(updated.photosCount)
          setReviewed(false)
          setMode('terms')
          refresh()
        }} />
      ) : <EditListingTerms room={room} token={token} onEdit={() => setReviewed(false)} onSaved={() => { setReviewed(true); refresh() }} />}
      <Feedback error={error}>{notice}</Feedback>
      {status === 'draft' && <Panel title="Publicar habitación">
        <p>Guarda las reglas y los costos para revisar la información antes de publicar.</p>
        {photoCount < 3 && <p role="status">{photoCount === 2 ? 'Falta una foto para publicar.' : `Faltan ${3 - photoCount} fotos para publicar.`}</p>}
        <button className="button button-mint" disabled={working || !reviewed || mode !== 'terms' || photoCount < 3} onClick={() => changeStatus('publish')} type="button">Publicar habitación</button>
      </Panel>}
      {['published', 'paused'].includes(status) && <Panel title="Disponibilidad del anuncio">
        <div className="feature-actions">
          <button className={`button button-${status === 'published' ? 'rose' : 'mint'}`} disabled={working} type="button" onClick={() => changeStatus(status === 'published' ? 'pause' : 'reactivate')}>{status === 'published' ? 'Pausar anuncio' : 'Reactivar anuncio'}</button>
          <button className="button button-rose" disabled={working} type="button" onClick={() => setConfirmation(true)}>Cerrar anuncio</button>
        </div>
        {confirmation && <div className="room-stack">
          <p>Al cerrar el anuncio dejará de recibir postulaciones. ¿Confirmas el cierre?</p>
          <div className="feature-actions">
            <button className="button button-rose" disabled={working} type="button" onClick={() => changeStatus('close')}>Confirmar cierre</button>
            <button className="button button-subtle" disabled={working} type="button" onClick={() => setConfirmation(false)}>Cancelar</button>
          </div>
        </div>}
      </Panel>}
    </>
  )
}

export function ManageListingPage() {
  const { listingId } = useParams()
  const { session } = useAuth()
  const [version, setVersion] = useState(0)
  const query = useRoomLinkQuery(roomPath(listingId), session.token, version)
  const refresh = () => setVersion((current) => current + 1)

  return (
    <section className="listing-page">
      <Link className="access-link" to="/anfitrion">Volver a mis habitaciones</Link>
      <QueryStatus query={query} onRetry={refresh} />
      {query.data && (query.data.hostId === session.user.id
        ? <ManageListing key={listingId} room={query.data} token={session.token} refresh={refresh} />
        : <FeatureNotice error="Solo el anfitrión puede editar este anuncio." />)}
    </section>
  )
}
