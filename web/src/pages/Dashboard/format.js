export function dateValue(date) {
  return date.toISOString().slice(0, 10)
}

export function getDefaultRange() {
  const end = new Date()
  const start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1))
  return { start: dateValue(start), end: dateValue(end) }
}

export function isValidRange(start, end) {
  if (!start || !end || start > end) return false
  const startDate = new Date(`${start}T00:00:00.000Z`)
  const endDate = new Date(`${end}T00:00:00.000Z`)
  const limit = new Date(startDate)
  limit.setUTCMonth(limit.getUTCMonth() + 12)
  return endDate <= limit
}

export function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits }).format(value)
}
