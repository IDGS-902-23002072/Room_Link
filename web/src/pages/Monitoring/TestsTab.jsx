import { useEffect, useState } from 'react'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { formatLocal, getTestRun, getTestRuns } from './monitoring.js'
import styles from './Monitoring.module.css'

export default function TestsTab({ token }) {
  const [history, setHistory] = useState([null])
  const [page, setPage] = useState(0)
  const [runs, setRuns] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const cursor = history[page]
  const selectedId = selected?.id ?? null

  useEffect(() => asyncEffect(async (isActive) => {
    setLoading(true)
    try {
      const result = await getTestRuns({ cursor, limit: 10 }, token)
      if (isActive()) {
        setRuns(result)
        setError('')
      }
    } catch (cause) {
      if (isActive()) {
        setRuns(null)
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la bitácora de pruebas.')
      }
    } finally {
      if (isActive()) setLoading(false)
    }
  }), [cursor, token])

  useEffect(() => {
    if (!selectedId) return undefined
    return asyncEffect(async (isActive) => {
      try {
        const result = await getTestRun(selectedId, token)
        if (isActive()) setDetail(result)
      } catch (cause) {
        if (isActive()) setDetailError(cause instanceof Error ? cause.message : 'No se pudo cargar el detalle.')
      }
    })
  }, [selectedId, token])

  function nextPage() {
    if (!runs?.nextCursor) return
    setHistory([...history.slice(0, page + 1), runs.nextCursor])
    setPage(page + 1)
  }

  if (loading) return <p className={styles.loading} role="status">Cargando corridas de pruebas…</p>
  if (error) {
    return (
      <Notice role="alert" tone="error" title="Pruebas no disponibles">
        {error} La pantalla seguirá funcionando cuando se restablezca la base de monitoreo.
      </Notice>
    )
  }

  const items = runs?.items ?? []
  const results = detail?.results ?? []
  const visibleResults = showAll ? results : results.filter((result) => result.result !== 'passed')

  return (
    <div className={styles.stack}>
      {items.length === 0 ? (
        <EmptyState
          description="Las corridas aparecen cuando se envía el resultado de Vitest al endpoint de ingesta."
          title="Sin corridas registradas"
        />
      ) : (
        <Card className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Corridas de pruebas automáticas</caption>
            <thead>
              <tr>
                <th scope="col">Finalizó</th>
                <th scope="col">Suite</th>
                <th scope="col">Resultado</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {items.map((run) => (
                <tr key={run.id}>
                  <td>{formatLocal(run.finishedAt)}</td>
                  <td>{run.suite}</td>
                  <td>
                    <Badge tone={run.complete && run.failedTests === 0 ? 'success' : run.complete ? 'danger' : 'neutral'}>
                      {run.passedTests}/{run.totalTests} · {run.complete ? 'completa' : 'incompleta'}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      aria-pressed={selected?.id === run.id}
                      onClick={() => {
                        setSelected(run.id)
                        setDetail(null)
                        setDetailError('')
                        setShowAll(false)
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className={styles.pagination}>
        <Button disabled={page === 0} onClick={() => setPage(page - 1)} size="sm" variant="secondary">
          Anterior
        </Button>
        <span>Página {page + 1}</span>
        <Button disabled={!runs?.nextCursor} onClick={nextPage} size="sm" variant="secondary">
          Siguiente
        </Button>
      </div>

      {selected ? (
        <Card className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <h2 className={styles.sectionTitle}>Detalle de la corrida</h2>
              <p className={styles.cardNote}>{selected.id}</p>
            </div>
            <Button onClick={() => setShowAll((value) => !value)} size="sm" variant="secondary">
              {showAll ? 'Solo fallidas' : `Ver todas (${results.length})`}
            </Button>
          </div>
          {detailError ? <Notice tone="error">{detailError}</Notice> : null}
          {!detail && !detailError ? <p className={styles.cardNote} role="status">Cargando detalle…</p> : null}
          {detail && visibleResults.length === 0 ? (
            <Notice tone="success">No hay pruebas fallidas en esta corrida.</Notice>
          ) : null}
          {detail && visibleResults.length > 0 ? (
            <ul className={styles.results}>
              {visibleResults.map((result, index) => (
                <li key={`${result.testName}-${index}`} className={styles.result}>
                  <Badge tone={result.result === 'passed' ? 'success' : 'danger'}>
                    {result.result === 'passed' ? 'Aprobada' : 'Fallida'}
                  </Badge>
                  <span className={styles.resultName}>{result.testName}</span>
                  <span className={styles.resultMeta}>
                    {result.sliId ?? 'sin SLI'} · {result.module}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
