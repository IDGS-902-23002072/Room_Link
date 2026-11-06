import { useEffect, useMemo, useState } from 'react'
import { AppLink } from '../../components/AppLink.jsx'
import { navigate } from '../../routes/navigation.js'
import { useAuth } from '../../hooks/useAuth.js'
import {
  getCandidate,
  getRecommendationFeed,
  sendConnectionRequest,
} from './compatibility.js'
import './recommendations.css'

const DIMENSIONS = {
  schedule: 'Horarios',
  cleanliness: 'Limpieza',
  noise: 'Ruido',
  pets: 'Mascotas',
  smoking: 'Tabaco',
  visits: 'Visitas',
  genderPref: 'Género',
}

function formatBudget(minimum, maximum) {
  if (!minimum && !maximum) return 'Presupuesto no indicado'
  const min = minimum ? `$${Number(minimum).toLocaleString('es-MX')}` : 'Sin mínimo'
  const max = maximum ? `$${Number(maximum).toLocaleString('es-MX')}` : 'Sin máximo'
  return `${min} - ${max} MXN`
}

function CandidateCard({ profile, showScore, onOpen }) {
  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase()

  return (
    <article className="candidate-card">
      <button
        aria-label={`Ver perfil de ${profile.fullName}`}
        className="candidate-photo-button"
        onClick={onOpen}
        type="button"
      >
        {profile.photoUrl ? (
          <img alt="" className="candidate-photo" loading="lazy" src={profile.photoUrl} />
        ) : (
          <span aria-hidden="true" className="candidate-placeholder">{initials}</span>
        )}
      </button>
      <div className="candidate-card-body">
        <div className="candidate-title-row">
          <h2>{profile.fullName}, {profile.age}</h2>
          {showScore && profile.compatibilityScore !== null && (
            <span className="compatibility-badge">
              {Math.round(profile.compatibilityScore)}%
            </span>
          )}
        </div>
        <p className="candidate-location">
          {profile.zone || 'Zona no indicada'}
          {profile.city ? ` · ${profile.city}` : ''}
        </p>
        <p className="candidate-budget">
          {formatBudget(profile.budgetMin, profile.budgetMax)}
        </p>
        <button className="candidate-open" onClick={onOpen} type="button">
          Ver perfil completo <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  )
}

