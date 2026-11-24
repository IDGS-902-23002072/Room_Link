import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { useRoomLinkQuery } from '../../hooks/useRoomLinkQuery.js'
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
        <button aria-label={`Ver perfil de ${profile.fullName}`} className="candidate-open" onClick={onOpen} type="button">
          Ver perfil <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  )
}

CandidateCard.propTypes = {
  onOpen: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    age: PropTypes.number,
    budgetMax: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    budgetMin: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    city: PropTypes.string,
    compatibilityScore: PropTypes.number,
    fullName: PropTypes.string.isRequired,
    photoUrl: PropTypes.string,
    userId: PropTypes.string.isRequired,
    zone: PropTypes.string,
  }).isRequired,
  showScore: PropTypes.bool.isRequired,
}

function CandidateDetail({ candidateId }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState({
    candidateId: null,
    profile: null,
    error: '',
  })
  const [requestError, setRequestError] = useState('')
  const [sending, setSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const connections = useRoomLinkQuery('/api/v1/connections', session.token, connectionAttempt)
  const activeConnection = connections.data?.find(({ requesterId, addresseeId, status }) =>
    (requesterId === candidateId || addresseeId === candidateId) && ['pending', 'accepted'].includes(status),
  )
  const connectionLabel = activeConnection?.status === 'accepted' ? 'Conexión aceptada'
    : activeConnection?.requesterId === candidateId ? 'Solicitud recibida'
    : activeConnection || requestSent ? 'Solicitud enviada' : null

  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const result = await getCandidate(session.user.id, candidateId, session.token)
        if (isActive()) setDetail({ candidateId, profile: result, error: '' })
      } catch (cause) {
        if (isActive()) {
          setDetail({
            candidateId,
            profile: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar el perfil.',
          })
        }
      }
    }),
    [candidateId, session.token, session.user.id],
  )

  async function requestConnection() {
    if (sending || connectionLabel || connections.loading || connections.error) return
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
        <button className="back-link back-button" onClick={() => goBack(navigate, '/recomendados')} type="button">
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
      <button className="back-link back-button" onClick={() => goBack(navigate, '/recomendados')} type="button">
        ← Volver a roomies
      </button>
      <article className="candidate-detail">
        <div className="candidate-detail-hero">
          {profile.photoUrl ? (
            <img alt={`Foto de ${profile.fullName}`} src={profile.photoUrl} />
          ) : (
            <span aria-hidden="true" className="candidate-placeholder detail-placeholder">{initials}</span>
          )}
          <div className="candidate-detail-identity">
            <h1>{profile.fullName}</h1>
            <p>{profile.age} años · {profile.zone || 'Zona no indicada'}{profile.city ? `, ${profile.city}` : ''}</p>
            {profile.compatibilityScore !== null && (
              <div className="detail-score-block">
                <span>Compatibilidad contigo</span>
                <strong>{Math.round(profile.compatibilityScore)}%</strong>
              </div>
            )}
            {requestError && <p className="form-error" role="alert">{requestError}</p>}
            {connections.error && <p className="form-error" role="alert">No se pudo consultar el estado de la conexión.</p>}
            {connections.error && <button className="button button-secondary" type="button" onClick={() => setConnectionAttempt((value) => value + 1)}>Reintentar</button>}
            <button
              className="button button-primary button-wide"
              disabled={sending || Boolean(connectionLabel) || connections.loading || Boolean(connections.error)}
              onClick={requestConnection}
              type="button"
            >
              {connectionLabel || (sending ? 'Enviando…' : connections.loading ? 'Consultando…' : 'Enviar solicitud')}
            </button>
            <button className="button button-secondary button-wide" onClick={() => goBack(navigate, '/recomendados')} type="button">
              Volver a roomies
            </button>
          </div>
        </div>
        <div className="candidate-detail-content">
          <section className="detail-section">
            <h2>Sobre mí</h2>
            <p>{profile.bio || 'Este perfil aún no tiene una descripción.'}</p>
          </section>
          <section className="detail-section">
            <h2>Estilo de vida</h2>
            <div className="lifestyle-tags">
              <span>{formatBudget(profile.budgetMin, profile.budgetMax)}</span>
              {profile.occupation && <span>{profile.occupation}</span>}
              {profile.compatibilitySummary?.slice(0, 4).map(({ dimension, level }) => (
                <span key={dimension}>{DIMENSIONS[dimension] || dimension}: {level}</span>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>Respuestas del test</h2>
            {profile.compatibilitySummary?.length ? (
              <div className="detail-answer-list">
                {profile.compatibilitySummary.map(({ dimension, percentage }) => (
                  <div className="detail-answer" key={dimension}>
                    <strong>{DIMENSIONS[dimension] || dimension}</strong>
                    <span className="detail-answer-value">1</span>
                    <div aria-label={`${DIMENSIONS[dimension] || dimension}: ${percentage}%`} className="meter-track" role="img">
                      <span style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="detail-answer-value">5</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Este perfil aún no tiene un resumen de test.</p>
            )}
          </section>
        </div>
      </article>
    </section>
  )
}

CandidateDetail.propTypes = {
  candidateId: PropTypes.string.isRequired,
}

export default function Recommendations() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { candidateId } = useParams()
  const [feedState, setFeedState] = useState({
    page: 0,
    result: null,
    error: '',
  })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todas')
  const [sort, setSort] = useState('compatibility')

  useEffect(
    () => asyncEffect(async (isActive) => {
      if (candidateId) return
      try {
        const result = await getRecommendationFeed(session.user.id, page, session.token)
        if (isActive()) setFeedState({ page, result, error: '' })
      } catch (cause) {
        if (isActive()) {
          setFeedState({
            page,
            result: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar el feed.',
          })
        }
      }
    }),
    [candidateId, page, session.token, session.user.id],
  )

  const loading = feedState.page !== page
  const feed = loading ? null : feedState.result
  const error = loading ? '' : feedState.error
  const filteredProfiles = useMemo(() => {
    const profiles = feed?.profiles ?? []
    const query = search.trim().toLocaleLowerCase('es')
    const filtered = profiles.filter((profile) => {
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
    if (sort === 'name') {
      return filtered.sort((first, second) => first.fullName.localeCompare(second.fullName, 'es'))
    }
    if (sort === 'budget') {
      return filtered.sort((first, second) => (second.budgetMax || 0) - (first.budgetMax || 0))
    }
    return filtered.sort(
      (first, second) => (second.compatibilityScore ?? -1) - (first.compatibilityScore ?? -1),
    )
  }, [feed, filter, search, sort])

  function changePage(nextPage) {
    setPage(nextPage)
  }

  if (candidateId) return <CandidateDetail key={candidateId} candidateId={decodeURIComponent(candidateId)} />

  return (
    <section className={styles.page}>
      <PageHeader
        actions={<Button href="/cuestionario" variant="secondary">Revisar mi test</Button>}
        description="Roomies recomendados para compartir tu próximo espacio."
        eyebrow="EXPLORAR · COMPATIBILIDAD"
        title="Encuentra tu gente"
      />

      {feed && !feed.hasTest ? (
        <Card as="div" className={styles.cta}>
          <div>
            <h2>Haz tu test de convivencia</h2>
            <p>Completa tus respuestas para recibir recomendaciones por afinidad.</p>
          </div>
          <Button href="/cuestionario">Hacer mi test</Button>
        </Card>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <label className="sr-only" htmlFor="feed-search">
            Buscar roomies
          </label>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            autoComplete="off"
            id="feed-search"
            name="search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, zona o intereses…"
            spellCheck={false}
            type="search"
            value={search}
          />
        </div>

        <Field htmlFor="feed-filter" label="Filtros" variant="inline">
          <select
            autoComplete="off"
            name="filter"
            onChange={(event) => setFilter(event.target.value)}
            value={filter}
          >
            <option>Todas</option>
            <option>Con foto</option>
            <option>Con presupuesto</option>
          </select>
        </Field>

        <Field htmlFor="feed-sort" label="Ordenar por" variant="inline">
          <select
            autoComplete="off"
            name="sort"
            onChange={(event) => setSort(event.target.value)}
            value={sort}
          >
            <option value="compatibility">Compatibilidad</option>
            <option value="name">Nombre</option>
            <option value="budget">Presupuesto</option>
          </select>
        </Field>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {loading ? (
        <div className={styles.loading} role="status">
          Buscando perfiles compatibles…
        </div>
      ) : filteredProfiles.length ? (
        <div aria-busy={loading} className={styles.grid}>
          {filteredProfiles.map((profile) => (
            <CandidateCard
              key={profile.userId}
              onOpen={() => push(navigate, `/perfil/candidato/${encodeURIComponent(profile.userId)}`)}
              profile={profile}
              showScore={feed?.hasTest === true}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            search || filter !== 'Todas' ? (
              <Button
                onClick={() => {
                  setSearch('')
                  setFilter('Todas')
                }}
                variant="secondary"
              >
                Limpiar filtros
              </Button>
            ) : null
          }
          description={
            feed?.profiles?.length
              ? 'Prueba con otro nombre o ajusta los filtros para ver más resultados.'
              : 'Vuelve más tarde para descubrir nuevos roomies.'
          }
          title={
            feed?.profiles?.length
              ? 'No encontramos coincidencias'
              : 'Aún no hay perfiles para mostrar'
          }
        />
      )}

      {!loading ? (
        <nav aria-label="Paginación de perfiles" className={styles.pagination}>
          <Button
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
            variant="secondary"
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            disabled={!feed?.hasMore}
            onClick={() => changePage(page + 1)}
            variant="secondary"
          >
            Siguiente
          </Button>
        </nav>
      ) : null}
    </section>
  )
}
