import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { useAuth } from '../../hooks/useAuth.js'
import { apiRequest } from '../../services/api.js'
import GrowthChart from './GrowthChart.jsx'
import MetricChart from './MetricChart.jsx'
import { formatNumber, getDefaultRange, isValidRange } from './format.js'
import styles from './Dashboard.module.css'

export default function Dashboard() {
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
  const hasMonthlyData = Boolean(dashboard?.monthlyUsers?.length)

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <nav aria-label="Secciones del dashboard" className={styles.sideNav}>
          <p className={styles.sideTitle}>En esta página</p>
          <a href="#dashboard">Resumen</a>
          <a href="#actividad">Actividad</a>
          <a href="#reportes">Reportes</a>
        </nav>
      </aside>

      <div className={styles.content} id="dashboard">
        <PageHeader
          actions={
            <form className={styles.dateFilter} onSubmit={applyRange}>
              <Field htmlFor="range-start" label="Desde">
                <input
                  autoComplete="off"
                  max={range.end}
                  name="start"
                  onChange={(event) => setRange({ ...range, start: event.target.value })}
                  type="date"
                  value={range.start}
                />
              </Field>
              <Field htmlFor="range-end" label="Hasta">
                <input
                  autoComplete="off"
                  min={range.start}
                  name="end"
                  onChange={(event) => setRange({ ...range, end: event.target.value })}
                  type="date"
                  value={range.end}
                />
              </Field>
              <Button disabled={loading} type="submit">
                Aplicar
              </Button>
              {rangeError ? (
                <p className={styles.rangeError} role="alert">
                  {rangeError}
                </p>
              ) : null}
            </form>
          }
          description="Resumen de actividad y crecimiento de la comunidad."
          eyebrow="ROOMLINK · ADMINISTRACIÓN"
          title="Dashboard"
        />

        {error ? <Notice tone="error">{error}</Notice> : null}

        {loading ? (
          <div className={styles.loading} role="status">
            Cargando métricas…
          </div>
        ) : null}

        {!loading && !error && dashboard ? (
          <>
            <p className={styles.period}>
              Periodo: {dashboard.period.start} — {dashboard.period.end}
            </p>

            <section aria-label="Indicadores clave" className={styles.kpis}>
              <Card className={styles.kpi}>
                <span className={styles.kpiLabel}>Usuarios registrados</span>
                <strong className={styles.kpiValue}>{formatNumber(kpis.usersRegistered)}</strong>
                <small className={styles.kpiNote}>En el periodo seleccionado</small>
              </Card>
              <Card className={styles.kpi}>
                <span className={styles.kpiLabel}>Cuartos activos</span>
                <strong className={styles.kpiValue}>{formatNumber(kpis.activeRooms)}</strong>
                <small className={styles.kpiNote}>Publicados actualmente</small>
              </Card>
              <Card className={styles.kpi}>
                <span className={styles.kpiLabel}>Conexiones aceptadas</span>
                <strong className={styles.kpiValue}>
                  {kpis.connectionAcceptanceRate === null
                    ? '—'
                    : `${formatNumber(kpis.connectionAcceptanceRate, 2)}%`}
                </strong>
                <small className={styles.kpiNote}>
                  {formatNumber(kpis.connectionsAccepted)} de {formatNumber(kpis.connectionsSent)} enviadas
                </small>
              </Card>
              <Card className={styles.kpi}>
                <span className={styles.kpiLabel}>Ocupación estimada</span>
                <strong className={styles.kpiValue}>{kpis.estimatedOccupancyRate == null ? '—' : `${formatNumber(kpis.estimatedOccupancyRate, 2)}%`}</strong>
                <small className={styles.kpiNote}>{formatNumber(kpis.listingsWithAcceptedApplication ?? 0)} de {formatNumber(kpis.publishedListings ?? 0)} anuncios del periodo con postulación aceptada</small>
              </Card>
              <Card className={styles.kpi}>
                <span className={styles.kpiLabel}>Afinidad promedio de postulaciones</span>
                <strong className={styles.kpiValue}>{kpis.avgApplicationAffinity == null ? '—' : `${formatNumber(kpis.avgApplicationAffinity, 2)}%`}</strong>
                <small className={styles.kpiNote}>{formatNumber(kpis.scoredApplications ?? 0)} postulaciones con afinidad calculada en el periodo</small>
              </Card>
              <Card className={styles.kpi}>
                <span className={styles.kpiLabel}>Tiempo promedio de cierre</span>
                <strong className={styles.kpiValue}>
                  {formatNumber(kpis.avgDaysToClose, 1)} <small>días</small>
                </strong>
                <small className={styles.kpiNote}>
                  De los anuncios cerrados en el periodo
                </small>
              </Card>
            </section>

            {hasMonthlyData ? (
              <>
                <GrowthChart data={dashboard.monthlyUsers} />

                <section aria-label="Actividad reciente" className={styles.activity} id="actividad">
                  <div className={styles.activityHeading}>
                    <div>
                      <h2>Actividad mensual</h2>
                      <p>Registros y anuncios por mes</p>
                    </div>
                    <span>{formatNumber(kpis.connectionsAccepted)} conexiones aceptadas</span>
                  </div>
                  <div className={styles.tableWrap}>
                    <table>
                      <caption className="sr-only">
                        Actividad mensual: nuevos usuarios y anuncios publicados
                      </caption>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Nuevos usuarios</th>
                          <th>Anuncios publicados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.monthlyUsers.map(({ month, total: users }, index) => (
                          <tr key={month}>
                            <td>
                              {new Intl.DateTimeFormat('es-MX', {
                                month: 'long',
                                year: 'numeric',
                                timeZone: 'UTC',
                              }).format(new Date(`${month}-01T00:00:00.000Z`))}
                            </td>
                            <td>{formatNumber(users)}</td>
                            <td>{formatNumber(dashboard.monthlyListings[index]?.total ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <MetricChart
                  data={dashboard.monthlyListings}
                  description="Cuartos publicados en cada mes"
                  title="Anuncios por mes"
                />
              </>
            ) : (
              <EmptyState
                description="No hay registros mensuales en el rango seleccionado. Prueba con un periodo más amplio."
                title="Sin actividad en este periodo"
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
