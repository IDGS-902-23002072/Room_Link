import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { apiRequest } from '../../services/api.js'
import './dashboard.css'

function dateValue(date) {
  return date.toISOString().slice(0, 10)
}

function getDefaultRange() {
  const end = new Date()
  const start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1))
  return { start: dateValue(start), end: dateValue(end) }
}

function isValidRange(start, end) {
  if (!start || !end || start > end) return false
  const startDate = new Date(`${start}T00:00:00.000Z`)
  const endDate = new Date(`${end}T00:00:00.000Z`)
  const limit = new Date(startDate)
  limit.setUTCMonth(limit.getUTCMonth() + 12)
  return endDate <= limit
}

function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits }).format(value)
}

function MetricChart({ title, description, data, color }) {
  const max = Math.max(1, ...data.map(({ total }) => total))

  return (
    <section className="analytics-chart" aria-label={title}>
      <div className="analytics-chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="analytics-chart-total">
          {formatNumber(data.reduce((sum, item) => sum + item.total, 0))}
        </span>
      </div>
      <div className="analytics-bars" role="list">
        {data.map(({ month, total }) => {
          const height = total === 0 ? 0 : Math.max(7, (total / max) * 100)
          const label = new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(
            new Date(`${month}-01T00:00:00.000Z`),
          )
          return (
            <div className="analytics-bar-column" key={month} role="listitem">
              <span className="analytics-bar-value">{formatNumber(total)}</span>
              <div className="analytics-bar-track">
                <div
                  aria-label={`${label}: ${formatNumber(total)}`}
                  className="analytics-bar"
                  style={{ height: `${height}%`, backgroundColor: color }}
                />
              </div>
              <span className="analytics-bar-label">{label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Dashboard() {
  const { session } = useAuth()
  const [range, setRange] = useState(getDefaultRange)
  const [appliedRange, setAppliedRange] = useState(getDefaultRange)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rangeError, setRangeError] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams({
      start: appliedRange.start,
      end: appliedRange.end,
    })
    return params.toString()
  }, [appliedRange])

  useEffect(() => {
    let active = true
    apiRequest(`/api/v1/admin/analytics?${query}`, { token: session.token })
      .then((result) => {
        if (active) setDashboard(result)
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'No se pudieron cargar las métricas.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, session.token])

  function applyRange(event) {
    event.preventDefault()
    if (!isValidRange(range.start, range.end)) {
      setRangeError('El rango debe ser válido y no puede superar los 12 meses.')
      return
    }
    setRangeError('')
    setLoading(true)
    setError('')
    setAppliedRange(range)
  }

  const kpis = dashboard?.kpis
  return (
    <div className="analytics-dashboard">
      <header className="analytics-header">
        <div>
          <p className="eyebrow">ROOMLINK · ADMINISTRACIÓN</p>
          <h1>Tu espacio, en números</h1>
          <p className="muted">Indicadores para entender cómo crece la comunidad.</p>
        </div>
        <form className="analytics-date-filter" onSubmit={applyRange}>
          <label className="field">
            Desde
            <input
              max={range.end}
              onChange={(event) => setRange({ ...range, start: event.target.value })}
              type="date"
              value={range.start}
            />
          </label>
          <label className="field">
            Hasta
            <input
              min={range.start}
              onChange={(event) => setRange({ ...range, end: event.target.value })}
              type="date"
              value={range.end}
            />
          </label>
          <button className="button button-primary" disabled={loading} type="submit">
            Aplicar
          </button>
          {rangeError && <p className="analytics-error" role="alert">{rangeError}</p>}
        </form>
      </header>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {loading && <p className="analytics-loading" role="status">Cargando métricas…</p>}
      {!loading && !error && dashboard && (
        <>
          <p className="analytics-period">
            Periodo: {dashboard.period.start} — {dashboard.period.end}
          </p>
          <section aria-label="Indicadores clave" className="analytics-kpis">
            <article className="analytics-kpi">
              <span>Usuarios registrados</span>
              <strong>{formatNumber(kpis.usersRegistered)}</strong>
              <small>En el periodo seleccionado</small>
            </article>
            <article className="analytics-kpi">
              <span>Cuartos activos</span>
              <strong>{formatNumber(kpis.activeRooms)}</strong>
              <small>Publicados actualmente</small>
            </article>
            <article className="analytics-kpi">
              <span>Conexiones aceptadas</span>
              <strong>
                {kpis.connectionAcceptanceRate === null
                  ? '—'
                  : `${formatNumber(kpis.connectionAcceptanceRate, 2)}%`}
              </strong>
              <small>
                {formatNumber(kpis.connectionsAccepted)} de {formatNumber(kpis.connectionsSent)} enviadas
              </small>
            </article>
            <article className="analytics-kpi">
              <span>Cierre promedio</span>
              <strong>{formatNumber(kpis.avgDaysToClose, 1)} <small>días</small></strong>
              <small>Anuncios cerrados en el periodo</small>
            </article>
          </section>
          <section aria-label="Actividad mensual" className="analytics-charts">
            <MetricChart
              color="var(--plum)"
              data={dashboard.monthlyUsers}
              description="Nuevas cuentas creadas cada mes"
              title="Usuarios nuevos"
            />
            <MetricChart
              color="var(--teal)"
              data={dashboard.monthlyListings}
              description="Cuartos publicados cada mes"
              title="Anuncios publicados"
            />
          </section>
        </>
      )}
    </div>
  )
}

export default Dashboard
