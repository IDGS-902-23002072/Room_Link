import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { apiRequest } from '../../services/api.js'
import { readLocal, writeLocal } from './storage.js'
import { Avatar, Feedback, Heading, Panel, ResourceStatus } from './Workspace.jsx'
import { useResource } from './useResource.js'

const agreementsPath = '/api/v1/agreements'
const categories = ['Limpieza', 'Pagos', 'Visitas', 'Ruido']
const emptyDraft = { title: '', startDate: '', listingId: '', roomieId: '', rules: {} }
const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

function formatDate(value) {
  return value ? dateFormat.format(new Date(value)) : 'Sin fecha'
}

function agreementTitle(item) {
  return item.rulesSnapshot.details?.title || item.rulesSnapshot.listingTitle || 'Acuerdo de convivencia'
}

function rulesFor(item) {
  const data = item.rulesSnapshot
  const costs = data.costs?.map(({ concept, amount, isIncluded, isProrated }) => (
    [concept, money.format(amount), isIncluded && 'Incluido', isProrated && 'Prorrateado'].filter(Boolean).join(' · ')
  )).join('\n')
  return [
    ['Limpieza y espacios comunes', data.commonAreasNotes],
    ['Renta y servicios', costs],
    ['Visitas y estancias', data.visitsPolicy],
    ['Horario de silencio', [data.quietHoursStart, data.quietHoursEnd].filter(Boolean).join(' – ')],
    ['Fiestas', typeof data.partiesAllowed === 'boolean' && (data.partiesAllowed ? 'Permitidas' : 'No permitidas')],
    ['Mascotas', typeof data.petsAllowed === 'boolean' && (data.petsAllowed ? 'Permitidas' : 'No permitidas')],
    ['Tabaco', typeof data.smokingAllowed === 'boolean' && (data.smokingAllowed ? 'Permitido' : 'No permitido')],
    ['Otras normas', data.extraRules],
    ['Inicio propuesto', data.details?.startDate],
    ...(data.details?.rules ?? []).map(({ category, title, description }) => [`${category}: ${title}`, description]),
  ].filter(([, value]) => value)
}

function downloadText(title, lines) {
  const documentUrl = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = documentUrl
  link.download = `${title}.txt`
  link.click()
  setTimeout(() => URL.revokeObjectURL(documentUrl), 1000)
}

function participantsFor(item) {
  return [item.hostId, ...item.roomieIds].map((id) => ({
    id,
    acceptedAt: item.acceptances.find(({ userId }) => userId === id)?.acceptedAt,
  }))
}

function latestByHousehold(items) {
  const households = new Map()
  for (const item of items) {
    const key = JSON.stringify([item.listingId, item.hostId, [...item.roomieIds].sort()])
    if (!households.has(key)) households.set(key, { current: null, pending: null })
    const household = households.get(key)
    const slot = item.fullyAccepted ? 'current' : 'pending'
    if (!household[slot] || item.version > household[slot].version) household[slot] = item
  }
  return [...households.values()].map(({ current, pending }) => ({
    current, pending: pending && (!current || pending.version > current.version) ? pending : null,
  }))
}

async function profileNames(ids, token, signal) {
  const names = await Promise.all([...new Set(ids)].map(async (id) => {
    try {
      const profile = await apiRequest(`/api/v1/profiles/${encodeURIComponent(id)}`, { token, signal })
      return [id, profile.fullName]
    } catch {
      return [id, null]
    }
  }))
  return Object.fromEntries(names)
}

export function AgreementsPage({ tab }) {
  const { agreementId } = useParams()
  if (tab === 'create') return <CreateAgreement />
  return <AgreementsList agreementId={agreementId} key={agreementId ?? tab} tab={tab} />
}

