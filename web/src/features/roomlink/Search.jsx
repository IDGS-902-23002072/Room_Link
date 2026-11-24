import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { apiAssetUrl, apiRequest } from '../../services/api.js'
import { QUESTIONS } from '../compatibility/compatibility.js'
import { readLocal, writeLocal } from './storage.js'
import { Avatar, Feedback, Heading, Panel, ResourceStatus, Toggle } from './Workspace.jsx'
import { useResource } from './useResource.js'

const emptyFilters = { budgetMin: '', budgetMax: '', minAge: '', maxAge: '', city: '', zones: [] }
const habitDefinitions = [
  ['noise', 'Ruido y descanso', 'Nivel de ruido que prefieres en casa.'],
  ['smoking', 'Consumo de tabaco', 'Qué tan cómodo te sientes al convivir con el tabaco.'],
  ['cleanliness', 'Limpieza de espacios comunes', 'Importancia de mantener limpias las áreas compartidas.'],
  ['visits', 'Visitas en casa', 'Frecuencia de visitas que te gustaría tener.'],
]
const emptySearch = { filters: emptyFilters, habits: {}, searches: [], profiles: [] }
const resultsPerPage = 8
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

function readSearch(id) {
  return { ...emptySearch, ...readLocal(id, 'advanced-search', {}) }
}

function loadProfiles(filters, habits, order, page, token, signal) {
  const { zones, ...general } = filters
  const params = new URLSearchParams({ ...general, order, page, pageSize: resultsPerPage })
  zones.forEach((zone) => params.append('zone', zone))
  Object.entries(habits).forEach(([key, habit]) => {
    if (habit.value === '') return
    params.set(key, String(Number(habit.value) / 25 + 1))
    params.set(`${key}Required`, String(habit.priority === 'required'))
  })
  return apiRequest(`/api/v1/search/profiles?${params}`, { token, signal })
}

function describeFilters(filters) {
  const { city, zones, budgetMin, budgetMax, minAge, maxAge } = filters
  return [
    [zones.join(' / '), city].filter(Boolean).join(', '),
    (budgetMin || budgetMax) && `${budgetMin ? money.format(budgetMin) : 'Sin mínimo'} – ${budgetMax ? money.format(budgetMax) : 'Sin máximo'} MXN / mes`,
    (minAge || maxAge) && `${minAge || '18'} – ${maxAge || 'sin límite'} años`,
  ].filter(Boolean)
}

function Summary({ filters, habits }) {
  const descriptions = describeFilters(filters)
  const active = habitDefinitions.flatMap(([key, label]) => {
    const habit = habits[key]
    if (!habit || habit.value === '') return []
    const option = QUESTIONS.find(({ id }) => id === key).options[Number(habit.value) / 25]
    return [`${label} · ${option} (${habit.priority === 'required' ? 'Indispensable' : 'Preferencia'})`]
  })
  return <div className="room-stack"><p>{descriptions.join(' · ') || 'Todos los perfiles disponibles'}</p>{active.length > 0 && <p className="muted">{active.join(' · ')}</p>}</div>
}

export function SearchPage({ tab }) {
  const { session: { token, user } } = useAuth()
  const location = useLocation()
  const [state, setState] = useState(() => readSearch(user.id))
  const [page, setPage] = useState(1)
  const [order, setOrder] = useState('compatibility')
  const load = useCallback((signal) => loadProfiles(state.filters, state.habits, order, page, token, signal), [state.filters, state.habits, order, page, token])
  const resource = useResource(load)
  const loadZones = useCallback((signal) => apiRequest('/api/v1/search/zones', { token, signal }), [token])
  const zoneResource = useResource(loadZones)
  const [error, setError] = useState('')

  function save(patch) {
    const next = { ...state, ...patch }
    try {
      writeLocal(user.id, 'advanced-search', next)
      setState(next)
      if (patch.filters || patch.habits) setPage(1)
      setError('')
      return true
    } catch (cause) {
      setError(cause.message)
      return false
    }
  }

  return (
    <>
      {tab === 'filters' && <Filters key={location.key} order={order} page={page} resource={resource} save={save} setOrder={setOrder} setPage={setPage} state={state} zoneResource={zoneResource} />}
      {tab === 'habits' && <Habits save={save} state={state} token={token} />}
      {tab === 'saved' && <SavedSearches resource={resource} resultCount={resource.data?.total} save={save} state={state} />}
      <Feedback error={error} />
    </>
  )
}

