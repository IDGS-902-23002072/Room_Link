import { API_URL, apiRequest } from '../../services/api.js'

export const FEED_PAGE_SIZE = 12

// Filtros de renta mensual máxima del feed (el backend recibe `maxRent`).
export const RENT_FILTERS = [
  { id: 'any', label: 'Cualquier precio', maxRent: undefined },
  { id: '3000', label: 'Hasta $3,000', maxRent: 3000 },
  { id: '5000', label: 'Hasta $5,000', maxRent: 5000 },
  { id: '8000', label: 'Hasta $8,000', maxRent: 8000 },
]

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Feed público de habitaciones publicadas (GET /api/v1/rooms/feed). */
export function getRoomFeed({ page, search, maxRent, excludeHostId }) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(FEED_PAGE_SIZE),
  })
  if (search?.trim()) params.set('q', search.trim())
  if (maxRent) params.set('maxRent', String(maxRent))
  if (excludeHostId) params.set('excludeHostId', excludeHostId)
  return apiRequest(`/api/v1/rooms/feed?${params.toString()}`)
}

/** Detalle de una habitación, con fotos, reglas y costos (GET /api/v1/rooms/:id). */
export function getRoom(roomId) {
  return apiRequest(`/api/v1/rooms/${encodeURIComponent(roomId)}`)
}

/**
 * Postulación a una habitación. El servidor toma al postulante de la sesión
 * y calcula la afinidad con el anfitrión, así que solo se manda el mensaje.
 */
export function applyToRoom(listingId, message, token) {
  const text = typeof message === 'string' ? message.trim() : ''
  return apiRequest('/api/v1/applications', {
    method: 'POST',
    token,
    body: JSON.stringify({ listingId, message: text || null }),
  })
}

/** Postulaciones de la persona en sesión (GET /api/v1/applications/me). */
export function getMyApplications(token) {
  return apiRequest('/api/v1/applications/me', { token })
}

const APPLICATION_STATUS_LABELS = {
  pending: 'Postulación enviada · en revisión',
  waitlisted: 'Postulación en lista de espera',
  accepted: 'Postulación aceptada',
  rejected: 'Postulación no aceptada',
}

export function describeApplicationStatus(status) {
  return APPLICATION_STATUS_LABELS[status] ?? 'Postulación enviada'
}

/** Índice listingId -> estado, tolerante a respuestas inesperadas. */
export function indexApplications(applications) {
  const byListing = {}
  if (!Array.isArray(applications)) return byListing
  for (const application of applications) {
    if (application?.listingId) byListing[application.listingId] = application.status ?? 'pending'
  }
  return byListing
}

export function roomCoverUrl(roomId) {
  return `${API_URL}/api/v1/rooms/${encodeURIComponent(roomId)}/photos/first`
}

export function roomPhotoUrl(roomId, photoId) {
  return `${API_URL}/api/v1/rooms/${encodeURIComponent(roomId)}/photos/${encodeURIComponent(photoId)}`
}

export function formatRent(amount) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return 'Renta no indicada'
  return `$${value.toLocaleString('es-MX')} MXN/mes`
}

export function formatCostAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return 'Monto no indicado'
  const value = Number(amount)
  if (!Number.isFinite(value)) return 'Monto no indicado'
  return `$${value.toLocaleString('es-MX')} MXN`
}

/** "YYYY-MM-DD" -> "1 dic 2026", sin depender de la zona horaria. */
export function formatShortDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '')
  if (!match) return ''
  const [, year, month, day] = match
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
}

export function formatAvailability(availableFrom, today = new Date()) {
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(availableFrom ?? '')?.[1]
  if (!date) return 'Disponible ahora'
  const todayText = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  return date <= todayText ? 'Disponible ahora' : `Disponible desde ${formatShortDate(date)}`
}

export function formatRoomLocation(room) {
  const area = [room.zone, room.city].filter(Boolean).join(' · ')
  return area || room.address || 'Ubicación no indicada'
}

export function formatHostName(room) {
  return room.hostName?.trim() || 'Anfitrión'
}

export function formatRoommates(maxRoommates) {
  if (!maxRoommates) return 'No indicado'
  return maxRoommates === 1 ? 'Hasta 1 compañero' : `Hasta ${maxRoommates} compañeros`
}

const COST_KIND_LABELS = {
  rent: 'Renta',
  service: 'Servicio',
  deposit: 'Depósito',
  maintenance: 'Mantenimiento',
  other: 'Otro',
}

export function formatCostKind(kind) {
  return COST_KIND_LABELS[kind] ?? 'Otro'
}

/** Reglas de la casa como pares etiqueta/valor, omitiendo lo que no se indicó. */
export function describeRules(rules) {
  if (!rules) return []
  const rows = []
  if (typeof rules.partiesAllowed === 'boolean') {
    rows.push({ label: 'Fiestas', value: rules.partiesAllowed ? 'Permitidas' : 'No permitidas' })
  }
  if (typeof rules.petsAllowed === 'boolean') {
    rows.push({ label: 'Mascotas', value: rules.petsAllowed ? 'Permitidas' : 'No permitidas' })
  }
  if (typeof rules.smokingAllowed === 'boolean') {
    rows.push({ label: 'Fumar', value: rules.smokingAllowed ? 'Permitido' : 'No permitido' })
  }
  if (rules.quietHoursStart && rules.quietHoursEnd) {
    rows.push({
      label: 'Horario de silencio',
      value: `${rules.quietHoursStart.slice(0, 5)} a ${rules.quietHoursEnd.slice(0, 5)}`,
    })
  }
  if (rules.visitsPolicy) rows.push({ label: 'Visitas', value: rules.visitsPolicy })
  if (rules.commonAreasNotes) rows.push({ label: 'Áreas comunes', value: rules.commonAreasNotes })
  if (rules.extraRules) rows.push({ label: 'Otras reglas', value: rules.extraRules })
  return rows
}