function AgreementsList({ agreementId, tab }) {
  const { session: { token, user } } = useAuth()
  const load = useCallback(async (signal) => {
    const options = { token, signal }
    const [data, rooms] = await Promise.all([
      apiRequest(`${agreementsPath}/by-user/${encodeURIComponent(user.id)}`, options),
      apiRequest(`/api/v1/rooms/host/${encodeURIComponent(user.id)}`, options),
    ])
    const hosted = await Promise.all(rooms.map(({ id }) => apiRequest(`${agreementsPath}/by-listing/${encodeURIComponent(id)}`, options)))
    const found = new Map([...data.items, ...hosted.flatMap(({ items }) => items)]
      .filter((item) => participantsFor(item).some(({ id }) => id === user.id))
      .map((item) => [item.id, item]))
    if (agreementId && !found.has(agreementId)) {
      const item = await apiRequest(`${agreementsPath}/${encodeURIComponent(agreementId)}`, options).catch((error) => {
        if (error.status === 404) return null
        throw error
      })
      if (item && participantsFor(item).some(({ id }) => id === user.id)) found.set(item.id, item)
    }
    const items = [...found.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const names = await profileNames(items.flatMap((item) => [item.hostId, ...item.roomieIds]), token, signal)
    return { items, names }
  }, [agreementId, token, user.id])
  const resource = useResource(load)

  return (
    <>
      {tab === 'review'
        ? <Heading title="Revisar y aceptar el acuerdo">Lee la versión compartida y consulta la respuesta de cada integrante.</Heading>
        : <Heading action={<Link className="button button-primary" to="/acuerdos/crear">Crear nuevo acuerdo</Link>} title="Acuerdos vigentes">Consulta los compromisos aceptados por los integrantes de tu hogar.</Heading>}
      <ResourceStatus label="Cargando tus acuerdos…" resource={resource} />
      {resource.data && (tab === 'review'
        ? <ReviewAgreement {...resource.data} token={token} user={user} />
        : <CurrentAgreements {...resource.data} token={token} user={user} />)}
    </>
  )
}

function CreateAgreement() {
  const { session: { token, user } } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => readLocal(user.id, 'agreement-draft', emptyDraft))
  const [category, setCategory] = useState(categories[0])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const loadRooms = useCallback((signal) => apiRequest(`/api/v1/rooms/host/${encodeURIComponent(user.id)}`, { token, signal }), [token, user.id])
  const rooms = useResource(loadRooms)
  const field = (name) => ({ value: draft[name], onChange: (event) => setDraft({ ...draft, [name]: event.target.value }) })
  const rule = draft.rules[category] ?? { title: '', description: '' }

  function persist(next) {
    try {
      writeLocal(user.id, 'agreement-draft', next)
      setDraft(next)
      setError('')
      setMessage('Borrador guardado en este navegador.')
    } catch (cause) {
      setError(cause.message)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!window.confirm('¿Enviar a revisión las reglas del anuncio y los detalles de este acuerdo?')) return
    setBusy(true)
    setError('')
    try {
      const roomPath = `/api/v1/applications/listing/${encodeURIComponent(draft.listingId)}`
      const [applications, versions] = await Promise.all([
        apiRequest(roomPath, { token }),
        apiRequest(`${agreementsPath}/by-listing/${encodeURIComponent(draft.listingId)}`, { token }),
      ])
      if (!applications.some((item) => item.status === 'accepted' && item.applicantId === draft.roomieId)) {
        throw new Error('Selecciona un roomie con una solicitud aceptada.')
      }
      const existing = versions.items.filter((entry) => entry.hostId === user.id && entry.roomieIds.length === 1 && entry.roomieIds.includes(draft.roomieId)).sort((a, b) => b.version - a.version)[0]
      const details = {
        title: draft.title.trim() || undefined,
        startDate: draft.startDate || undefined,
        rules: Object.entries(draft.rules)
          .filter(([, rule]) => rule.title.trim() || rule.description.trim())
          .map(([category, rule]) => ({ category, title: rule.title.trim(), description: rule.description.trim() })),
      }
      const stored = existing?.rulesSnapshot.details
      const unchanged = (stored?.title ?? '') === (details.title ?? '')
        && (stored?.startDate ?? '') === (details.startDate ?? '')
        && JSON.stringify(stored?.rules ?? []) === JSON.stringify(details.rules)
      const path = existing ? `${agreementsPath}/${encodeURIComponent(existing.id)}/versions` : agreementsPath
      const item = existing && unchanged ? existing : await apiRequest(path, {
        token, method: 'POST',
        body: JSON.stringify({ listingId: draft.listingId, hostId: user.id, roomieId: draft.roomieId, details }),
      })
      navigate(`/acuerdos/revisar/${encodeURIComponent(item.id)}`)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Heading action={<span className="room-pill">Borrador</span>} title="Crear acuerdo de convivencia">Redacta las normas de tu hogar y prepara un acuerdo para revisión.</Heading>
      <form className="room-stack" onSubmit={submit}>
        <div className="room-grid">
          <div className="room-stack">
            <Panel title="Información del acuerdo">
              <label className="field">Nombre del acuerdo<input maxLength={160} placeholder="Acuerdo de mi hogar" {...field('title')} /></label>
              <div className="room-fields">
                <label className="field">Hogar<select onChange={(event) => setDraft({ ...draft, listingId: event.target.value, roomieId: '' })} required value={draft.listingId}><option value="">Selecciona tu anuncio</option>{rooms.data?.map((room) => <option key={room.id} value={room.id}>{room.title}</option>)}</select></label>
                <label className="field">Inicio propuesto<input type="date" {...field('startDate')} /></label>
              </div>
              <ResourceStatus label="Cargando tus anuncios…" resource={rooms} />
              {rooms.data?.length === 0 && <p className="muted">Necesitas un anuncio propio para enviar un acuerdo.</p>}
            </Panel>
            <Panel title="Normas internas">
              <div aria-label="Categorías de normas" className="room-actions" role="group">{categories.map((name) => <button aria-pressed={category === name} className={`button button-${category === name ? 'primary' : 'secondary'}`} key={name} onClick={() => setCategory(name)} type="button">{name}</button>)}</div>
              <label className="field">Título de la norma<input maxLength={120} onChange={(event) => setDraft({ ...draft, rules: { ...draft.rules, [category]: { ...rule, title: event.target.value } } })} value={rule.title} /></label>
              <label className="field">Descripción y compromisos<textarea maxLength={2000} onChange={(event) => setDraft({ ...draft, rules: { ...draft.rules, [category]: { ...rule, description: event.target.value } } })} value={rule.description} /></label>
              <div className="room-actions">
                <button className="button button-secondary" disabled={!draft.rules[category]} onClick={() => {
                  const next = { ...draft.rules }
                  delete next[category]
                  persist({ ...draft, rules: next })
                }} type="button">Limpiar</button>
                <button className="button button-primary" disabled={!rule.title.trim() || !rule.description.trim()} onClick={() => persist(draft)} type="button">Guardar norma</button>
              </div>
              {Object.entries(draft.rules).filter(([name, value]) => name !== category && (value.title || value.description)).map(([name, value]) => (
                <div className="room-row room-rule" key={name}><div><h3>{value.title || name}</h3><p className="muted">{value.description}</p></div><button className="button button-secondary" onClick={() => setCategory(name)} type="button">Editar {name.toLowerCase()}</button></div>
              ))}
            </Panel>
            {preview && <Panel title={draft.title || 'Vista previa del borrador'}>{draft.startDate && <p>Inicio propuesto · {draft.startDate}</p>}{Object.entries(draft.rules).map(([name, value]) => <div className="room-rule" key={name}><h3>{value.title || name}</h3><p>{value.description}</p></div>)}</Panel>}
          </div>
          <div className="room-stack">
            <Panel title="Miembros del hogar">
              <div className="room-person"><Avatar name={user.email} /><div><strong>{user.email}</strong><p className="muted">Tú · Anfitrión</p></div></div>
              {draft.listingId && <HouseholdMember key={draft.listingId} listingId={draft.listingId} onChange={(roomieId) => setDraft({ ...draft, roomieId })} roomieId={draft.roomieId} token={token} />}
            </Panel>
            <Panel title="Antes de enviar">
              <ol><li>Revisa las normas con tu roomie.</li><li>Envía la versión para revisión.</li><li>Consulta la aceptación individual.</li></ol>
              <p className="muted">El nombre, la fecha y las normas personalizadas se incluyen en la versión enviada, junto con las reglas del anuncio.</p>
              <button aria-expanded={preview} className="button button-secondary" onClick={() => setPreview(!preview)} type="button">{preview ? 'Ocultar borrador' : 'Ver borrador'}</button>
            </Panel>
          </div>
        </div>
        <Feedback error={error}>{message}</Feedback>
        <div className="room-save">
          <Link className="button button-secondary" to="/acuerdos">Cancelar</Link>
          <div className="room-actions"><button className="button button-secondary" onClick={() => persist(draft)} type="button">Guardar borrador</button><button className="button button-primary" disabled={busy || !draft.listingId || !draft.roomieId} type="submit">{busy ? 'Enviando…' : 'Enviar acuerdo a revisión'}</button></div>
        </div>
      </form>
    </>
  )
}

function HouseholdMember({ listingId, roomieId, onChange, token }) {
  const load = useCallback(async (signal) => {
    const items = await apiRequest(`/api/v1/applications/listing/${encodeURIComponent(listingId)}`, { token, signal })
    const ids = items.filter((item) => item.status === 'accepted').map((item) => item.applicantId)
    return { ids, names: await profileNames(ids, token, signal) }
  }, [listingId, token])
  const resource = useResource(load)
  return (
    <>
      <ResourceStatus label="Cargando solicitudes aceptadas…" resource={resource} />
      {resource.data?.ids.length > 0 && <label className="field">Roomie<select onChange={(event) => onChange(event.target.value)} required value={roomieId}><option value="">Selecciona un roomie</option>{resource.data.ids.map((id) => <option key={id} value={id}>{resource.data.names[id] ?? `Roomie · ${id.slice(0, 8)}`}</option>)}</select></label>}
      {resource.data?.ids.length === 0 && <p className="muted">Este anuncio aún no tiene solicitudes aceptadas.</p>}
    </>
  )
}

function AgreementText({ item }) {
  const rules = rulesFor(item)
  return (
    <Panel title={agreementTitle(item)}>
      <div className="room-row"><span className="room-pill">Versión {item.version}</span><small>Creado el {formatDate(item.createdAt)}</small></div>
      {rules.length ? rules.map(([label, value], index) => <div className="room-rule" key={label}><h3>{index + 1}. {label}</h3><p className="room-download">{value}</p></div>) : <p className="muted">Esta versión no incluye normas adicionales.</p>}
    </Panel>
  )
}

function Participants({ item, names, user }) {
  const members = participantsFor(item)
  const total = members.filter(({ acceptedAt }) => acceptedAt).length
  return (
    <>
      <span className="room-pill">{total} de {members.length} aceptaron</span>
      {members.map(({ id, acceptedAt }) => {
        const name = id === user.id ? names[id] || user.email || 'Tu cuenta' : names[id] || (id === item.hostId ? 'Anfitrión' : 'Roomie')
        return <div className="room-person" key={id}><Avatar name={name} /><div><strong>{name}{id === user.id && ' (tú)'}</strong><p className="muted">{acceptedAt ? `Aceptado · ${formatDate(acceptedAt)}` : 'Pendiente de aceptación'}</p></div></div>
      })}
    </>
  )
}

function AgreementDownload({ item }) {
  return <button className="button button-secondary" onClick={() => downloadText(`acuerdo-v${item.version}`, [agreementTitle(item), `Versión ${item.version}`, `Creado el ${formatDate(item.createdAt)}`, '', ...rulesFor(item).flatMap(([label, value]) => [label, value, ''])])} type="button">Descargar documento</button>
}

function ReviewAgreement({ items, names, token, user }) {
  const { agreementId } = useParams()
  const pending = latestByHousehold(items).flatMap(({ pending }) => pending ? [pending] : [])
  const item = agreementId ? items.find(({ id }) => id === agreementId) : pending[0]
  return (
    <div className="room-stack">
      {pending.length > 1 && <nav aria-label="Acuerdos para revisar" className="room-actions">{pending.map((entry) => <Link aria-current={entry.id === item?.id ? 'page' : undefined} className="button button-secondary" key={entry.id} to={`/acuerdos/revisar/${encodeURIComponent(entry.id)}`}>{agreementTitle(entry)} · v{entry.version}</Link>)}</nav>}
      {item ? <ReviewDetail item={item} key={item.id} names={names} token={token} user={user} /> : <Panel><p>{agreementId ? 'El acuerdo no está disponible en tu cuenta.' : 'No hay acuerdos pendientes de revisión.'}</p><Link className="button button-secondary" to="/acuerdos">Consultar acuerdos vigentes</Link></Panel>}
    </div>
  )
}

function ReviewDetail({ item, names, token, user }) {
  const [version, setVersion] = useState(item)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [shareText, setShareText] = useState('')
  const [change, setChange] = useState(null)
  const [copyStatus, setCopyStatus] = useState('')
  const member = participantsFor(version).find(({ id }) => id === user.id)
  const reviewUrl = new URL(`/acuerdos/revisar/${encodeURIComponent(version.id)}`, window.location.href).href

  function prepareShare(text) {
    setCopyStatus('')
    setShareText(text)
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopyStatus('Texto copiado.')
    } catch {
      setCopyStatus('Selecciona y copia el texto manualmente.')
    }
  }

  async function accept() {
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest(`${agreementsPath}/${encodeURIComponent(version.id)}/accept`, { token, method: 'POST' })
      setVersion(result)
      setSaved(true)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="room-row"><p className="room-note">{version.fullyAccepted ? 'Todos los integrantes aceptaron esta versión.' : 'Esta versión estará vigente cuando todos los integrantes la acepten.'}</p><AgreementDownload item={version} /></div>
      <div className="room-grid">
        <div className="room-stack">
          <AgreementText item={version} />
          <Panel title="Tu respuesta">
            {member?.acceptedAt ? <p>Tu aceptación se registró el {formatDate(member.acceptedAt)}.</p> : (
              <>
                <label className="room-check"><input checked={checked} onChange={(event) => setChecked(event.target.checked)} type="checkbox" />He leído y acepto las normas de la versión {version.version}.</label>
                <p className="muted">Al confirmar se registran la versión y la fecha de aceptación.</p>
                <div className="room-actions">
                  <button aria-expanded={change !== null} className="button button-secondary" disabled={!member || busy} onClick={() => setChange(change === null ? '' : null)} type="button">Solicitar un cambio</button>
                  <button className="button button-primary" disabled={!member || !checked || busy} onClick={accept} type="button">Aceptar versión {version.version}</button>
                </div>
                {change !== null && <>
                  <label className="field">Cambio que quieres proponer<textarea maxLength={1000} onChange={(event) => setChange(event.target.value)} value={change} /></label>
                  <button className="button button-secondary" disabled={!change.trim()} onClick={() => prepareShare(`Propongo un cambio para «${agreementTitle(version)}» (v${version.version}).\n\n${change.trim()}\n\n${reviewUrl}`)} type="button">Preparar mensaje para compartir</button>
                </>}
              </>
            )}
            <Feedback error={error}>{saved && 'Aceptación registrada.'}</Feedback>
          </Panel>
        </div>
        <div className="room-stack">
          <Panel title="Estado de aceptación">
            <Participants item={version} names={names} user={user} />
            {!version.fullyAccepted &&
              <button className="button button-secondary" onClick={() => prepareShare(`Hola, está pendiente tu revisión de «${agreementTitle(version)}» (v${version.version}). Puedes leerlo aquí: ${reviewUrl}`)} type="button">Preparar recordatorio</button>}
          </Panel>
          {shareText && <Panel title="Compartir con tu hogar"><label className="field">Mensaje<textarea readOnly value={shareText} /></label><button className="button button-secondary" onClick={copyShare} type="button">Copiar mensaje</button>{copyStatus && <small role="status">{copyStatus}</small>}</Panel>}
          <Panel title="¿Qué pasa después?"><p>Una actualización requiere que todos acepten la misma versión.</p><Link className="button button-secondary" to="/acuerdos">Consultar acuerdos vigentes</Link></Panel>
        </div>
      </div>
    </>
  )
}