function Filters({ order, page, resource, save, setOrder, setPage, state, zoneResource }) {
  const [filters, setFilters] = useState(state.filters)
  const [error, setError] = useState('')
  const { items: cards, total, totalPages: pageCount } = resource.data ?? { items: [], total: 0, totalPages: 0 }
  const catalog = zoneResource.data ?? []
  const cities = [...new Set([filters.city, ...catalog.map(({ city }) => city)].filter(Boolean))].sort()
  const zones = [...new Set([...filters.zones, ...catalog.filter(({ city }) => !filters.city || city === filters.city).map(({ name }) => name)])].sort()
  const field = (name) => ({ value: filters[name], onChange: (event) => setFilters({ ...filters, [name]: event.target.value }) })

  function apply(event) {
    event.preventDefault()
    if (filters.budgetMin && filters.budgetMax && Number(filters.budgetMin) > Number(filters.budgetMax)) {
      setError('El presupuesto mínimo debe ser igual o menor que el máximo.')
      return
    }
    if (filters.minAge && filters.maxAge && Number(filters.minAge) > Number(filters.maxAge)) {
      setError('La edad mínima debe ser igual o menor que la máxima.')
      return
    }
    if (save({ filters })) setPage(1)
    setError('')
  }

  return (
    <>
      <Heading action={<Link className="button button-secondary" to="/buscar/guardadas#guardar">Guardar búsqueda</Link>} title="Encuentra a tu próximo roomie">Ajusta los criterios para encontrar personas que buscan compartir un hogar.</Heading>
      <div className="room-grid room-grid-filters">
        <div className="room-stack">
          <Panel title="Filtros generales">
            <form className="room-stack" onSubmit={apply}>
              <fieldset><legend>Presupuesto mensual · MXN</legend><div className="room-fields">
                <label className="field">Mínimo<input min="0" type="number" {...field('budgetMin')} /></label>
                <label className="field">Máximo<input min="0" type="number" {...field('budgetMax')} /></label>
              </div></fieldset>
              <label className="field">Ciudad<select onChange={(event) => setFilters({ ...filters, city: event.target.value, zones: [] })} value={filters.city}><option value="">Todas las ciudades</option>{cities.map((city) => <option key={city}>{city}</option>)}</select></label>
              <ResourceStatus label="Cargando zonas." resource={zoneResource} />
              <fieldset><legend>Zonas de interés</legend>{zones.length ? zones.map((zone) => (
                <label className="room-check" key={zone}><input checked={filters.zones.includes(zone)} onChange={(event) => setFilters({ ...filters, zones: event.target.checked ? [...filters.zones, zone] : filters.zones.filter((item) => item !== zone) })} type="checkbox" />{zone}</label>
              )) : <small>Las zonas aparecen según los perfiles disponibles.</small>}</fieldset>
              <fieldset><legend>Edad</legend><div className="room-fields">
                <label className="field">Desde<input min="18" type="number" {...field('minAge')} /></label>
                <label className="field">Hasta<input min="18" type="number" {...field('maxAge')} /></label>
              </div></fieldset>
              <Feedback error={error} />
              <button className="button button-primary" type="submit">Aplicar filtros</button>
              <button className="button button-secondary" onClick={() => {
                if (save({ filters: emptyFilters })) { setFilters(emptyFilters); setPage(1); setError('') }
              }} type="button">Restablecer filtros</button>
            </form>
          </Panel>
          <Link className="button button-secondary" to="/buscar/habitos">Configurar hábitos de convivencia</Link>
        </div>
        <div className="room-stack">
          <div className="room-row">
            {resource.data && <strong role="status">{total} {total === 1 ? 'perfil encontrado' : 'perfiles encontrados'}</strong>}
            <label className="field">Ordenar por<select onChange={(event) => { setOrder(event.target.value); setPage(1) }} value={order}><option value="compatibility">Compatibilidad</option><option value="budget">Presupuesto</option><option value="name">Nombre</option></select></label>
          </div>
          <div className="room-actions">{describeFilters(state.filters).map((item) => <span className="room-pill" key={item}>{item}</span>)}</div>
          <ResourceStatus label="Buscando perfiles…" resource={resource} />
          {resource.data && !cards.length && <Panel><p>Sin coincidencias. Ajusta los filtros o los hábitos y vuelve a buscar.</p></Panel>}
          {cards.map((profile) => {
            const saved = state.profiles.includes(profile.userId)
            return (
              <Panel key={profile.userId}>
                <div className="room-candidate">
                  <Avatar name={profile.fullName} src={profile.photoUrl ? apiAssetUrl(profile.photoUrl) : undefined} />
                  <div className="room-stack">
                    <div className="room-row"><h2>{profile.fullName}{profile.age ? `, ${profile.age}` : ''}</h2>{profile.compatibilityScore != null && <span className="room-pill">{Math.round(profile.compatibilityScore)} % compatible</span>}</div>
                    <p className="muted">{[profile.occupation, profile.zone, profile.city].filter(Boolean).join(' · ')}</p>
                    {(profile.budgetMin != null || profile.budgetMax != null) && <p>{[...new Set([profile.budgetMin, profile.budgetMax].filter((value) => value != null))].map((value) => money.format(value)).join(' – ')} MXN / mes</p>}
                    <div className="room-actions">
                      <Link className="button button-primary" to={`/perfil/candidato/${encodeURIComponent(profile.userId)}`}>Ver perfil</Link>
                      <button aria-pressed={saved} className="button button-secondary" onClick={() => save({ profiles: saved ? state.profiles.filter((id) => id !== profile.userId) : [...state.profiles, profile.userId] })} type="button">{saved ? '♥ Guardado' : '♡ Guardar'}</button>
                    </div>
                  </div>
                </div>
              </Panel>
            )
          })}
          {pageCount > 1 && <nav aria-label="Páginas de resultados" className="room-row"><button className="button button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Anterior</button><span>Página {page} de {pageCount}</span><button className="button button-secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)} type="button">Siguiente</button></nav>}
        </div>
      </div>
    </>
  )
}

