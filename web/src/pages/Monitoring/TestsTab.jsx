import { useEffect, useState } from 'react'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import {
  formatLocal,
  getTestRun,
  getTestRuns,
  getTestSuites,
  runTestSuite,
} from './monitoring.js'
import styles from './Monitoring.module.css'

export default function TestsTab({ token }) {
  const [history, setHistory] = useState([null])
  const [page, setPage] = useState(0)
  const [runs, setRuns] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [showAll, setShowAll] = useState(true)
  const [suites, setSuites] = useState([])
  const [suite, setSuite] = useState('')
  const [running, setRunning] = useState(false)
  const [runNotice, setRunNotice] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const cursor = history[page]

  useEffect(() => asyncEffect(async (isActive) => {
    try {
      const result = await getTestSuites(token)
      if (!isActive()) return
      const items = result?.items ?? []
      setSuites(items)
      setSuite((current) => current || items[0]?.id || '')
    } catch {
      if (isActive()) setSuites([])
    }
  }), [token])

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
  }), [cursor, token, refresh])

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

  async function execute() {
    if (!suite || running) return
    setRunning(true)
    setRunNotice(null)
    try {
      const result = await runTestSuite(suite, token)
      setRunNotice({ tone: 'success', text: result.message })
      setHistory([null])
      setPage(0)
      setSelectedId(result.runId)
      setDetail(null)
      setDetailError('')
      setShowAll(true)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setRunNotice({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'No se pudo ejecutar la suite.',
      })
    } finally {
      setRunning(false)
    }
  }

  function nextPage() {
    if (!runs?.nextCursor) return
    setHistory([...history.slice(0, page + 1), runs.nextCursor])
    setPage(page + 1)
  }

  const items = runs?.items ?? []
  const results = detail?.results ?? []
  const visibleResults = showAll ? results : results.filter((result) => result.result !== 'passed')
  const selectedSuite = suites.find((item) => item.id === suite)

  return (
    <div className={styles.stack}>
      <Card className={styles.runCard}>
        <div className={styles.runIntro}>
          <h2 className={styles.sectionTitle}>Ejecutar pruebas</h2>
          <p className={styles.cardNote}>
            Solo se permiten las suites listadas. El resultado se guarda en la base de monitoreo y
            aparece abajo; ninguna petición queda esperando a la base.
          </p>
        </div>
        <div className={styles.runControls}>
          <Field className={styles.runField} htmlFor="test-suite" label="Suite">
            <select
              disabled={running}
              id="test-suite"
              onChange={(event) => setSuite(event.target.value)}
              value={suite}
            >
              {suites.length === 0
                ? <option value="">Sin suites disponibles</option>
                : suites.map((item) => (
                  <option key={item.id} title={item.description} value={item.id}>{item.label}</option>
                ))}
            </select>
          </Field>
          <Button disabled={!suite || running} loading={running} onClick={execute}>
            Ejecutar suite
          </Button>
        </div>
        {selectedSuite ? (
          <p className={styles.cardNote}>{selectedSuite.description}</p>
        ) : null}
        {runNotice ? (
          <Notice className={styles.runNotice} tone={runNotice.tone}>{runNotice.text}</Notice>
        ) : null}
      </Card>

      {loading ? <p className={styles.loading} role="status">Cargando corridas de pruebas…</p> : null}
      {error ? (
        <Notice role="alert" tone="error" title="Pruebas no disponibles">
          {error} La pantalla seguirá funcionando cuando se restablezca la base de monitoreo.
        </Notice>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          description="Ejecuta una suite o envía el resultado de Vitest al endpoint de ingesta."
          title="Sin corridas registradas"
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
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
                      aria-pressed={selectedId === run.id}
                      onClick={() => {
                        setSelectedId(run.id)
                        setDetail(null)
                        setDetailError('')
                        setShowAll(true)
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
      ) : null}

      <div className={styles.pagination}>
        <Button disabled={page === 0} onClick={() => setPage(page - 1)} size="sm" variant="secondary">
          Anterior
        </Button>
        <span>Página {page + 1}</span>
        <Button disabled={!runs?.nextCursor} onClick={nextPage} size="sm" variant="secondary">
          Siguiente
        </Button>
      </div>

      {selectedId ? (
        <Card className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <h2 className={styles.sectionTitle}>Detalle de la corrida</h2>
              <p className={styles.cardNote}>{selectedId}</p>
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
                    {result.result === 'passed' ? 'Aprobada' : result.result === 'skipped' ? 'Omitida' : 'Fallida'}
                  </Badge>
                  <div className={styles.resultBody}>
                    <span className={styles.resultName}>{result.testName}</span>
                    {result.message ? (
                      <p className={styles.resultDescription}>{result.message}</p>
                    ) : null}
                    <span className={styles.resultMeta}>
                      {result.sliId ?? 'sin SLI'} · {result.module}
                      {result.dataSummary ? ` · Datos: ${result.dataSummary}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
