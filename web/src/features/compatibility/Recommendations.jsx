import PropTypes from 'prop-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLink } from '../../components/AppLink.jsx'
import { push } from '../../routes/navigation.js'
import { useAuth } from '../../hooks/useAuth.js'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import {
  getRecommendationFeed,
} from './compatibility.js'
import CandidateProfileDetail from './CandidateDetail.jsx'
import { readLocal } from '../roomlink/storage.js'
import './recommendations.css'

function formatBudget(minimum, maximum) {
  if (!minimum && !maximum) return 'Presupuesto no indicado'
  const min = minimum ? `$${Number(minimum).toLocaleString('es-MX')}` : 'Sin mínimo'
  const max = maximum ? `$${Number(maximum).toLocaleString('es-MX')}` : 'Sin máximo'
  return `${min} - ${max} MXN`
}

function CandidateCard({ profile, showScore, onOpen, onPreview }) {
  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase()

  return (
    <article className="candidate-card">
      <button
        aria-label={`Vista rápida de ${profile.fullName}`}
        className="candidate-photo-button"
        onClick={onPreview}
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
  onPreview: PropTypes.func.isRequired,
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

export default function Recommendations() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { candidateId } = useParams()
  const [feedState, setFeedState] = useState({
    page: 0,
    result: null,
    error: '',
  })
  const dialog = useRef(null)
  const [preview, setPreview] = useState(null)
  const [historyFilter, setHistoryFilter] = useState('')
  const history = Object.values(readLocal(session.user.id, 'candidate-history', {})).filter(({ status }) => status === historyFilter)
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

  useEffect(() => {
    if (preview && !dialog.current?.open) dialog.current?.showModal()
  }, [preview])

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

  if (candidateId) return <CandidateProfileDetail key={candidateId} candidateId={decodeURIComponent(candidateId)} />

  return (
    <section className="recommendations-page">
      <header className="recommendations-heading">
        <div>
          <p className="eyebrow">MÓDULO 04 · EXPLORAR</p>
          <h1>Encuentra tu gente</h1>
          <p className="muted">Roomies recomendados para compartir tu próximo espacio.</p>
        </div>
        <div className="feature-actions">
          <AppLink className="button button-mint" href="/habitaciones">Explorar habitaciones</AppLink>
          <AppLink className="button button-secondary" href="/cuestionario">Revisar mi test</AppLink>
        </div>
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

      <nav className="feature-actions" aria-label="Historial de perfiles">
        {[['', 'Recomendados'], ['saved', 'Guardados'], ['discarded', 'Descartados']].map(([value, label]) => (
          <button key={label} className="button button-secondary" type="button" aria-pressed={historyFilter === value} onClick={() => setHistoryFilter(value)}>{label}</button>
        ))}
      </nav>
      {historyFilter && (
        <section>
          <h2>{historyFilter === 'saved' ? 'Perfiles guardados' : 'Perfiles descartados'}</h2>
          {history.length > 0
            ? <ul>{history.map(({ id, name }) => (
              <li key={id}><AppLink href={`/perfil/candidato/${encodeURIComponent(id)}`}>{name}</AppLink></li>
            ))}</ul>
            : <p>El historial está vacío.</p>}
        </section>
      )}
      <dialog className="candidate-preview" ref={dialog} aria-labelledby="candidate-preview-title" onClose={() => setPreview(null)}>
        <h2 id="candidate-preview-title">Vista rápida</h2>
        {preview && <>
          <h3>{preview.fullName}{preview.age != null ? `, ${preview.age} años` : ''}</h3>
          <p>{[preview.zone, preview.city].filter(Boolean).join(' · ') || 'Zona no indicada'}</p>
          <p>{formatBudget(preview.budgetMin, preview.budgetMax)}</p>
          {feed?.hasTest && Number.isFinite(preview.compatibilityScore) && <p>{Math.round(preview.compatibilityScore)}% de afinidad</p>}
          <div className="feature-actions">
            <button className="button button-mint" type="button" onClick={() => {
              dialog.current.close()
              push(navigate, `/perfil/candidato/${encodeURIComponent(preview.userId)}`)
            }}>Ver perfil completo</button>
            <button className="button button-secondary" type="button" onClick={() => dialog.current.close()}>Cerrar</button>
          </div>
        </>}
      </dialog>
      {!historyFilter && <>
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
          <label className="feed-sort-label">
            <span>Ordenar por</span>
            <select onChange={(event) => setSort(event.target.value)} value={sort}>
              <option value="compatibility">Compatibilidad</option>
              <option value="name">Nombre</option>
              <option value="budget">Presupuesto</option>
            </select>
          </label>
        </div>

        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {loading ? (
          <div className="loading-screen feed-loading">Buscando perfiles compatibles…</div>
        ) : filteredProfiles.length ? (
          <div aria-busy={loading} className="candidate-grid">
            {filteredProfiles.map((profile) => (
              <CandidateCard
                key={profile.userId}
                onOpen={() => push(navigate, `/perfil/candidato/${encodeURIComponent(profile.userId)}`)}
                onPreview={() => setPreview(profile)}
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
      </>}
    </section>
  )
}
