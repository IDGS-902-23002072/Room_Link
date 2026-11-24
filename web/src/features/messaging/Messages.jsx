import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useRoomLinkQuery } from '../../hooks/useRoomLinkQuery.js'
import { apiRequest } from '../../services/api.js'
import { FeatureHeading, FeatureNotice } from '../cesar-ui.jsx'
import { formatMoment } from '../../utils/formatDate.js'
import { listenToRoom } from './messageEvents.js'

const messagesPath = '/api/v1/messages'
const pageSize = 50
const time = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' })

function makeKey(id) {
  return encodeURIComponent(id)
}

function usePeerName(id, token) {
  const { data } = useRoomLinkQuery(id ? `/api/v1/profiles/${makeKey(id)}` : null, token)
  return data?.fullName || 'Roomie'
}

function ChatAvatar({ name }) {
  return <span className="chat-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
}

function InboxItem({ item, token }) {
  const name = usePeerName(item.counterpartId, token)
  return (
    <NavLink className="chat-person" to={`/mensajes/${makeKey(item.room.id)}`}>
      <ChatAvatar name={name} />
      <span className="chat-person-text">
        <strong>{name}</strong>
        <small>{item.lastMessage?.body || 'Conversación nueva'}</small>
      </span>
      {item.unreadCount > 0 && <span className="feature-badge feature-success" aria-label={`${item.unreadCount} sin leer`}>{item.unreadCount}</span>}
    </NavLink>
  )
}

function AcceptedConnection({ connection, token, userId, open, opening }) {
  const peerId = connection.requesterId === userId ? connection.addresseeId : connection.requesterId
  const name = usePeerName(peerId, token)
  return (
    <button className="chat-person" type="button" disabled={opening} onClick={() => open({ connectionId: connection.id })}>
      <ChatAvatar name={name} />
      <span className="chat-person-text"><strong>{name}</strong><small>Conexión aceptada</small></span>
      <span aria-hidden="true">→</span>
    </button>
  )
}

function ChatDetails({ context, name, token }) {
  const { data: listing } = useRoomLinkQuery(
    context.listingId ? `/api/v1/rooms/${makeKey(context.listingId)}` : null, token,
  )
  return (
    <section className="chat-details">
      <h3>Detalles de la conversación</h3>
      <dl>
        <dt>Participante</dt><dd>{name}</dd>
        <dt>Origen</dt><dd>{context.applicationId ? 'Postulación aceptada' : 'Conexión aceptada'}</dd>
        {context.listingId && <>
          <dt>Anuncio</dt><dd>{listing?.title || context.listingId}</dd>
        </>}
      </dl>
      {context.listingId && <Link className="button button-rose" to={`/anuncios/${makeKey(context.listingId)}/denunciar`}>Denunciar anuncio</Link>}
    </section>
  )
}

