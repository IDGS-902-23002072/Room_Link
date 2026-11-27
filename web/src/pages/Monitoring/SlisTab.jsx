import { useEffect, useState } from 'react'
import Badge from '../../components/Badge/Badge.jsx'
import Card from '../../components/Card/Card.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { formatPercent, getSlis, isNearGoal, stateOf } from './monitoring.js'
import styles from './Monitoring.module.css'

export default function SlisTab({ month, token }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState('')

  useEffect(() => asyncEffect(async (isActive) => {
    setLoading(true)
    try {
      const result = await getSlis(month, token)
      if (isActive()) {
        setData(result)
        setError('')
      }
    } catch (cause) {
      if (isActive()) {
        setData(null)
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar los indicadores.')
      }
    } finally {
      if (isActive()) setLoading(false)
    }
  }), [month, token])

  if (loading) return <p className={styles.loading} role="status">Cargando indicadores…</p>
  if (error) {
    return (
      <Notice role="alert" tone="error" title="Indicadores no disponibles">
        {error} Revisa la conexión con la base de monitoreo y vuelve a intentarlo.
      </Notice>
    )
  }
  const items = (data?.items ?? []).filter((item) => !module || item.module === module)
  const modules = [...new Set((data?.items ?? []).map((item) => item.module))].sort()

  return (
    <div className={styles.stack}>
      <Card className={styles.filterCard}>
        <Field htmlFor="monitor-module" label="Módulo">
          <select
            id="monitor-module"
            onChange={(event) => setModule(event.target.value)}
            value={module}
          >
            <option value="">Todos los módulos</option>
            {modules.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
        <p className={styles.cardNote}>
          El valor se trunca a un decimal. Cumple si la proporción de casos buenos alcanza el SLO.
        </p>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          description="No hay mediciones guardadas para este mes. Ejecuta el cálculo mensual para ver los 67 indicadores."
          title="Sin información de indicadores"
        />
      ) : (
        <Card className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Indicadores SLI del mes {month}</caption>
            <thead>
              <tr>
                <th scope="col">SLI</th>
                <th scope="col">Módulo</th>
                <th scope="col">Valor</th>
                <th scope="col">SLO</th>
                <th scope="col">Margen</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const state = stateOf(item)
                return (
                  <tr key={item.sliId}>
                    <th className={styles.cellId} scope="row">{item.sliId}</th>
                    <td>{item.module}</td>
                    <td>
                      <span title={item.message}>{formatPercent(item.sliValue)}</span>
                      {item.used3mWindow ? <span className={styles.windowTag}>Ventana de 3 meses</span> : null}
                    </td>
                    <td>{formatPercent(item.sloValue)}</td>
                    <td className={styles.cellNumber}>
                      {item.margin === null ? 'sin dato' : `${item.margin > 0 ? '+' : ''}${item.margin.toFixed(1)} pp`}
                    </td>
                    <td>
                      <div className={styles.stateCell}>
                        <Badge tone={state.tone}>{state.label}</Badge>
                        {isNearGoal(item) ? <Badge tone="warning">Cerca de la meta</Badge> : null}
                      </div>
                      <span className={styles.srOnly}>{item.message}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