function Habits({ save, state, token }) {
  const [habits, setHabits] = useState(state.habits)
  const navigate = useNavigate()
  const preview = useCallback((signal) => loadProfiles(state.filters, habits, "compatibility", 1, token, signal), [state.filters, habits, token])
  const resource = useResource(preview)
  const { items: results, total } = resource.data ?? { items: [], total: 0 }
  const count = (priority) => Object.values(habits).filter((habit) => habit.value !== '' && habit.priority === priority).length
  return (
    <>
      <Heading title="Hábitos y compatibilidad">Distingue tus preferencias de las condiciones indispensables.</Heading>
      <div className="room-grid">
        <div className="room-stack">
          <p className="room-note">Los criterios indispensables excluyen perfiles sin una respuesta compatible en el test. Las preferencias mejoran el orden.</p>
          <Panel title="Tus límites de convivencia">
            {habitDefinitions.map(([key, label, description]) => {
              const habit = habits[key] ?? { value: '', priority: 'preferred' }
              const options = QUESTIONS.find(({ id }) => id === key).options
              return (
                <div className="room-rule" key={key}>
                  <h3>{label}</h3><p className="muted">{description}</p>
                  <div className="room-fields">
                    <label className="field">Lo que busco<select onChange={(event) => setHabits({ ...habits, [key]: { ...habit, value: event.target.value } })} value={habit.value}><option value="">Sin criterio</option>{options.map((option, index) => <option key={option} value={index * 25}>{option}</option>)}</select></label>
                    <label className="field">Importancia<select disabled={habit.value === ''} onChange={(event) => setHabits({ ...habits, [key]: { ...habit, priority: event.target.value } })} value={habit.priority}><option value="preferred">Preferencia</option><option value="required">Indispensable</option></select></label>
                  </div>
                </div>
              )
            })}
          </Panel>
          <div className="room-save"><p>{count('required')} indispensables · {count('preferred')} preferencias</p><div className="room-actions"><button className="button button-secondary" onClick={() => setHabits(state.habits)} type="button">Cancelar</button><button className="button button-primary" onClick={() => { if (save({ habits })) navigate('/buscar') }} type="button">Aplicar hábitos</button></div></div>
        </div>
        <div className="room-stack">
          <Panel title="Búsqueda actual"><Summary filters={state.filters} habits={{}} /><Link className="button button-secondary" to="/buscar">Editar filtros generales</Link></Panel>
          <Panel title="Vista previa">
            <ResourceStatus label="Calculando coincidencias…" resource={resource} />
            {resource.data && <p role="status">{total} {total === 1 ? 'perfil cumple' : 'perfiles cumplen'}</p>}
            {results.slice(0, 3).map((profile) => <div className="room-person" key={profile.userId}><Avatar name={profile.fullName} /><div><strong>{profile.fullName}</strong>{profile.compatibilityScore != null && <p>{Math.round(profile.compatibilityScore)} % compatible</p>}</div></div>)}
          </Panel>
        </div>
      </div>
    </>
  )
}

