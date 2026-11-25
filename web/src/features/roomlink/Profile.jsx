import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { apiAssetUrl, apiRequest } from '../../services/api.js'
import { readLocal, writeLocal } from './storage.js'
import { Avatar, Feedback, Heading, Panel, ResourceStatus, Toggle } from './Workspace.jsx'
import { useResource } from './useResource.js'

const profilePath = (id) => `/api/v1/profiles/${encodeURIComponent(id)}`
const json = (method, values) => ({ method, body: JSON.stringify(values) })
const photoUrl = (photo) => photo ? apiAssetUrl(photo.url) : undefined

async function loadProfile(path, token, signal) {
  const options = { token, signal }
  const profile = await apiRequest(path, options).catch((error) => {
    if (error.status === 404) return null
    throw error
  })
  const gallery = profile ? await apiRequest(`${path}/photos`, options) : null
  return { profile, photos: gallery?.photos ?? [] }
}

export function ProfilePage() {
  const { session } = useAuth()
  const { token, user } = session
  const path = profilePath(user.id)
  const load = useCallback((signal) => loadProfile(path, token, signal), [path, token])
  const resource = useResource(load)
  return (
    <>
      <Heading title="Datos personales">Edita cómo te presentas y mantén tus datos de contacto actualizados.</Heading>
      <ResourceStatus label="Cargando tu perfil…" resource={resource} />
      {resource.data && <ProfileForm {...resource.data} path={path} token={token} user={user} />}
    </>
  )
}

