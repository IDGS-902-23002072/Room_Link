import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { useAuth } from '../../hooks/useAuth.js'
import { push } from '../../routes/navigation.js'
import CandidateCard from './CandidateCard.jsx'
import CandidateDetail from './CandidateDetail.jsx'
import { getRecommendationFeed } from './compatibility.js'
import styles from './Recommendations.module.css'

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

  if (candidateId) return <CandidateDetail candidateId={candidateId} />

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
