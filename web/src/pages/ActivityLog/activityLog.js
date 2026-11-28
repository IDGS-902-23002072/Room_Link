import { apiRequest } from '../../services/api.js'

export const PAGE_SIZE = 25

// Eventos que hoy registra el backend (`action` = tipo de evento de dominio).
export const ACTION_LABELS = {
  UserRegisteredEvent: 'Registro de usuario',
  LoginSucceededEvent: 'Inicio de sesión',
  LoginFailedEvent: 'Inicio de sesión rechazado',
  ConnectionRequestedEvent: 'Solicitud de conexión',
  ConnectionAcceptedEvent: 'Conexión aceptada',
  ApplicationStatusChanged: 'Cambio de estado de postulación',
  ListingModeratedEvent: 'Moderación de anuncio',
  SanctionIssuedEvent: 'Sanción emitida',
  MessageSentEvent: 'Mensaje enviado',
}

// Módulos y resultados que escribe el backend (columnas `module` y `outcome`).
export const MODULE_OPTIONS = [
  'Autenticación',
  'Conexiones',
  'Postulaciones',
  'Moderación',
  'Mensajería',
  'Sistema',
]

export const OUTCOME_LABELS = {
  success: 'Exitosa',
  rejected: 'Rechazada',
  failed: 'Fallida',
}

export const OUTCOME_TONES = { success: 'success', rejected: 'warning', failed: 'danger' }

export function describeOutcome(outcome) {
  return OUTCOME_LABELS[outcome] ?? 'Sin resultado'
}

export function describeAction(action) {
  return ACTION_LABELS[action] ?? action
}

/** "YYYY-MM-DD" local -> ISO de inicio o fin de ese día; null si no es válida. */
export function dayBoundary(value, edge) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null
  const [year, month, day] = value.split('-').map(Number)
  const date =
    edge === 'end'
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function buildQuery({ page, action, module, outcome, userId, from, to }) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((Math.max(page, 1) - 1) * PAGE_SIZE),
  })
  if (action) params.set('action', action)
  if (module) params.set('module', module)
  if (outcome) params.set('outcome', outcome)
  if (userId?.trim()) params.set('userId', userId.trim())
  const fromIso = dayBoundary(from, 'start')
  const toIso = dayBoundary(to, 'end')
  if (fromIso) params.set('from', fromIso)
  if (toIso) params.set('to', toIso)
  return params.toString()
}

/** Bitácora de operaciones (GET /api/v1/admin/activity-log, solo administradores). */
export function getActivityLog(filters, token) {
  return apiRequest(`/api/v1/admin/activity-log?${buildQuery(filters)}`, { token })
}

export function formatMoment(isoDate) {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' })
}

export function totalPages(total) {
  return Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE))
}

function csvCell(value) {
  const text = String(value ?? '')
  // Neutraliza fórmulas al abrir el CSV en una hoja de cálculo.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

/** CSV de los registros mostrados (fecha, evento, módulo, resultado, descripción, usuario, IP y detalle). */
export function toCsv(items) {
  const rows = [['Fecha', 'Evento', 'Módulo', 'Resultado', 'Descripción', 'Acción', 'Usuario', 'IP', 'Detalle']]
  for (const item of items) {
    rows.push([
      item.createdAt,
      describeAction(item.action),
      item.module ?? '',
      describeOutcome(item.outcome),
      item.description ?? '',
      item.action,
      item.userId ?? '',
      item.ipAddress ?? '',
      JSON.stringify(item.metadata ?? {}),
    ])
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
