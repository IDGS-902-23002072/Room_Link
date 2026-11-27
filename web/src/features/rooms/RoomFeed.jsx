import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCandidate } from '../compatibility/compatibility.js'
import LoadingState from '../../components/LoadingState/LoadingState.jsx'
import Button from '../../components/Button/Button.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import ExploreHero from './ExploreHero.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { useAuth } from '../../hooks/useAuth.js'
import { push } from '../../routes/navigation.js'
import RoomCard from './RoomCard.jsx'
import {
  RENT_FILTERS,
  getMyApplications,
  getRoomFeed,
  indexApplications,
} from './rooms.js'
import styles from './RoomFeed.module.css'

const SEARCH_DEBOUNCE_MS = 350

export default function RoomFeed() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [rentId, setRentId] = useState('any')
  const [feedState, setFeedState] = useState({ key: '', result: null, error: '' })
  const [hostProfiles, setHostProfiles] = useState({})
  const [applications, setApplications] = useState({})

  const maxRent = RENT_FILTERS.find((filter) => filter.id === rentId)?.maxRent
  const key = `${page}|${search}|${rentId}`
  const userId = session.user.id
  const token = session.token

  // Búsqueda con espera para no consultar en cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const result = await getRoomFeed({ page, search, maxRent, excludeHostId: userId })
        if (isActive()) setFeedState({ key, result, error: '' })
      } catch (cause) {
        if (isActive()) {
          setFeedState({
            key,
            result: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar el feed.',
          })
        }
      }
    }),
    [key, maxRent, page, search, userId],
  )

  const loading = feedState.key !== key
  const items = loading ? [] : (feedState.result?.items ?? [])
  const error = loading ? '' : feedState.error

  // Postulaciones propias, para marcar las habitaciones a las que ya me postulé.
  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const mine = indexApplications(await getMyApplications(token))
        if (isActive()) setApplications(mine)
      } catch {
        // El feed funciona sin la marca si esta consulta falla.
      }
    }),
    [token],
  )

  // El candidato incluye foto y resumen de afinidad, además del puntaje.
  useEffect(
    () => asyncEffect(async (isActive) => {
      const hostIds = [...new Set(items.map((room) => room.hostId))].filter(
        (hostId) => !(hostId in hostProfiles),
      )
      if (hostIds.length === 0) return
      const entries = await Promise.all(
        hostIds.map(async (hostId) => {
          try {
            return [hostId, { profile: await getCandidate(userId, hostId, token), error: '' }]
          } catch (cause) {
            return [
              hostId,
              {
                profile: null,
                error: cause instanceof Error ? cause.message : 'No se pudo consultar el perfil.',
              },
            ]
          }
        }),
      )
      if (isActive()) setHostProfiles((current) => ({ ...current, ...Object.fromEntries(entries) }))
    }),
    // `hostProfiles` se omite: solo se piden anfitriones que aún no están.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, token, userId],
  )

  const filtered = search !== '' || rentId !== 'any'

  function clearFilters() {
    setSearchInput('')
    setSearch('')
    setRentId('any')
    setPage(1)
  }

  return (
    <section className={styles.page}>
      <ExploreHero />

      <div className={styles.toolbar} id="room-results">
        <div className={styles.search}>
          <label className="sr-only" htmlFor="room-search">Buscar habitaciones</label>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            autoComplete="off"
            id="room-search"
            name="search"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por título, zona o ciudad…"
            spellCheck={false}
            type="search"
            value={searchInput}
          />
        </div>

        <Field htmlFor="room-rent" label="Renta" variant="inline">
          <select
            autoComplete="off"
            id="room-rent"
            name="rent"
            onChange={(event) => {
              setRentId(event.target.value)
              setPage(1)
            }}
            value={rentId}
          >
            {RENT_FILTERS.map((filter) => (
              <option key={filter.id} value={filter.id}>{filter.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className={styles.results}>
      <div className={styles.resultsHeading}><div><p className="eyebrow">ENCUENTRA TU LUGAR</p><h2>Habitaciones para descubrir</h2></div><Button href="/cuestionario" variant="quiet">Mejorar mis recomendaciones</Button></div>
      {error ? <Notice tone="error">{error}</Notice> : null}

      {loading ? (
        <LoadingState label="Buscando tu próximo espacio…" cards />
      ) : items.length ? (
        <div className={styles.grid}>
          {items.map((room) => (
            <RoomCard
              applicationStatus={applications[room.id]}
              key={room.id}
              hostProfile={hostProfiles[room.hostId]?.profile ?? undefined}
              hostProfileError={hostProfiles[room.hostId]?.error ?? ''}
              hostProfileLoading={!(room.hostId in hostProfiles)}
              onOpen={() => push(navigate, `/habitacion/${encodeURIComponent(room.id)}`)}
              room={room}
            />
          ))}
        </div>
      ) : error ? null : (
        <EmptyState
          action={
            filtered ? (
              <Button onClick={clearFilters} variant="secondary">Limpiar filtros</Button>
            ) : null
          }
          description={
            filtered
              ? 'Prueba con otra búsqueda o ajusta el precio para ver más resultados.'
              : 'Vuelve más tarde para descubrir nuevas habitaciones.'
          }
          title={filtered ? 'No encontramos habitaciones' : 'Aún no hay habitaciones publicadas'}
        />
      )}

      {!loading && (page > 1 || feedState.result?.hasMore) ? (
        <nav aria-label="Paginación de habitaciones" className={styles.pagination}>
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)} variant="secondary">
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            disabled={!feedState.result?.hasMore}
            onClick={() => setPage(page + 1)}
            variant="secondary"
          >
            Siguiente
          </Button>
        </nav>
      ) : null}
      </div>
    </section>
  )
}
