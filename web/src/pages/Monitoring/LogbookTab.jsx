import { useEffect, useState } from 'react'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import {
  EVENT_TYPES,
  formatDuration,
  formatLocal,
  getLogbook,
  monthBounds,
} from './monitoring.js'
import styles from './Monitoring.module.css'

export default function LogbookTab({ month, token }) {
  const bounds = monthBounds(month)
  const [draft, setDraft] = useState({ from: bounds.from, to: bounds.to, module: '', type: '', status: '', inSli: false, includeExcluded: false })
  const [filters, setFilters] = useState(draft)
  const [history, setHistory] = useState([null])
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rangeError, setRangeError] = useState('')
  const cursor = history[page]

  useEffect(() => asyncEffect(async (isActive) => {
    setLoading(true)
    try {
      const result = await getLogbook({ ...filters, month, cursor, limit: 50 }, token)
      if (isActive()) {
        setData(result)
        setError('')
      }
    } catch (cause) {
      if (isActive()) {
        setData(null)
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la bitácora.')
      }
    } finally {
      if (isActive()) setLoading(false)
    }
  }), [filters, month, cursor, token])

  function apply(event) {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) {
      setRangeError('La fecha inicial no puede ser posterior a la final.')
      return
    }
    setRangeError('')
    setFilters(draft)
    setHistory([null])
    setPage(0)
  }

  function nextPage() {
    if (!data?.nextCursor) return
    setHistory([...history.slice(0, page + 1), data.nextCursor])
    setPage(page + 1)
  }

  const items = data?.items ?? []
  const typeLabel = (type) => EVENT_TYPES.find(([value]) => value === type)?.[1] ?? type

  return (
    <div className={styles.stack}>
      <Card className={styles.filterCard}>
        <form className={styles.filters} onSubmit={apply}>
          <Field htmlFor="logbook-from" label="Desde">
            <input id="logbook-from" onChange={(event) => setDraft({ ...draft, from: event.target.value })} type="date" value={draft.from} />
          </Field>
          <Field htmlFor="logbook-to" label="Hasta">
            <input id="logbook-to" onChange={(event) => setDraft({ ...draft, to: event.target.value })} type="date" value={draft.to} />
          </Field>
          <Field htmlFor="logbook-module" label="Módulo">
            <input
              autoComplete="off"
              id="logbook-module"
              onChange={(event) => setDraft({ ...draft, module: event.target.value })}
              placeholder="M1, M10, PLAT…"
              value={draft.module}
            />
          </Field>
          <Field htmlFor="logbook-type" label="Tipo de evento">
            <select
              id="logbook-type"
              onChange={(event) => setDraft({ ...draft, type: event.target.value })}
              value={draft.type}
            >
              <option value="">Todos</option>
              {EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field htmlFor="logbook-status" label="Estado">
            <select
              id="logbook-status"
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              value={draft.status}
            >
              <option value="">Todos</option>
              <option value="success">Éxito</option>
              <option value="error">Error</option>
            </select>
          </Field>
          <div className={styles.checks}>
            <label className={styles.check}>
              <input
                checked={draft.inSli}
                onChange={(event) => setDraft({ ...draft, inSli: event.target.checked })}
                type="checkbox"
              />
              Dentro del SLI
            </label>
            <label className={styles.check}>
              <input
                checked={draft.includeExcluded}
                onChange={(event) => setDraft({ ...draft, includeExcluded: event.target.checked })}
                type="checkbox"
              />
              Mostrar excluidos
            </label>
          </div>
          <div className={styles.filterActions}>
            <Button type="submit">Filtrar</Button>
          </div>
        </form>
        {rangeError ? <Notice tone="error">{rangeError}</Notice> : null}
      </Card>

      {loading ? <p className={styles.loading} role="status">Cargando bitácora…</p> : null}
      {error ? (
        <Notice role="alert" tone="error" title="Bitácora no disponible">
          {error} El resto de la aplicación no está afectado.
        </Notice>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          description="Prueba con otro rango de fechas o quita algún filtro."
          title="Sin eventos en el rango"
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <Card className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Bitácora normalizada de monitoreo</caption>
            <thead>
              <tr>
                <th scope="col">Fecha (UTC-6)</th>
                <th scope="col">Tipo</th>
                <th scope="col">Módulo</th>
                <th scope="col">Operación</th>
                <th scope="col">Mensaje</th>
                <th scope="col">Solicitud</th>
                <th scope="col">Estado</th>
                <th scope="col">Duración</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.occurredAt}-${item.id}`}>
                  <td>{formatLocal(item.occurredAtLocal)}</td>
                  <td>{typeLabel(item.type)}</td>
                  <td>{item.module}</td>
                  <td>
                    <span>{item.operation}</span>
                    {item.excluded ? <span className={styles.windowTag}>Excluido</span> : null}
                  </td>
                  <td className={styles.cellMessage} title={item.message || 'Sin mensaje'}>
                    {item.message || '—'}
                  </td>
                  <td className={styles.cellRequest} title={item.requestId || 'Sin identificador'}>
                    {item.requestId || '—'}
                  </td>
                  <td>
                    <Badge tone={item.status === 'éxito' ? 'success' : 'danger'}>{item.status}</Badge>
                  </td>
                  <td className={styles.cellNumber}>{formatDuration(item.durationMs)}</td>
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
        <Button disabled={!data?.nextCursor} onClick={nextPage} size="sm" variant="secondary">
          Siguiente
        </Button>
      </div>
    </div>
  )
}