function ProfileForm({ profile, photos, path, token, user }) {
  const [saved, setSaved] = useState(() => ({
    fullName: profile?.fullName ?? '', birthDate: profile?.birthDate ?? '',
    occupation: profile?.occupation ?? '', bio: profile?.bio ?? '',
    phone: profile?.phone ?? '', instagram: profile?.instagram ?? '',
    city: readLocal(user.id, 'profile-city', ''),
  }))
  const [age, setAge] = useState(profile?.age)
  const [values, setValues] = useState(saved)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = Object.keys(saved).some((key) => saved[key] !== values[key])
  const mainPhoto = photoUrl(photos.find((photo) => photo.isMain) ?? photos[0])

  function field(name) {
    return { value: values[name], onChange: (event) => setValues({ ...values, [name]: event.target.value }) }
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const normalized = { ...values, fullName: values.fullName.trim(), instagram: values.instagram.trim() }
    const { fullName, occupation, bio, phone, birthDate, instagram, city } = normalized
    try {
      const updated = age == null
        ? await apiRequest('/api/v1/profiles', { token, ...json('POST', { fullName, occupation, bio, phone, birthDate, instagram }) })
        : await apiRequest(path, { token, ...json('PUT', { fullName, occupation, bio, phone }) })
      setAge(updated.age)
      if (age != null && instagram !== saved.instagram) {
        await apiRequest(`${path}/socials`, { token, ...json('PUT', { instagram }) })
      }
      if (city !== saved.city) writeLocal(user.id, 'profile-city', city.trim())
      const next = { ...normalized, city: city.trim() }
      setSaved(next)
      setValues(next)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  const name = values.fullName || 'Tu nombre'
  const progress = [values.fullName, values.occupation, values.city, values.bio, photos.length, profile?.isVerified].filter(Boolean).length
  return (
    <form className="room-stack" onSubmit={save}>
      <div className="room-grid">
        <div className="room-stack">
          <Panel title="Información visible">
            <p className="muted">Edita los datos que utilizas para presentarte a otros usuarios.</p>
            <div className="room-person"><Avatar name={name} src={mainPhoto} /><div><strong>{name}</strong><p className="muted">{values.city || 'Perfil en edición'}</p></div></div>
            <div className="room-fields">
              <label className="field">Nombre para mostrar<input autoComplete="name" maxLength={200} minLength={2} required {...field('fullName')} /></label>
              <label className="field">Ocupación<input maxLength={160} {...field('occupation')} /></label>
              <label className="field">Ciudad<input maxLength={120} {...field('city')} /><small>Guardada en este navegador.</small></label>
              {age == null ? <label className="field">Fecha de nacimiento<input required type="date" {...field('birthDate')} /></label> : <label className="field">Edad visible<input readOnly value={`${age} años`} /></label>}
            </div>
            <label className="field">Biografía<textarea maxLength={300} {...field('bio')} /><small>{values.bio.length} / 300 caracteres</small></label>
            <label className="field">Instagram (opcional)<input maxLength={255} placeholder="@usuario" {...field('instagram')} /></label>
          </Panel>
          <Panel title="Datos de contacto">
            <div className="room-fields">
              <label className="field">Correo electrónico<input readOnly type="email" value={user.email ?? ''} /></label>
              <label className="field">Teléfono<input autoComplete="tel" maxLength={30} type="tel" {...field('phone')} /></label>
            </div>
          </Panel>
        </div>
        <div className="room-stack">
          <Panel title="Tu perfil, a simple vista">
            <Avatar name={name} src={mainPhoto} />
            <h3>{name}{age == null ? '' : `, ${age}`}</h3>
            {values.occupation && <p>{values.occupation}</p>}
            {values.city && <p className="muted">{values.city}</p>}
            <span className="room-pill">Perfil completo al {Math.round(progress / 6 * 100)} %</span>
            <div className="room-actions">
              <button aria-expanded={preview} className="button button-subtle" onClick={() => setPreview(!preview)} type="button">{preview ? 'Ocultar vista previa' : 'Ver perfil público'}</button>
              <Link className="button button-subtle" to="/perfil/fotos">Gestionar fotos</Link>
            </div>
            {preview && <div className="room-rule"><h3>Vista previa</h3><p>{values.bio || 'Aún no has escrito una biografía.'}</p>{values.instagram && <p>Instagram {values.instagram}</p>}</div>}
          </Panel>
          <Panel title="Tú decides qué compartir"><p>Usa tu biografía para hablar de tus intereses y hábitos. Evita incluir datos personales en la descripción o las fotos.</p></Panel>
        </div>
      </div>
      <Feedback error={error} />
      <div className="room-save">
        <p className="muted" role="status">{dirty ? 'Cambios sin guardar' : 'Sin cambios pendientes'}</p>
        <div className="room-actions">
          <button className="button button-rose" disabled={busy || !dirty} onClick={() => { setValues(saved); setError('') }} type="button">Cancelar</button>
          <button className="button button-mint" disabled={busy || !dirty} type="submit">{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </form>
  )
}

const statuses = { unverified: 'Sin verificar', pending: 'Pendiente', verified: 'Verificada', rejected: 'Rechazada' }

export function PhotosPage() {
  const { session: { token, user } } = useAuth()
  const path = profilePath(user.id)
  const load = useCallback((signal) => loadProfile(path, token, signal), [path, token])
  const resource = useResource(load)
  const fileInput = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const photos = resource.data?.photos ?? []
  const status = resource.data?.profile?.identityStatus ?? 'unverified'

  async function act(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      resource.refresh()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  function upload(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError('Selecciona una imagen JPG, PNG o WEBP de hasta 5 MB.')
      return
    }
    const body = new FormData()
    body.append('photos', file)
    act(() => apiRequest(`${path}/photos`, { token, method: 'POST', body }))
  }

  return (
    <>
      <Heading title="Fotos y verificación">Administra tu galería y consulta el estado de verificación de tu identidad.</Heading>
      <ResourceStatus label="Cargando tus fotos…" resource={resource} />
      {resource.data && !resource.data.profile && <Panel><p>Crea tu perfil para subir fotos o solicitar la verificación.</p><Link className="button button-mint" to="/perfil">Completar datos personales</Link></Panel>}
      {resource.data?.profile && (
        <div className="room-grid">
          <Panel title="Galería del perfil">
            <p className="muted">{photos.length} de 6 fotos · Las imágenes son visibles para otros usuarios.</p>
            <input accept="image/jpeg,image/png,image/webp" hidden onChange={upload} ref={fileInput} type="file" />
            <div className="room-photo-grid">
              {photos.map((photo, index) => (
                <div key={photo.id}>
                  <img alt={`Foto de perfil ${index + 1}`} className="room-photo" src={photoUrl(photo)} />
                  {photo.isMain ? <span className="room-pill">Foto principal</span> : (
                    <button className="button button-subtle" disabled={busy} onClick={() => act(() => apiRequest(`${path}/photos/order`, { token, ...json('PUT', { photoIds: [photo.id, ...photos.filter((item) => item.id !== photo.id).map((item) => item.id)] }) }))} type="button">Hacer principal</button>
                  )}
                  <button aria-label={`Eliminar foto ${index + 1}`} className="button button-rose" disabled={busy} onClick={() => {
                    if (window.confirm('¿Eliminar esta foto del perfil?')) act(() => apiRequest(`${path}/photos/${encodeURIComponent(photo.id)}`, { token, method: 'DELETE' }))
                  }} type="button">Eliminar</button>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 6 - photos.length) }, (_, index) => (
                <div key={index}>
                  <button aria-label={`Subir foto al espacio ${photos.length + index + 1}`} className="room-photo-empty" disabled={busy} onClick={() => fileInput.current?.click()} type="button"><strong aria-hidden="true">+</strong>Subir foto</button>
                </div>
              ))}
            </div>
            <p className="muted">JPG, PNG o WEBP · Máximo 5 MB por foto.</p>
            <Feedback error={error} />
          </Panel>
          <div className="room-stack">
            <Panel title="Verifica tu identidad">
              <span className={status === 'rejected' ? 'room-pill feature-error' : 'room-pill'}>{statuses[status] ?? status}</span>
              <ol>
                <li>Prepara una identificación oficial vigente.</li>
                <li>Confirma tu identidad con una selfie.</li>
                <li>Consulta aquí el estado de revisión.</li>
              </ol>
              <p className="muted">La web permite iniciar la solicitud. La entrega de documentos y la selfie requieren un canal de verificación.</p>
              <button className="button button-mint" disabled={busy || status === 'pending' || status === 'verified'} onClick={() => act(() => apiRequest(`${path}/verification/request`, { token, method: 'POST' }))} type="button">Iniciar verificación</button>
              {status === 'pending' && <button className="button button-subtle" onClick={resource.refresh} type="button">Actualizar estado</button>}
            </Panel>
            <Panel title="Recomendación"><p>Sube fotos claras de ti. Evita documentos de identidad y datos personales en la galería pública.</p></Panel>
          </div>
        </div>
      )}
    </>
  )
}

export function IdentityReviewsPage() {
  const { session: { token } } = useAuth()
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback((signal) => apiRequest(`/api/v1/profiles/verification/pending?page=${page}`, { token, signal }), [page, token])
  const resource = useResource(load)

  async function decide(candidate, decision) {
    const action = decision === 'verified' ? 'aprobar' : 'rechazar'
    if (!window.confirm(`¿Quieres ${action} la solicitud de ${candidate.fullName}?`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const path = `${profilePath(candidate.userId)}/verification/decision`
      await apiRequest(path, { token, ...json('PUT', { decision }) })
      setMessage(decision === 'verified' ? 'Identidad verificada.' : 'Solicitud rechazada.')
      if (page > 1 && resource.data.items.length === 1) setPage(page - 1)
      else resource.refresh()
    } catch (cause) {
      setError(cause.message)
      resource.refresh()
    } finally {
      setBusy(false)
    }
  }

  return <div className="room-stack">
    <Heading title="Solicitudes de identidad">Resuelve las solicitudes después de revisar la identificación oficial en persona.</Heading>
    <ResourceStatus label="Cargando solicitudes." resource={resource} />
    <Feedback error={error}>{message}</Feedback>
    {resource.data && !resource.data.items.length && <Panel><p>No hay solicitudes pendientes en esta página.</p></Panel>}
    {resource.data?.items.map((candidate) => <Panel key={candidate.userId} title={candidate.fullName}>
      <p className="muted">ID de cuenta {candidate.userId}</p>
      <div className="room-actions">
        <button className="button button-mint" disabled={busy} onClick={() => decide(candidate, 'verified')} type="button">Aprobar</button>
        <button className="button button-subtle" disabled={busy} onClick={() => decide(candidate, 'rejected')} type="button">Rechazar</button>
      </div>
    </Panel>)}
    {(page > 1 || resource.data?.hasMore) && <nav aria-label="Paginación de solicitudes" className="room-row">
      <button className="button button-subtle" disabled={busy || page === 1} onClick={() => setPage(page - 1)} type="button">Anterior</button>
      <button className="button button-subtle" disabled={busy || !resource.data?.hasMore} onClick={() => setPage(page + 1)} type="button">Siguiente</button>
    </nav>}
  </div>
}

const accountDefaults = { locale: 'es-MX', timeZone: 'America/Mexico_City', visible: true, paused: false, matches: true }
const notificationOptions = [
  ['application_status_changed', 'Cambios en postulaciones', 'Cuando el anfitrión responda a tu postulación.'],
  ['connection_request', 'Solicitudes de conexión', 'Cuando alguien te envíe una solicitud.'],
  ['new_message', 'Nuevos mensajes', 'Cuando un roomie te envíe un mensaje.'],
  ['matches', 'Perfiles compatibles', 'Preferencia guardada en este navegador.'],
  ['agreement_pending', 'Acuerdos de convivencia', 'Solicitudes de aceptación de acuerdos.'],
  ['system', 'Novedades de RoomLink', 'Avisos generales de la plataforma.'],
]
const preferencePath = '/api/v1/notifications/preferences'

function HostEnrollment() {
  const { session: { token, user }, becomeHost } = useAuth()
  const isHost = user.roles?.includes('host')
  const path = profilePath(user.id)
  const load = useCallback(async (signal) => {
    if (isHost) return null
    try {
      return await apiRequest(path, { token, signal })
    } catch (error) {
      if (error.status === 404) return null
      throw error
    }
  }, [isHost, path, token])
  const profile = useResource(load)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const hasProfile = Boolean(profile.data?.fullName?.trim())
  const canEnroll = ['pending', 'verified'].includes(profile.data?.identityStatus)

  async function enroll(event) {
    event.preventDefault()
    if (!hasProfile || !canEnroll || !accepted || saving) return
    setSaving(true)
    setError('')
    try {
      await becomeHost(accepted)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Arrendador">
      {isHost ? <p className="room-note" role="status">Tu cuenta ya tiene el rol de arrendador.</p> : (
        <>
          <ResourceStatus label="Comprobando tu perfil…" resource={profile} />
          {!profile.loading && !profile.error && !hasProfile && (
            <>
              <p>Completa tu perfil para activar el rol de arrendador.</p>
              <Link className="button button-subtle" to="/perfil">Completar perfil</Link>
            </>
          )}
          {hasProfile && !canEnroll && (
            <>
              <p>Solicita la verificación de tu identidad para continuar.</p>
              <Link className="button button-subtle" to="/perfil/fotos">Ir a fotos y verificación</Link>
            </>
          )}
          {hasProfile && canEnroll && (
            <form className="room-stack" onSubmit={enroll}>
              <label className="room-check">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
                Acepto los términos de responsabilidad del arrendador.
              </label>
              <button className="button button-mint" disabled={!accepted || saving}>
                {saving ? 'Activando…' : 'Convertirme en arrendador'}
              </button>
              <Feedback error={error} />
            </form>
          )}
        </>
      )}
    </Panel>
  )
}

export function AccountPage() {
  const { session: { token, user } } = useAuth()
  const load = useCallback((signal) => apiRequest(preferencePath, { token, signal }), [token])
  const resource = useResource(load)
  return (
    <>
      <Heading title="Cuenta y notificaciones">Configura tus preferencias y decide qué avisos recibir en la web.</Heading>
      <div className="room-stack">
        <HostEnrollment />
        <ResourceStatus label="Cargando tus preferencias…" resource={resource} />
        {resource.data && <AccountForm preferences={resource.data.preferences} token={token} user={user} />}
        <ContactPrivacy key={user.id} path={`${profilePath(user.id)}/privacy`} token={token} />
        <HousingPreferences key={`housing-${user.id}`} userId={user.id} token={token} />
      </div>
    </>
  )
}

const privacyFields = [
  ['showPhoneToConnections', 'Compartir teléfono'],
  ['showEmailToConnections', 'Compartir correo'],
  ['showSocialsToConnections', 'Compartir redes sociales'],
]

function ContactPrivacy({ path, token }) {
  const load = useCallback((signal) => apiRequest(path, { token, signal }), [path, token])
  const resource = useResource(load)
  return <Panel title="Privacidad de contacto">
    <p className="muted">Elige qué datos pueden consultar tus conexiones aceptadas.</p>
    <ResourceStatus label="Cargando privacidad." resource={resource} />
    {resource.data && <ContactPrivacyForm initial={resource.data} path={path} token={token} />}
  </Panel>
}

function ContactPrivacyForm({ initial, path, token }) {
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const dirty = privacyFields.some(([key]) => values[key] !== saved[key])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const body = Object.fromEntries(privacyFields.map(([key]) => [key, values[key]]))
      const result = await apiRequest(path, { token, ...json('PUT', body) })
      setSaved(result)
      setValues(result)
      setMessage('Privacidad guardada.')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  return <form className="room-stack" onSubmit={submit}>
    <fieldset disabled={busy}>
      {privacyFields.map(([key, label]) => <Toggle checked={values[key]} key={key} label={label} onChange={(checked) => setValues({ ...values, [key]: checked })} />)}
    </fieldset>
    <Feedback error={error}>{message}</Feedback>
    <button className="button button-mint" disabled={busy || !dirty} type="submit">Guardar privacidad</button>
  </form>
}

const noNumberKeys = (event) => { if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault() }

function HousingPreferences({ userId, token }) {
  const path = `${profilePath(userId)}/housing`
  const loadPrefs = useCallback((signal) => apiRequest(path, { token, signal }), [path, token])
  const prefs = useResource(loadPrefs)
  const loadZones = useCallback((signal) => apiRequest('/api/v1/search/zones', { token, signal }), [token])
  const zones = useResource(loadZones)
  return <Panel title="Preferencias de vivienda">
    <p className="muted">Indica tu presupuesto y zona deseada para que otros roomies te encuentren en la búsqueda avanzada.</p>
    <ResourceStatus label="Cargando preferencias." resource={prefs} />
    {prefs.data && <HousingForm initial={prefs.data} zones={zones.data ?? []} path={path} token={token} />}
  </Panel>
}

function HousingForm({ initial, zones, path, token }) {
  const start = {
    budgetMin: initial.budgetMin ?? '',
    budgetMax: initial.budgetMax ?? '',
    desiredZoneId: initial.desiredZoneId ?? '',
  }
  const [saved, setSaved] = useState(start)
  const [values, setValues] = useState(start)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const dirty = ['budgetMin', 'budgetMax', 'desiredZoneId'].some((key) => values[key] !== saved[key])

  async function submit(event) {
    event.preventDefault()
    if (values.budgetMin && values.budgetMax && Number(values.budgetMin) > Number(values.budgetMax)) {
      setError('El presupuesto mínimo no puede superar el máximo.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await apiRequest(path, { token, ...json('PUT', {
        budgetMin: values.budgetMin === '' ? null : Number(values.budgetMin),
        budgetMax: values.budgetMax === '' ? null : Number(values.budgetMax),
        desiredZoneId: values.desiredZoneId || null,
      }) })
      const next = {
        budgetMin: result.budgetMin ?? '',
        budgetMax: result.budgetMax ?? '',
        desiredZoneId: result.desiredZoneId ?? '',
      }
      setSaved(next)
      setValues(next)
      setMessage('Preferencias de vivienda guardadas.')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  return <form className="room-stack" onSubmit={submit}>
    <fieldset disabled={busy}><legend>Presupuesto mensual · MXN</legend><div className="room-fields">
      <label className="field">Mínimo<input min="0" type="number" value={values.budgetMin} onKeyDown={noNumberKeys} onChange={(event) => setValues({ ...values, budgetMin: event.target.value })} /></label>
      <label className="field">Máximo<input min="0" type="number" value={values.budgetMax} onKeyDown={noNumberKeys} onChange={(event) => setValues({ ...values, budgetMax: event.target.value })} /></label>
    </div></fieldset>
    <label className="field">Zona deseada<select disabled={busy} value={values.desiredZoneId} onChange={(event) => setValues({ ...values, desiredZoneId: event.target.value })}>
      <option value="">Sin preferencia</option>
      {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.city}</option>)}
    </select></label>
    <Feedback error={error}>{message}</Feedback>
    <button className="button button-mint" disabled={busy || !dirty} type="submit">Guardar preferencias</button>
  </form>
}

function AccountForm({ preferences, token, user }) {
  const [saved, setSaved] = useState(() => ({
    ...accountDefaults, ...readLocal(user.id, 'account-preferences', {}),
    ...Object.fromEntries(preferences.map(({ type, inApp }) => [type, inApp])),
  }))
  const [values, setValues] = useState(saved)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [emailPrefs, setEmailPrefs] = useState(() => Object.fromEntries(preferences.map(({ type, emailOptIn }) => [type, emailOptIn === true])))
  const [savedEmailPrefs, setSavedEmailPrefs] = useState(emailPrefs)
  const [permission, setPermission] = useState(() => window.Notification?.permission ?? 'unsupported')
  const dirty = Object.keys(saved).some((key) => saved[key] !== values[key]) || Object.keys(emailPrefs).some((key) => emailPrefs[key] !== savedEmailPrefs[key])
  const set = (key, value) => setValues({ ...values, [key]: value })

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const changes = preferences.filter(({ type }) => values[type] !== saved[type] || emailPrefs[type] !== savedEmailPrefs[type])
      if (changes.length) {
        await apiRequest(preferencePath, { token, ...json('PUT', { preferences: changes.map((pref) => ({ type: pref.type, inApp: values[pref.type], email: Boolean(emailPrefs[pref.type]) })) }) })
      }
      const local = Object.fromEntries(Object.keys(accountDefaults).map((key) => [key, values[key]]))
      if (Object.keys(local).some((key) => local[key] !== saved[key])) writeLocal(user.id, 'account-preferences', local)
      setSaved(values)
      setSavedEmailPrefs(emailPrefs)
      setMessage('Preferencias guardadas.')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  async function testNotice() {
    setError('')
    setMessage('')
    try {
      const current = await window.Notification.requestPermission()
      setPermission(current)
      if (current === 'granted') {
        const registration = await navigator.serviceWorker?.getRegistration()
        if (registration?.active) await registration.showNotification('RoomLink', { body: 'Este es un aviso de prueba.' })
        else new window.Notification('RoomLink', { body: 'Este es un aviso de prueba.' })
        setMessage('Aviso de prueba enviado.')
      }
    } catch {
      setError('Este navegador no pudo mostrar el aviso de prueba.')
    }
  }

  async function resetPassword() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await apiRequest('/api/v1/auth/password/forgot', json('POST', { email: user.email }))
      setMessage(result.message)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="room-stack" onSubmit={save}>
      <div className="room-grid">
        <div className="room-stack">
          <Panel title="Preferencias de cuenta">
            <div className="room-fields">
              <label className="field">Idioma preferido<select onChange={(event) => set('locale', event.target.value)} value={values.locale}><option value="es-MX">Español (México)</option><option value="en-US">Inglés (Estados Unidos)</option></select></label>
              <label className="field">Zona horaria<select onChange={(event) => set('timeZone', event.target.value)} value={values.timeZone}><option value="America/Mexico_City">Ciudad de México</option><option value="America/Tijuana">Tijuana</option><option value="America/Cancun">Cancún</option><option value="America/Chihuahua">Chihuahua</option></select></label>
            </div>
            <Toggle checked={values.visible} description="Preferencia local de visibilidad." label="Mostrar mi perfil en búsquedas" onChange={(checked) => set('visible', checked)} />
            <Toggle checked={values.paused} description="Preferencia local de disponibilidad." label="Pausar mi búsqueda de roomies" onChange={(checked) => set('paused', checked)} />
            <p className="muted">Estas preferencias se guardan en este navegador. La visibilidad efectiva depende del servicio de búsqueda.</p>
          </Panel>
          <Panel title="Notificaciones web">
            {notificationOptions.map(([key, label, description]) => <Toggle checked={Boolean(values[key])} description={description} key={key} label={label} onChange={(checked) => set(key, checked)} />)}
          </Panel>
          <Panel title="Avisos por correo">
            <p>Los avisos se envían al correo verificado de tu cuenta.</p>
            {notificationOptions.filter(([type]) => ['application_status_changed', 'connection_request'].includes(type)).map(([type, label]) =>
              <Toggle key={type} label={label} checked={Boolean(emailPrefs[type])} onChange={(checked) => setEmailPrefs((current) => ({ ...current, [type]: checked }))} />
            )}
          </Panel>
        </div>
        <div className="room-stack">
          <Panel title="Permiso del navegador">
            <span className={permission === 'denied' ? 'room-pill feature-error' : 'room-pill'}>{{ granted: 'Notificaciones permitidas', denied: 'Permiso bloqueado', default: 'Permiso pendiente', unsupported: 'No disponible' }[permission]}</span>
            <button className="button button-subtle" disabled={permission === 'denied' || permission === 'unsupported'} onClick={testNotice} type="button">{permission === 'granted' ? 'Enviar aviso de prueba' : 'Permitir avisos y probar'}</button>
            <p className="muted">Puedes cambiar el permiso desde la configuración del navegador.</p>
          </Panel>
          <Panel title="Seguridad de la cuenta">
            <p>Solicita instrucciones para cambiar tu contraseña.</p>
            <button className="button button-subtle" disabled={busy || !user.email} onClick={resetPassword} type="button">Cambiar contraseña</button>
            <h3>Sesión actual</h3><p className="muted">Navegador web · {user.email}</p>
            <p className="muted">La gestión de otras sesiones aún no está disponible.</p>
          </Panel>
        </div>
      </div>
      <Feedback error={error}>{message}</Feedback>
      <div className="room-save"><p className="muted">{dirty ? 'Cambios sin guardar' : 'Sin cambios pendientes'}</p><div className="room-actions"><button className="button button-rose" disabled={busy || !dirty} onClick={() => { setValues(saved); setEmailPrefs(savedEmailPrefs) }} type="button">Cancelar</button><button className="button button-mint" disabled={busy || !dirty} type="submit">Guardar cambios</button></div></div>
    </form>
  )
}