function CurrentAgreements({ items, names, token, user }) {
  const groups = latestByHousehold(items)
  const current = groups.flatMap((group) => group.current ? [group.current] : [])
  const pending = groups.flatMap((group) => group.pending ? [group.pending] : [])
  const [all, setAll] = useState(false)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const shown = all ? items : current
  const details = shown.find(({ id }) => id === selected) ?? shown[0]
  const canUpdate = details?.hostId === user.id && groups.some((group) => group.current?.id === details.id && !group.pending)

  async function createVersion() {
    if (!window.confirm('¿Crear una versión con las reglas actuales del anuncio y enviarla a revisión?')) return
    setBusy(true)
    setError('')
    try {
      const next = await apiRequest(`${agreementsPath}/${encodeURIComponent(details.id)}/versions`, { token, method: 'POST' })
      navigate(`/acuerdos/revisar/${encodeURIComponent(next.id)}`)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="room-stack">
      <div className="room-stats">
        <Panel><strong className="room-stat">{current.length}</strong><p>Acuerdos vigentes</p></Panel>
        <Panel><strong className="room-stat">{current.reduce((total, item) => total + participantsFor(item).filter(({ acceptedAt }) => acceptedAt).length, 0)}</strong><p>Aceptaciones vigentes</p></Panel>
        <Panel><strong className="room-stat">{pending.length}</strong><p>Versiones pendientes</p></Panel>
      </div>
      {pending.length > 0 && <p className="room-note">Las actualizaciones entran en vigor al completar todas las aceptaciones.</p>}
      <div className="room-grid room-grid-current">
        <div className="room-stack">
          <Panel title="Tu hogar">
            <div className="room-actions"><button aria-pressed={!all} className="button button-secondary" onClick={() => setAll(false)} type="button">Vigentes ({current.length})</button><button aria-pressed={all} className="button button-secondary" onClick={() => setAll(true)} type="button">Todas las versiones</button></div>
            {!shown.length && <p className="muted">{all ? 'Aún no tienes acuerdos.' : 'Aún no hay acuerdos vigentes.'}</p>}
            {shown.map((item) => <button aria-pressed={item.id === details?.id} className={`button button-${item.id === details?.id ? 'primary' : 'secondary'}`} key={item.id} onClick={() => setSelected(item.id)} type="button">{agreementTitle(item)} · v{item.version}</button>)}
          </Panel>
          {pending.map((item) => <Panel key={item.id} title="Acuerdo en revisión"><p>{agreementTitle(item)} · v{item.version}</p><Link className="button button-secondary" to={`/acuerdos/revisar/${encodeURIComponent(item.id)}`}>Revisar aceptación</Link></Panel>)}
        </div>
        {details && (
          <div className="room-stack">
            <AgreementText item={details} />
            <Panel title="Registro de aceptación"><span className="room-pill">{current.some(({ id }) => id === details.id) ? 'Vigente' : details.fullyAccepted ? 'Versión anterior' : 'Pendiente'}</span><Participants item={details} names={names} user={user} /><AgreementDownload item={details} />
              {canUpdate && <button className="button button-primary" disabled={busy} onClick={createVersion} type="button">Crear nueva versión</button>}
              <Feedback error={error} />
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
