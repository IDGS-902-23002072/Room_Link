import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useRoomLinkQuery } from '../hooks/useRoomLinkQuery.js'
import { apiRequest } from '../services/api.js'
import { FeatureHeading, FeatureNotice } from './cesar-ui.jsx'

const endpoint = '/api/v1/notifications'
const pageSize = 25

function destination(item) {
  if (item.type === 'new_message' && item.payload?.roomId) {
    return ['/mensajes/' + encodeURIComponent(item.payload.roomId), 'Abrir conversación']
  }
  if (item.type === 'application_status_changed') return ['/explorar', 'Ir a explorar']
  return null
}

export default function Notifications() {
  const { session } = useAuth()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const path = `${endpoint}?unreadOnly=${unreadOnly}&limit=${pageSize}&offset=${page * pageSize}`
  const query = useRoomLinkQuery(path, session.token, refresh)

  async function mark(id) {
    if (working) return
    setWorking(true)
    setError('')
    try {
      await apiRequest(id ? `${endpoint}/${encodeURIComponent(id)}/read` : `${endpoint}/mark-all-read`, {
        method: id ? 'PATCH' : 'POST', token: session.token,
      })
      if (unreadOnly) setPage(0)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="cesar-feature report-page">
      <FeatureHeading title="Notificaciones" description="Consulta solicitudes, mensajes y avisos de RoomLink." />
      <div className="feature-actions">
        <button className="button button-subtle" type="button" aria-pressed={unreadOnly} onClick={() => {
          setPage(0)
          setUnreadOnly((current) => !current)
        }}>Solo sin leer</button>
        <button className="button button-mint" type="button" disabled={working || !query.data?.unreadCount} onClick={() => mark()}>Marcar todas como leídas</button>
        <Link className="access-link" to="/perfil/cuenta">Preferencias</Link>
      </div>
      {query.data && <p role="status">Sin leer: {query.data.unreadCount}</p>}
      {query.loading && <FeatureNotice>Cargando notificaciones…</FeatureNotice>}
      {query.error && <FeatureNotice error={query.error} retry={() => setRefresh((value) => value + 1)} />}
      {error && <FeatureNotice error={error} />}
      {query.data && !query.data.items.length && <FeatureNotice>No hay notificaciones en esta vista.</FeatureNotice>}
      <div className="review-list">
        {query.data?.items.map((item) => {
          const action = destination(item)
          return (
            <article key={item.id} className="review-card">
              <h2>{item.title}</h2>
              {item.body && <p>{item.body}</p>}
              <div className="feature-actions">
                <time dateTime={item.createdAt}>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(item.createdAt))}</time>
                {!item.readAt && <button className="button button-subtle" type="button" disabled={working} onClick={() => mark(item.id)}>Marcar como leída</button>}
                {action && <Link className="access-link" to={action[0]}>{action[1]}</Link>}
              </div>
            </article>
          )
        })}
      </div>
      {(page > 0 || query.data?.items.length === pageSize) && <nav className="feature-actions" aria-label="Páginas de notificaciones">
        <button className="button button-subtle" disabled={page === 0 || query.loading} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page + 1}</span>
        <button className="button button-subtle" disabled={query.data?.items.length !== pageSize} onClick={() => setPage(page + 1)}>Siguiente</button>
      </nav>}
    </section>
  )
}
