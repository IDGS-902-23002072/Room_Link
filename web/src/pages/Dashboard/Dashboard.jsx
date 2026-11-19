import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { asyncEffect } from '../../hooks/asyncEffect.js'
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
          const label = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(
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

MetricChart.propTypes = {
  color: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.shape({
    month: PropTypes.string.isRequired,
    total: PropTypes.number.isRequired,
  })).isRequired,
  description: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}

function GrowthChart({ data }) {
  const maximum = Math.max(1, ...data.map(({ total }) => total))
  const points = data.map(({ total }, index) => {
    const x = data.length <= 1 ? 400 : 12 + (index * 776) / (data.length - 1)
    const y = 185 - (total / maximum) * 150
    return { x, y, total }
  })

  return (
    <section aria-label="Crecimiento mensual de usuarios" className="analytics-chart analytics-growth-chart" id="reportes">
      <div className="analytics-chart-heading">
        <div>
          <h2>Crecimiento de usuarios</h2>
          <p>Registros nuevos por mes en el periodo seleccionado</p>
        </div>
        <span className="analytics-chart-total">
          {formatNumber(data.reduce((sum, item) => sum + item.total, 0))}
        </span>
      </div>
      <svg
        aria-label={`Crecimiento mensual: ${data.map(({ month, total }) => `${month}, ${total}`).join('; ')}`}
        className="analytics-line-chart"
        role="img"
        viewBox="0 0 800 220"
      >
        {[35, 85, 135, 185].map((y) => (
          <line className="analytics-chart-gridline" key={y} x1="0" x2="800" y1={y} y2={y} />
        ))}
        {points.length > 1 && (
          <polyline
            className="analytics-chart-line"
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
          />
        )}
        {points.map(({ x, y, total }, index) => (
          <circle
            aria-label={`${data[index].month}: ${formatNumber(total)}`}
            className="analytics-chart-dot"
            key={data[index].month}
            cx={x}
            cy={y}
            r="4"
          />
        ))}
      </svg>
      <div className="analytics-line-labels">
        {data.map(({ month }) => (
          <span key={month}>
            {new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(
              new Date(`${month}-01T00:00:00.000Z`),
            )}
          </span>
        ))}
      </div>
    </section>
  )
}

GrowthChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    month: PropTypes.string.isRequired,
    total: PropTypes.number.isRequired,
  })).isRequired,
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

  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const result = await apiRequest(`/api/v1/admin/analytics?${query}`, {
          token: session.token,
        })
        if (isActive()) setDashboard(result)
      } catch (requestError) {
        if (isActive()) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'No se pudieron cargar las métricas.',
          )
        }
      } finally {
        if (isActive()) setLoading(false)
      }
    }),
    [query, session.token],
  )

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
    <div className="analytics-layout">
      <aside className="analytics-sidebar">
        <nav aria-label="Navegación de administración">
          <a className="active" href="#dashboard">Dashboard</a>
          <a href="#actividad">Actividad</a>
          <a href="#reportes">Reportes</a>
        </nav>
      </aside>
      <div className="analytics-dashboard" id="dashboard">
        <header className="analytics-header">
          <div>
            <p className="eyebrow">ROOMLINK · ADMINISTRACIÓN</p>
            <h1>Dashboard</h1>
            <p className="muted">Resumen de actividad y crecimiento de la comunidad.</p>
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
                <small>{formatNumber(kpis.connectionsAccepted)} de {formatNumber(kpis.connectionsSent)} enviadas</small>
              </article>
              <article className="analytics-kpi">
                <span>Tiempo promedio de cierre</span>
                <strong>
                  {formatNumber(kpis.avgDaysToClose, 1)} <small>días</small>
                </strong>
                <small>De los anuncios cerrados en el periodo</small>
              </article>
            </section>
            <GrowthChart data={dashboard.monthlyUsers} />
            <section aria-label="Actividad reciente" className="analytics-activity" id="actividad">
              <div className="analytics-activity-heading">
                <div>
                  <h2>Actividad mensual</h2>
                  <p>Registros y anuncios por mes</p>
                </div>
                <span>{formatNumber(kpis.connectionsAccepted)} conexiones aceptadas</span>
              </div>
              <div className="analytics-table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Nuevos usuarios</th><th>Anuncios publicados</th></tr>
                  </thead>
                  <tbody>
                    {dashboard.monthlyUsers.map(({ month, total: users }, index) => (
                      <tr key={month}>
                        <td>{new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00.000Z`))}</td>
                        <td>{formatNumber(users)}</td>
                        <td>{formatNumber(dashboard.monthlyListings[index]?.total ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <MetricChart
              color="var(--plum)"
              data={dashboard.monthlyListings}
              description="Cuartos publicados en cada mes"
              title="Anuncios por mes"
            />
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard
