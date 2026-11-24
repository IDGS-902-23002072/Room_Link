import { useState } from 'react'
import { apiRequest } from '../../services/api.js'
import { Feedback } from '../roomlink/Workspace.jsx'
import { MapPanel } from './MapPanel.jsx'
import { coordinates } from './listings.js'

const path = '/api/v1/geolocation'
const categories = {
  supermarket: 'Supermercado', pharmacy: 'Farmacia', hospital: 'Hospital',
  university: 'Universidad', bus_stop: 'Parada de autobús', station: 'Estación',
}
const osmCredit = <p className="muted">Datos de <a className="access-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></p>

export function AddressSearch({ disabled, onSelect, token }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function search() {
    setError('')
    setResults(null)
    setBusy(true)
    try {
      const params = new URLSearchParams({ q: query.trim() })
      const result = await apiRequest(path + '/search?' + params, { token })
      setResults(result.items)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="room-stack">
    <div className="listing-search">
      <label>Buscar dirección o colonia
        <input disabled={disabled || busy} type="search" maxLength={120} value={query} onChange={(event) => {
          setQuery(event.target.value)
          setResults(null)
          setError('')
        }} onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          event.preventDefault()
          if (!disabled && !busy && query.trim().length >= 3) void search()
        }} />
      </label>
      <button className="button button-mint" disabled={disabled || busy || query.trim().length < 3} onClick={search} type="button">
        {busy ? 'Buscando…' : 'Buscar en el mapa'}
      </button>
    </div>
    <p className="muted">Usa una calle, colonia o referencia pública para ubicar la zona.</p>
    <Feedback error={error}>{results?.length === 0 ? 'No encontramos esa dirección. Puedes ajustar la búsqueda o marcar el mapa.' : ''}</Feedback>
    {results?.length > 0 && <ul aria-label="Direcciones encontradas" className="listing-location-results">
      {results.map((item) => <li key={`${item.latitude},${item.longitude},${item.label}`}>
        <button className="button button-subtle" disabled={disabled} type="button" onClick={() => {
          onSelect(item)
          setResults(null)
        }}>{item.label}</button>
      </li>)}
    </ul>}
    {osmCredit}
  </div>
}

export function NearbyMap({ room, token }) {
  const [nearby, setNearby] = useState(null)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const point = coordinates(room.location)

  async function load() {
    setBusy(true)
    setError('')
    try {
      setNearby(await apiRequest(path + '/rooms/' + encodeURIComponent(room.id) + '/nearby', { token }))
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  if (!point) return <p className="muted">La ubicación de esta habitación no está disponible en el mapa.</p>
  const places = nearby?.items.map((item) => ({ ...item, label: item.label || categories[item.category] }))

  return <>
    <MapPanel location={room.location} places={places} selected={selected} />
    <a className="access-link" href={`https://www.openstreetmap.org/?mlat=${point[0]}&mlon=${point[1]}#map=16/${point[0]}/${point[1]}`} target="_blank" rel="noreferrer">Abrir en OpenStreetMap</a>
    {room.status === 'published' && !nearby && <div>
      <button className="button button-mint" disabled={busy} onClick={load} type="button">{busy ? 'Buscando…' : 'Ver lugares cercanos'}</button>
    </div>}
    <Feedback error={error} />
    {nearby && <section className="room-stack" aria-label="Lugares cercanos">
      <h3>Lugares cercanos</h3>
      <p className="muted">Distancias aproximadas en línea recta, hasta {nearby.radiusMeters / 1000} km.</p>
      {places.length ? <ul className="listing-location-results">
        {places.map((place) => <li key={place.id}>
          <button className="button button-subtle" aria-pressed={selected === place.id} onClick={() => setSelected(place.id)} type="button">
            {place.label} · {place.distanceMeters} m
          </button>
        </li>)}
      </ul> : <p role="status">No se encontraron lugares en el área.</p>}
      {osmCredit}
    </section>}
  </>
}
