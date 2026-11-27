import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useRoomLinkQuery } from '../../hooks/useRoomLinkQuery.js'
import { apiRequest, apiUrl } from '../../services/api.js'
import { FeatureHeading, FeatureNotice } from '../cesar-ui.jsx'
import { formatMoment } from '../../utils/formatDate.js'

const adminPath = '/api/v1/moderation/admin'
const reviewTabs = [
  { path: 'cola', label: 'Cola de revisión', endpoint: 'queue', empty: 'No hay anuncios pendientes de revisión.' },
  { path: 'denuncias', label: 'Denuncias', endpoint: 'reports?targetType=listing', empty: 'No hay denuncias de anuncios con este filtro.' },
  { path: 'historial', label: 'Historial', endpoint: 'history', empty: 'Las decisiones de moderación aparecerán aquí.' },
]
const labels = {
  pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado', removed: 'Retirado',
  open: 'Abierta', in_review: 'En revisión', resolved: 'Resuelta', dismissed: 'Desestimada',
}
const reasons = {
  fraud: 'Posible fraude', spam: 'Spam', inappropriate: 'Contenido inapropiado', other: 'Otro motivo',
}
const decisionLabels = {
  approved: 'Aprobar', rejected: 'Rechazar', removed: 'Retirar', resolved: 'Resolver denuncia', dismissed: 'Desestimar denuncia',
}
const negative = new Set(['rejected', 'removed', 'dismissed'])
const positive = new Set(['approved', 'resolved'])
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

function ListingName({ listingId, token }) {
  const { data } = useRoomLinkQuery(listingId ? `/api/v1/rooms/${encodeURIComponent(listingId)}` : null, token)
  const title = data?.title || 'Anuncio'
  return <Link className="access-link" to={`/admin/moderacion/anuncios/${encodeURIComponent(listingId)}`}>{title}</Link>
}