function Conversation({ roomId, session, refreshInbox }) {
  const root = `${messagesPath}/rooms/${makeKey(roomId)}`
  const { user, token } = session
  const [refresh, setRefresh] = useState(0)
  const [retryContext, setRetryContext] = useState(0)
  const { data: context, loading: loadingContext, error: contextError } = useRoomLinkQuery(`${root}/context`, token, retryContext)
  const authorized = Boolean(context)
  const { data: recent, loading, error } = useRoomLinkQuery(`${root}/messages?limit=${pageSize}`, token, refresh)
  const name = usePeerName(context?.counterpartId, token)
  const [older, setOlder] = useState([])
  const [sent, setSent] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [paging, setPaging] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [actionError, setActionError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [live, setLive] = useState(false)
  const viewport = useRef(null)
  const lastSeen = useRef(null)

  const messages = useMemo(() => Array.from(
    new Map([...older, ...sent, ...(recent || [])].map((message) => [message.id, message])).values(),
  ).sort((a, b) => a.id - b.id), [older, sent, recent])
  const newest = messages.at(-1)?.id

  const update = useCallback(() => setRefresh((value) => value + 1), [])

  useEffect(() => {
    if (!authorized) return
    const controller = new AbortController()
    let reconnect

    async function connect() {
      try {
        await listenToRoom(`${root}/events`, token, controller.signal, (event, details) => {
          if (event === 'connected') setLive(true)
          if (details.readerId === user.id || details.recipientId === user.id) return
          if (event === 'connected' || event.startsWith('message.')) update()
          if (event === 'message.created') refreshInbox()
        })
      } catch {
        // Keep the conversation current via HTTP while reconnecting.
      }
      if (controller.signal.aborted) return
      setLive(false)
      reconnect = window.setTimeout(() => {
        update()
        refreshInbox()
        void connect()
      }, 5000)
    }

    void connect()
    return () => {
      controller.abort()
      window.clearTimeout(reconnect)
      setLive(false)
    }
  }, [root, token, authorized, user.id, refreshInbox, update])

  useEffect(() => {
    const container = viewport.current
    if (!newest || !container || lastSeen.current === newest) return
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160
    if (!lastSeen.current || nearBottom || messages.at(-1)?.senderId === user.id) {
      container.scrollTop = container.scrollHeight
    }
    lastSeen.current = newest
  }, [newest, messages, user.id])

  useEffect(() => {
    const unread = recent?.filter((message) => message.senderId !== user.id && !message.readAt) ?? []
    if (!unread.length) return
    let reading = false
    const controller = new AbortController()
    const patch = (suffix) => apiRequest(`${root}/${suffix}`, { token, method: 'PATCH', signal: controller.signal })

    async function acknowledge() {
      if (reading) return
      const deliver = unread.some((message) => !message.deliveredAt)
      const read = document.visibilityState === 'visible'
      reading = true
      try {
        if (deliver) await patch('delivered')
        if (read) {
          const { updated } = await patch('read')
          if (!controller.signal.aborted && updated > 0) {
            refreshInbox()
            update()
          }
        }
      } catch {
        // Reconnect and visibility changes retry acknowledgements.
      } finally {
        reading = false
      }
    }

    void acknowledge()
    document.addEventListener('visibilitychange', acknowledge)
    return () => {
      controller.abort()
      document.removeEventListener('visibilitychange', acknowledge)
    }
  }, [recent, root, token, user.id, refreshInbox, update])

  async function send(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setActionError('')
    try {
      const message = await apiRequest(`${root}/messages`, {
        token, method: 'POST', body: JSON.stringify({ body }),
      })
      setSent((items) => [...items, message])
      setDraft('')
      refreshInbox()
      update()
    } catch (cause) {
      setActionError(cause.message)
    } finally {
      setSending(false)
    }
  }

  async function loadOlder() {
    if (paging || !messages.length) return
    setPaging(true)
    setActionError('')
    const container = viewport.current
    const previousHeight = container.scrollHeight
    try {
      const page = await apiRequest(`${root}/messages?limit=${pageSize}&beforeId=${messages[0].id}`, { token })
      setOlder((items) => [...page, ...items])
      setHasMore(page.length === pageSize)
      window.requestAnimationFrame(() => { container.scrollTop += container.scrollHeight - previousHeight })
    } catch (cause) {
      setActionError(cause.message)
    } finally {
      setPaging(false)
    }
  }

  return (
    <article className="chat-room">
      <header className="chat-header">
        <Link className="chat-back" to="/mensajes" aria-label="Volver a conversaciones">←</Link>
        <ChatAvatar name={name} />
        <div className="chat-header-name">
          <h2>{name}</h2>
          <p>{context && (live ? 'Chat privado' : 'Reconectando…')}</p>
        </div>
        <button className="button button-subtle" disabled={!context} aria-expanded={showDetails} type="button" onClick={() => setShowDetails((value) => !value)}>
          {showDetails ? 'Ocultar detalles' : 'Detalles'}
        </button>
      </header>
      {showDetails && context && <ChatDetails context={context} name={name} token={token} />}
      <div className="chat-scroll" ref={viewport}>
        {(error || contextError) && <FeatureNotice error={error || contextError} retry={() => {
          update()
          if (contextError) setRetryContext((value) => value + 1)
        }} />}
        {(loading || loadingContext) && <FeatureNotice>Cargando conversación…</FeatureNotice>}
        {recent?.length === pageSize && hasMore && <button className="button button-subtle chat-older" disabled={paging} type="button" onClick={loadOlder}>{paging ? 'Cargando…' : 'Ver mensajes anteriores'}</button>}
        {!loading && !error && !messages.length && <FeatureNotice>Envía un saludo para empezar la conversación.</FeatureNotice>}
        <ol className="chat-bubbles" aria-label="Historial de mensajes">
          {messages.map((message) => {
            const mine = message.senderId === user.id
            return (
              <li className={mine ? 'chat-bubble chat-mine' : 'chat-bubble'} key={message.id}>
                <p>{message.body}</p>
                <small><time dateTime={message.sentAt} title={formatMoment(message.sentAt)}>{time.format(new Date(message.sentAt))}</time>
                  {mine && ` · ${message.readAt ? 'Leído' : message.deliveredAt ? 'Entregado' : 'Enviado'}`}
                </small>
              </li>
            )
          })}
        </ol>
      </div>
      {actionError && <p role="alert" className="feature-feedback feature-error chat-feedback">{actionError}</p>}
      <form className="chat-composer" onSubmit={send}>
        <label className="visually-hidden" htmlFor="message-body">Mensaje</label>
        <textarea id="message-body" rows={1} maxLength={4000} placeholder="Escribe un mensaje…" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!context || sending} />
        <button className="button button-mint" disabled={!context || !draft.trim() || sending}>{sending ? 'Enviando…' : 'Enviar'} <span aria-hidden="true">↑</span></button>
      </form>
    </article>
  )
}

