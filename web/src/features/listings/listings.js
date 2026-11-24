export const roomsPath = '/api/v1/rooms'
export const applicationsPath = '/api/v1/applications'

export const roomPath = (id) => roomsPath + '/' + encodeURIComponent(id)
export const roomLink = (id) => '/habitaciones/' + encodeURIComponent(id)
export const hostLink = (id) => '/anfitrion/habitaciones/' + encodeURIComponent(id)
export const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const listingStatuses = { draft: 'Borrador', published: 'Publicada', paused: 'Pausada', closed: 'Cerrada' }
export const applicationStatuses = { pending: 'Pendiente', waitlisted: 'En lista de espera', accepted: 'Aceptada', rejected: 'Rechazada', withdrawn: 'Retirada' }
export const costKinds = { service: 'Servicio', deposit: 'Depósito', maintenance: 'Mantenimiento', other: 'Otro', rent: 'Renta' }
export const costModes = { extra: 'Pago adicional', included: 'Incluido en la renta', prorated: 'Prorrateado' }

export const ruleFlags = { petsAllowed: 'Mascotas', smokingAllowed: 'Fumar', partiesAllowed: 'Fiestas' }

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
export const money = (value) => currency.format(Number(value))

export function coordinates(location) {
  const { latitude, longitude } = location || {}
  if ([latitude, longitude].some((value) => value == null || String(value).trim() === '')) return null
  const point = [Number(latitude), Number(longitude)]
  return point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180 ? point : null
}

export function costMode({ isIncluded, isProrated }) {
  if (isIncluded) return 'included'
  return isProrated ? 'prorated' : 'extra'
}