function DecisionForm({ decision, reports, change, cancel, submitting }) {
  const [reason, setReason] = useState('')
  const needsReason = decision === 'rejected' || decision === 'removed'

  return (
    <form className="feature-form review-confirm" onSubmit={(event) => {
      event.preventDefault()
      void change(decision, reason.trim())
    }}>
      <strong>Confirma la acción «{decisionLabels[decision]}»</strong>
      {!reports && <label className="field">
        {needsReason ? 'Motivo obligatorio' : 'Motivo opcional'}
        <textarea rows={3} required={needsReason} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>}
      <div className="feature-actions">
        <button className="button button-rose" type="button" disabled={submitting} onClick={cancel}>Cancelar</button>
        <button className={`button ${negative.has(decision) ? 'button-rose' : 'button-mint'}`} disabled={submitting || (needsReason && !reason.trim())}>
          {submitting ? 'Guardando…' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}

function ReviewCard({ item, token, tab, onChange }) {
  const [decision, setDecision] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const reports = tab === 'denuncias'
  const listingId = item.targetListingId || item.listingId
  const reviewable = tab === 'cola' || (reports && ['open', 'in_review'].includes(item.status))
  const decisions = reports ? ['resolved', 'dismissed'] : ['approved', 'rejected', 'removed']
  const tone = negative.has(item.status) ? ' feature-error' : positive.has(item.status) ? ' feature-success' : ''

  async function apply(choice, reason) {
    if (submitting) return
    setSubmitting(true)
    setError('')
    const path = reports ? `reports/${encodeURIComponent(item.id)}` : `queue/${encodeURIComponent(listingId)}`
    const body = reports ? { status: choice } : { decision: choice, reason: reason || undefined }
    try {
      const updated = await apiRequest(`${adminPath}/${path}`, { token, method: 'PATCH', body: JSON.stringify(body) })
      setDecision('')
      onChange(updated, labels[choice])
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article className="review-card">
      <div className="review-card-top">
        <div>
          <h3><ListingName listingId={listingId} token={token} /></h3>
          <p className="review-meta">{listingId} · {formatMoment(item.reviewedAt || item.resolvedAt || item.createdAt)}</p>
        </div>
        <div className="feature-actions">
          {reports && item.priority === 'high' && <span className="feature-badge feature-error">Prioridad alta</span>}
          <span className={`feature-badge${tone}`}>{labels[item.status] || item.status}</span>
        </div>
      </div>
      {reports && <p className="review-copy"><strong>{reasons[item.reason] || item.reason}</strong>{item.description && <><br />{item.description}</>}</p>}
      {!reports && item.reason && <p className="review-copy"><strong>Motivo</strong><br />{item.reason}</p>}
      {item.reviewerId && <p className="review-meta">Revisado por {item.reviewerId}</p>}
      {error && <p className="feature-feedback feature-error" role="alert">{error}</p>}
      {reviewable && !decision && <div className="feature-actions">
        {decisions.map((choice) => <button key={choice} type="button" onClick={() => setDecision(choice)} className={`button ${negative.has(choice) ? 'button-rose' : 'button-mint'}`}>{decisionLabels[choice]}</button>)}
      </div>}
      {decision && <DecisionForm decision={decision} reports={reports} change={apply} submitting={submitting} cancel={() => { setDecision(''); setError('') }} />}
    </article>
  )
}

function EnqueueForm({ token, onChange }) {
  const [listingId, setListingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function enqueue(event) {
    event.preventDefault()
    if (saving || !listingId.trim()) return
    setSaving(true)
    setError('')
    try {
      const item = await apiRequest(`${adminPath}/queue/${encodeURIComponent(listingId.trim())}`, { token, method: 'POST' })
      setListingId('')
      onChange(item)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="review-enqueue">
      <summary>Agregar anuncio a revisión</summary>
      <form className="feature-form" onSubmit={enqueue}>
        <label className="field">ID del anuncio
          <input required value={listingId} onChange={(event) => setListingId(event.target.value)} />
        </label>
        {error && <p className="feature-feedback feature-error" role="alert">{error}</p>}
        <button className="button button-mint" disabled={saving || !listingId.trim()}>{saving ? 'Agregando…' : 'Agregar a la cola'}</button>
      </form>
    </details>
  )
}

export default function Moderation({ tab }) {
  const { session } = useAuth()
  const current = reviewTabs.find(({ path }) => path === tab)
  const [status, setStatus] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [message, setMessage] = useState('')
  const [changes, setChanges] = useState({})
  const reports = tab === 'denuncias'
  const { data, loading, error } = useRoomLinkQuery(
    `${adminPath}/${current.endpoint}${reports && status ? `&status=${status}` : ''}`, session.token, refresh,
  )
  const reload = () => setRefresh((value) => value + 1)
  const items = (data || []).map((item) => changes[item.id || item.listingId] || item).filter((item) => {
    if (tab === 'cola') return item.status === 'pending'
    return !status || item.status === status
  })

  function update(item, label) {
    setChanges((previous) => ({ ...previous, [item.id || item.listingId]: item }))
    setMessage(`Decisión guardada. Estado: ${label}.`)
    reload()
  }

  return (
    <section className="cesar-feature">
      <FeatureHeading title="Moderación de anuncios" description="Revisa publicaciones, atiende denuncias y consulta el historial de decisiones." />
      <div className="review-layout">
        <nav className="review-nav" aria-label="Moderación de anuncios">
          {reviewTabs.map(({ path, label }) => <NavLink key={path} to={`/admin/moderacion/${path}`}>{label}</NavLink>)}
        </nav>
        <div className="review-main">
          <div className="review-toolbar">
            <h2>{current.label}</h2>
            {reports && <label className="field review-filter">Estado
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos</option>
                {['open', 'in_review', 'resolved', 'dismissed'].map((value) => <option key={value} value={value}>{labels[value]}</option>)}
              </select>
            </label>}
          </div>
          {tab === 'cola' && <EnqueueForm token={session.token} onChange={(item) => {
            setChanges((previous) => ({ ...previous, [item.listingId]: item }))
            setMessage(item.status === 'pending' ? 'El anuncio está en la cola.' : `El anuncio ya fue revisado. Estado: ${labels[item.status]}.`)
            reload()
          }} />}
          {message && <p className="feature-feedback feature-success" role="status">{message}</p>}
          {error && <FeatureNotice error={error} retry={reload} />}
          {loading && <FeatureNotice loading>Cargando {current.label.toLowerCase()}…</FeatureNotice>}
          {!loading && !error && !items.length && <FeatureNotice>{current.empty}</FeatureNotice>}
          <div className="review-list">
            {items.map((item) => <ReviewCard key={item.id || item.listingId} item={item} token={session.token} tab={tab} onChange={update} />)}
          </div>
        </div>
      </div>
    </section>
  )
}

export function ModerationListing() {
  const { session } = useAuth()
  const { listingId } = useParams()
  const [refresh, setRefresh] = useState(0)
  const { data, loading, error } = useRoomLinkQuery(`/api/v1/rooms/${encodeURIComponent(listingId)}`, session.token, refresh)

  return (
    <section className="cesar-feature report-page">
      <FeatureHeading title={data?.title || 'Detalle del anuncio'} description={`Anuncio ${listingId}`}>
        <Link className="button button-subtle" to="/admin/moderacion/cola">Volver a moderación</Link>
      </FeatureHeading>
      {error && <FeatureNotice error={error} retry={() => setRefresh((value) => value + 1)} />}
      {loading && <FeatureNotice loading>Cargando anuncio…</FeatureNotice>}
      {data && <article className="review-card">
        <p className="review-copy">{data.description || 'Este anuncio no tiene descripción.'}</p>
        <dl className="listing-facts">
          <dt>Renta mensual</dt><dd>{currency.format(data.monthlyRent)}</dd>
          <dt>Estado</dt><dd>{({ published: 'Publicado', draft: 'Borrador', closed: 'Cerrado', paused: 'Pausado', removed: 'Retirado' })[data.status] || data.status}</dd>
          <dt>Anfitrión</dt><dd>{data.hostId}</dd>
        </dl>
        {data.photosCount > 0 && <a className="button button-subtle" href={apiUrl(`/api/v1/rooms/${encodeURIComponent(listingId)}/photos/first`)} target="_blank" rel="noreferrer">Ver foto del anuncio</a>}
      </article>}
    </section>
  )
}

export function ReportListing() {
  const { session } = useAuth()
  const { listingId } = useParams()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const { data: listing, loading, error: listingError } = useRoomLinkQuery(`/api/v1/rooms/${encodeURIComponent(listingId)}`, session.token, refresh)

  async function submit(event) {
    event.preventDefault()
    if (saving || !listing || !reason) return
    setSaving(true)
    setError('')
    try {
      const result = await apiRequest(`/api/v1/moderation/reports/listings/${encodeURIComponent(listingId)}`, {
        token: session.token,
        method: 'POST',
        body: JSON.stringify({ reason, description: description.trim() || undefined }),
      })
      setReport(result)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="cesar-feature report-page">
      <FeatureHeading title="Denunciar anuncio" description={listing?.title || 'Cuéntanos qué sucede con esta publicación.'} />
      {loading && <FeatureNotice loading>Cargando anuncio…</FeatureNotice>}
      {listingError && <FeatureNotice error={listingError} retry={() => setRefresh((value) => value + 1)} />}
      {report && <div className="feature-feedback feature-success" role="status">Denuncia enviada. Folio {report.id}.</div>}
      {listing?.hostId === session.user.id && <FeatureNotice>Este anuncio pertenece a tu cuenta.</FeatureNotice>}
      {listing && listing.hostId !== session.user.id && !report && (
        <form className="review-card feature-form" onSubmit={submit}>
          <label className="field">Motivo
            <select required value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="">Selecciona un motivo</option>
              {Object.entries(reasons).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="field">Detalles opcionales
            <textarea rows={5} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          {error && <p className="feature-feedback feature-error" role="alert">{error}</p>}
          <div className="feature-actions">
            <Link className="button button-rose" to="/denunciar">Cancelar</Link>
            <button className="button button-mint" disabled={saving || !reason}>{saving ? 'Enviando…' : 'Enviar denuncia'}</button>
          </div>
        </form>
      )}
      {(report || listingError || listing?.hostId === session.user.id) && <Link className="button button-subtle" to="/denunciar">Volver a anuncios</Link>}
    </section>
  )
}

export function ReportDirectory() {
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const params = new URLSearchParams({ page, pageSize: 12, q: search, excludeHostId: session.user.id })
  const { data, loading, error } = useRoomLinkQuery(`/api/v1/rooms/feed?${params}`, session.token, refresh)

  return (
    <section className="cesar-feature report-page">
      <FeatureHeading title="Denunciar un anuncio" description="Busca la publicación que quieres reportar." />
      <form className="report-search" onSubmit={(event) => {
        event.preventDefault()
        setPage(1)
        setSearch(query.trim())
      }}>
        <label className="field">Buscar anuncio
          <input value={query} placeholder="Título o palabra clave" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button className="button button-mint">Buscar</button>
      </form>
      {error && <FeatureNotice error={error} retry={() => setRefresh((value) => value + 1)} />}
      {loading && <FeatureNotice>Buscando anuncios…</FeatureNotice>}
      {data && !data.items.length && <FeatureNotice>No encontramos anuncios.</FeatureNotice>}
      <div className="review-list">
        {data?.items.map((listing) => <article className="review-card report-result" key={listing.id}>
          <div>
            <h3>{listing.title}</h3>
            <p className="review-meta">{[listing.zone, listing.city, currency.format(listing.monthlyRent)].filter(Boolean).join(' · ')}</p>
          </div>
          <Link className="button button-rose" to={`/anuncios/${encodeURIComponent(listing.id)}/denunciar`} aria-label={`Denunciar ${listing.title}`}>Denunciar</Link>
        </article>)}
      </div>
      {(page > 1 || data?.hasMore) && <nav className="feature-actions" aria-label="Páginas de anuncios">
        <button className="button button-subtle" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page}</span>
        <button className="button button-mint" disabled={!data?.hasMore || loading} onClick={() => setPage(page + 1)}>Siguiente</button>
      </nav>}
    </section>
  )
}