function CandidateDetail({ candidateId }) {
  const { session } = useAuth()
  const [detail, setDetail] = useState({
    candidateId: null,
    profile: null,
    error: '',
  })
  const [requestError, setRequestError] = useState('')
  const [sending, setSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    let active = true
    getCandidate(session.user.id, candidateId, session.token)
      .then((result) => {
        if (active) setDetail({ candidateId, profile: result, error: '' })
      })
      .catch((cause) => {
        if (active) {
          setDetail({
            candidateId,
            profile: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar el perfil.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [candidateId, session.token, session.user.id])

  async function requestConnection() {
    if (sending || requestSent) return
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

  if (detail.candidateId !== candidateId) {
    return <div className="loading-screen">Cargando perfil…</div>
  }
  if (detail.error) {
    return (
      <section className="recommendations-page">
        <button className="back-link back-button" onClick={() => navigate('/recomendados')} type="button">
          ← Volver a roomies
        </button>
        <div className="notice notice-error" role="alert">{detail.error}</div>
      </section>
    )
  }
  const profile = detail.profile
  if (!profile) return null

  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase()

  return (
    <section className="recommendations-page">
      <button className="back-link back-button" onClick={() => navigate('/recomendados')} type="button">
        ← Volver a roomies
      </button>
      <article className="candidate-detail">
        <div className="candidate-detail-hero">
          {profile.photoUrl ? (
            <img alt={`Foto de ${profile.fullName}`} src={profile.photoUrl} />
          ) : (
            <span aria-hidden="true" className="candidate-placeholder detail-placeholder">{initials}</span>
          )}
        </div>
        <div className="candidate-detail-content">
          <p className="eyebrow">PERFIL DE ROOMIE</p>
          <div className="candidate-detail-heading">
            <div>
              <h1>{profile.fullName}</h1>
              <p className="muted">
                {profile.age} años · {profile.zone || 'Zona no indicada'}
                {profile.city ? `, ${profile.city}` : ''}
              </p>
            </div>
            {profile.compatibilityScore !== null && (
              <span className="detail-score">{Math.round(profile.compatibilityScore)}%</span>
            )}
          </div>
          <div className="detail-facts">
            <div><span>Presupuesto mensual</span><strong>{formatBudget(profile.budgetMin, profile.budgetMax)}</strong></div>
            <div><span>Ocupación</span><strong>{profile.occupation || 'No indicada'}</strong></div>
          </div>
          <section className="detail-section">
            <h2>Sobre mí</h2>
            <p>{profile.bio || 'Este perfil aún no tiene una descripción.'}</p>
          </section>
          <section className="detail-section">
            <h2>Resumen de convivencia</h2>
            {profile.compatibilitySummary?.length ? (
              <div className="dimension-grid">
                {profile.compatibilitySummary.map(({ dimension, percentage, level }) => (
                  <div className="dimension-item" key={dimension}>
                    <span>{DIMENSIONS[dimension] || dimension}</span>
                    <strong>{percentage}%</strong>
                    <small>{level}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Este perfil aún no tiene un resumen de test.</p>
            )}
          </section>
          {requestError && <p className="form-error" role="alert">{requestError}</p>}
          {requestSent && <p className="inline-notice" role="status">Solicitud de conexión enviada.</p>}
          <button
            className="button button-primary"
            disabled={sending || requestSent}
            onClick={requestConnection}
            type="button"
          >
            {requestSent ? 'Solicitud enviada' : sending ? 'Enviando…' : 'Enviar solicitud de conexión'}
          </button>
        </div>
      </article>
    </section>
  )
}

export default function Recommendations({ candidateId }) {
  const { session } = useAuth()
  const [feedState, setFeedState] = useState({
    page: 0,
    result: null,
    error: '',
  })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todas')

  useEffect(() => {
    if (candidateId) return undefined
    let active = true
    getRecommendationFeed(session.user.id, page, session.token)
      .then((result) => {
        if (active) setFeedState({ page, result, error: '' })
      })
      .catch((cause) => {
        if (active) {
          setFeedState({
            page,
            result: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar el feed.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [candidateId, page, session.token, session.user.id])

  const loading = feedState.page !== page
  const feed = loading ? null : feedState.result
  const error = loading ? '' : feedState.error
  const filteredProfiles = useMemo(() => {
    const profiles = feed?.profiles ?? []
    const query = search.trim().toLocaleLowerCase('es')
    return profiles.filter((profile) => {
      const matchesSearch =
        !query ||
        `${profile.fullName} ${profile.city ?? ''} ${profile.zone ?? ''} ${profile.occupation ?? ''}`
          .toLocaleLowerCase('es')
          .includes(query)
      const matchesFilter =
        filter === 'Todas' ||
        (filter === 'Con foto' && Boolean(profile.photoUrl)) ||
        (filter === 'Con presupuesto' && Boolean(profile.budgetMin || profile.budgetMax))
      return matchesSearch && matchesFilter
    })
  }, [feed, filter, search])

  function changePage(nextPage) {
    setPage(nextPage)
  }

  if (candidateId) return <CandidateDetail candidateId={decodeURIComponent(candidateId)} />

  return (
    <section className="recommendations-page">
      <header className="recommendations-heading">
        <div>
          <p className="eyebrow">MÓDULO 04 · EXPLORAR</p>
          <h1>Encuentra tu gente</h1>
          <p className="muted">Roomies recomendados para compartir tu próximo espacio.</p>
        </div>
        <AppLink className="button button-secondary" href="/cuestionario">
          Revisar mi test
        </AppLink>
      </header>

      {feed && !feed.hasTest && (
        <div className="recommendation-cta">
          <div>
            <strong>Haz tu test de convivencia</strong>
            <p>Completa tus respuestas para recibir recomendaciones por afinidad.</p>
          </div>
          <AppLink className="button button-primary" href="/cuestionario">Hacer mi test</AppLink>
        </div>
      )}

      <div className="feed-toolbar">
        <label className="feed-search">
          <span aria-hidden="true">⌕</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, zona o intereses"
            type="search"
            value={search}
          />
        </label>
        <label className="feed-filter-label">
          <span>Filtros</span>
          <select onChange={(event) => setFilter(event.target.value)} value={filter}>
            <option>Todas</option>
            <option>Con foto</option>
            <option>Con presupuesto</option>
          </select>
        </label>
        {feed?.hasTest && (
          <span className="sort-label">Ordenados por compatibilidad ↓</span>
        )}
      </div>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {loading ? (
        <div className="loading-screen feed-loading">Buscando perfiles compatibles…</div>
      ) : filteredProfiles.length ? (
        <div aria-busy={loading} className="candidate-grid">
          {filteredProfiles.map((profile) => (
            <CandidateCard
              key={profile.userId}
              onOpen={() => navigate(`/perfil/candidato/${encodeURIComponent(profile.userId)}`)}
              profile={profile}
              showScore={feed?.hasTest === true}
            />
          ))}
        </div>
      ) : (
        <div className="empty-feed">
          <div className="empty-icon" aria-hidden="true">⌕</div>
          <h2>{feed?.profiles?.length ? 'No encontramos coincidencias' : 'Aún no hay perfiles para mostrar'}</h2>
          <p className="muted">
            {feed?.profiles?.length
              ? 'Prueba con otro nombre o filtro.'
              : 'Vuelve más tarde para descubrir nuevos roomies.'}
          </p>
          {search || filter !== 'Todas' ? (
            <button
              className="button button-secondary"
              onClick={() => {
                setSearch('')
                setFilter('Todas')
              }}
              type="button"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      )}

      {!loading && (
        <nav aria-label="Paginación de perfiles" className="feed-pagination">
          <button
            className="button button-secondary"
            disabled={page <= 1 || loading}
            onClick={() => changePage(page - 1)}
            type="button"
          >
            Anterior
          </button>
          <span>Página {page}</span>
          <button
            className="button button-secondary"
            disabled={!feed?.hasMore || loading}
            onClick={() => changePage(page + 1)}
            type="button"
          >
            {loading ? 'Cargando…' : 'Siguiente'}
          </button>
        </nav>
      )}
    </section>
  )
}
