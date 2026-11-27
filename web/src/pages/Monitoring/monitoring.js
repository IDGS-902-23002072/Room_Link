import { apiFetch, apiRequest } from '../../services/api.js'

const BASE = '/api/v1/admin/monitoring'

/** Mes de León (UTC-6), no el mes del navegador del administrador. */
export function currentMonth() {
  return new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

export function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(month ?? '')) return { from: '', to: '' }
  const [year, value] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, value, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function monthLabel(month) {
  if (!/^\d{4}-\d{2}$/.test(month ?? '')) return 'Mes no válido'
  return new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00.000Z`))
}

function query(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function getSummary(month, token) {
  return apiRequest(`${BASE}/summary${query({ month })}`, { token })
}

export function getSlis(month, token) {
  return apiRequest(`${BASE}/slis${query({ month })}`, { token })
}

export function getTestRuns({ cursor, limit = 10 }, token) {
  return apiRequest(`${BASE}/tests/runs${query({ cursor, limit })}`, { token })
}

export function getTestRun(id, token) {
  return apiRequest(`${BASE}/tests/runs/${encodeURIComponent(id)}`, { token })
}

export function getTestSuites(token) {
  return apiRequest(`${BASE}/tests/suites`, { token })
}

export function runTestSuite(suite, token) {
  return apiRequest(`${BASE}/tests/run`, {
    method: 'POST',
    token,
    body: JSON.stringify({ suite }),
  })
}

export function getLogbook({ month, from, to, module, type, status, inSli, includeExcluded, scope, cursor, limit = 50 }, token) {
  return apiRequest(
    `${BASE}/logbook${query({
      month,
      from,
      to,
      module,
      type,
      status: status === 'success' || status === 'error' ? status : undefined,
      inSli: inSli ? 'true' : undefined,
      includeExcluded: includeExcluded ? 'true' : undefined,
      scope,
      cursor,
      limit,
    })}`,
    { token },
  )
}

export async function downloadRequestsCsv(month, token) {
  const response = await apiFetch(`${BASE}/export/requests.csv${query({ month })}`, {
    token,
    accept: 'text/csv',
  })
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = `solicitudes-${month}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function formatPercent(value) {
  return value === null || value === undefined ? 'sin dato' : `${Number(value).toFixed(1)} %`
}

export function formatDuration(ms) {
  return ms === null || ms === undefined ? 'sin dato' : `${Math.round(ms)} ms`
}

/** La bitácora ya entrega la fecha convertida a UTC-6; se muestra sin volver a desplazarla. */
export function formatLocal(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

/** Las corridas de pruebas llegan en UTC; se desplazan a UTC-6 antes de mostrarlas. */
export function formatUtc6(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  const local = new Date(date.getTime() - 6 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(local)
}

export function stateOf(sli) {
  if (sli.state === 'met') return { label: 'Cumple', tone: 'success' }
  if (sli.state === 'unmet') return { label: 'No cumple', tone: 'danger' }
  return { label: 'Sin dato', tone: 'neutral' }
}

export function isNearGoal(sli) {
  return sli.state === 'unmet' && sli.margin !== null && sli.margin >= -2
}

export const EVENT_TYPES = [
  ['request', 'Petición API'],
  ['business', 'Operación de negocio'],
  ['probe', 'Sondeo /ready'],
  ['test', 'Prueba automática'],
  ['incident', 'Incidente'],
  ['backup', 'Respaldo'],
]