function SavedSearches({ resource, resultCount, save, state }) {
  const navigate = useNavigate()
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [newName, setNewName] = useState('')
  const items = state.searches.filter((item) => !favoriteOnly || item.favorite)
  const ready = Boolean(resource.data)
  const update = (id, patch) => save({ searches: state.searches.map((item) => item.id === id ? { ...item, ...patch } : item) })

  return (
    <>
      <Heading title="Búsquedas guardadas">Retoma tus criterios habituales en este navegador.</Heading>
      <div className="room-grid">
        <div className="room-stack">
          <ResourceStatus label="Calculando coincidencias…" resource={resource} />
          <div className="room-actions">
            <button aria-pressed={!favoriteOnly} className={`button button-${favoriteOnly ? 'secondary' : 'primary'}`} onClick={() => setFavoriteOnly(false)} type="button">Todas ({state.searches.length})</button>
            <button aria-pressed={favoriteOnly} className={`button button-${favoriteOnly ? 'primary' : 'secondary'}`} onClick={() => setFavoriteOnly(true)} type="button">★ Favoritas ({state.searches.filter((item) => item.favorite).length})</button>
          </div>
          {!items.length && <Panel><p>{favoriteOnly ? 'Todavía no hay búsquedas favoritas.' : 'Todavía no has guardado una búsqueda.'}</p></Panel>}
          {items.map((item) => (
            <Panel key={item.id}>
              <div className="room-row"><div className="room-actions">
                <button aria-label={`Marcar como favorita: ${item.name}`} aria-pressed={item.favorite} className="button button-quiet" onClick={() => update(item.id, { favorite: !item.favorite })} type="button">{item.favorite ? '★' : '☆'}</button><h2>{item.name}</h2>
              </div></div>
              <Summary filters={item.filters} habits={item.habits} />
              <small>Guardada el {new Date(item.createdAt).toLocaleDateString('es-MX')}</small>
              {editing === item.id ? <form className="room-actions" onSubmit={(event) => { event.preventDefault(); if (newName.trim() && update(item.id, { name: newName.trim() })) setEditing(null) }}>
                <label className="field">Nuevo nombre<input maxLength={80} onChange={(event) => setNewName(event.target.value)} required value={newName} /></label><button className="button button-primary" type="submit">Guardar nombre</button><button className="button button-quiet" onClick={() => setEditing(null)} type="button">Cancelar</button>
              </form> : <div className="room-actions">
                <button className="button button-secondary" onClick={() => { setEditing(item.id); setNewName(item.name) }} type="button">Renombrar</button>
                <button className="button button-secondary" onClick={() => { if (window.confirm(`¿Eliminar la búsqueda «${item.name}»?`)) save({ searches: state.searches.filter(({ id }) => id !== item.id) }) }} type="button">Eliminar</button>
                <button className="button button-primary" onClick={() => { if (save({ filters: item.filters, habits: item.habits })) navigate('/buscar') }} type="button">Ver resultados</button>
              </div>}
            </Panel>
          ))}
        </div>
        <div id="guardar">
          <Panel title="Guardar búsqueda actual">
            <form className="room-stack" onSubmit={(event) => {
              event.preventDefault()
              if (name.trim() && save({ searches: [{ id: crypto.randomUUID(), name: name.trim(), favorite, filters: state.filters, habits: state.habits, createdAt: Date.now() }, ...state.searches] })) {
                setName(''); setFavorite(false); setFavoriteOnly(false)
              }
            }}>
              <label className="field">Nombre de la búsqueda<input maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Mi próxima casa" required value={name} /></label>
              <h3>Resumen de criterios</h3><Summary filters={state.filters} habits={state.habits} />
              {ready && <small>{resultCount} coincidencias actuales</small>}
              <Toggle checked={favorite} description="Acceso rápido a esta búsqueda." label="Marcar como favorita" onChange={setFavorite} />
              <button className="button button-primary" disabled={!name.trim()} type="submit">Guardar nueva búsqueda</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  )
}