export default function Messages() {
  const { session } = useAuth()
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [inboxRefresh, setInboxRefresh] = useState(0)
  const [openError, setOpenError] = useState('')
  const [opening, setOpening] = useState(false)
  const [applicationId, setApplicationId] = useState('')
  const [showApplication, setShowApplication] = useState(false)
  const refreshInbox = useCallback(() => setInboxRefresh((value) => value + 1), [])
  const { data: inbox, loading, error } = useRoomLinkQuery(messagesPath, session.token, inboxRefresh)
  const { data: connections, error: connectionsError } = useRoomLinkQuery('/api/v1/connections', session.token, inboxRefresh)

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshInbox()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [refreshInbox])

  const rooms = [...(inbox || [])].sort((a, b) =>
    (b.lastMessage?.sentAt || b.room.createdAt).localeCompare(a.lastMessage?.sentAt || a.room.createdAt),
  )
  const connected = new Set(rooms.map(({ room }) => room.connectionId))
  const eligible = (connections || []).filter((connection) => connection.status === 'accepted' && !connected.has(connection.id))

  async function open(origin) {
    if (opening) return
    setOpening(true)
    setOpenError('')
    try {
      const room = await apiRequest(`${messagesPath}/rooms`, {
        token: session.token, method: 'POST', body: JSON.stringify(origin),
      })
      setApplicationId('')
      setShowApplication(false)
      refreshInbox()
      navigate(`/mensajes/${makeKey(room.id)}`)
    } catch (cause) {
      setOpenError(cause.message)
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="cesar-feature">
      <FeatureHeading title="Mensajes" description="Conversa en privado con tus roomies y coordinen los siguientes pasos." />
      <div className={`chat-layout${roomId ? ' chat-layout-selected' : ''}`}>
        <aside className="chat-inbox" aria-label="Bandeja de conversaciones">
          <h2>Conversaciones <span className="feature-badge">{rooms.length}</span></h2>
          {error && <FeatureNotice error={error} retry={refreshInbox} />}
          {loading && <FeatureNotice>Cargando conversaciones…</FeatureNotice>}
          {!loading && !error && !rooms.length && <FeatureNotice>Tus conversaciones aparecerán aquí.</FeatureNotice>}
          <nav className="chat-list" aria-label="Conversaciones">
            {rooms.map((item) => <InboxItem key={item.room.id} item={item} token={session.token} />)}
          </nav>
          <section className="chat-start">
            <h3>Nueva conversación</h3>
            {connectionsError && <FeatureNotice error={connectionsError} retry={refreshInbox} />}
            {eligible.map((connection) => <AcceptedConnection key={connection.id} connection={connection} token={session.token} userId={session.user.id} open={open} opening={opening} />)}
            <button className="button button-subtle" type="button" aria-expanded={showApplication} onClick={() => setShowApplication((value) => !value)}>Abrir desde una postulación</button>
            {showApplication && (
              <form className="feature-form" onSubmit={(event) => {
                event.preventDefault()
                if (applicationId.trim()) void open({ applicationId: applicationId.trim() })
              }}>
                <label className="field">ID de la postulación aceptada
                  <input required value={applicationId} onChange={(event) => setApplicationId(event.target.value)} />
                </label>
                <button className="button button-mint" disabled={opening || !applicationId.trim()}>Abrir chat</button>
              </form>
            )}
            {openError && <FeatureNotice error={openError} />}
          </section>
        </aside>
        {roomId ? <Conversation key={roomId} roomId={roomId} session={session} refreshInbox={refreshInbox} /> : (
          <section className="chat-placeholder">
            <span className="feature-illustration" aria-hidden="true">···</span>
            <h2>Tu espacio para conversar</h2>
            <p>Abre una conversación cuando tengas una conexión o postulación aceptada.</p>
          </section>
        )}
      </div>
    </div>
  )
}
