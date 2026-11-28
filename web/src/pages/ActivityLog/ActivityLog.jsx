import { useEffect, useState } from 'react'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Card from '../../components/Card/Card.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import Field from '../../components/Field/Field.jsx'
import Notice from '../../components/Notice/Notice.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { asyncEffect } from '../../hooks/asyncEffect.js'
import { useAuth } from '../../hooks/useAuth.js'
import {
  ACTION_LABELS,
  MODULE_OPTIONS,
  OUTCOME_LABELS,
  OUTCOME_TONES,
  PAGE_SIZE,
  describeAction,
  describeOutcome,
  formatMoment,
  getActivityLog,
  toCsv,
  totalPages,
} from './activityLog.js'
import styles from './ActivityLog.module.css'

const EMPTY_FILTERS = { action: '', module: '', outcome: '', userId: '', from: '', to: '' }

function downloadCsv(items) {
  const blob = new Blob([`﻿${toCsv(items)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bitacora-roomlink-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ActivityLog() {
  const { session } = useAuth()
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [state, setState] = useState({ key: '', result: null, error: '' })
  const [openId, setOpenId] = useState(null)
  const [rangeError, setRangeError] = useState('')

  const key = `${JSON.stringify(filters)}|${page}|${reload}`

  useEffect(
    () => asyncEffect(async (isActive) => {
      try {
        const result = await getActivityLog({ ...filters, page }, session.token)
        if (isActive()) setState({ key, result, error: '' })
      } catch (cause) {
        if (isActive()) {
          setState({
            key,
            result: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar la bitácora.',
          })
        }
      }
    }),
    // `key` ya resume filters, page y reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, session.token],
  )

  const loading = state.key !== key
  const items = loading ? [] : (state.result?.items ?? [])
  const total = loading ? 0 : (state.result?.total ?? 0)
  const pages = totalPages(total)
  const filtered = Object.values(filters).some(Boolean)

  function applyFilters(event) {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) {
      setRangeError('La fecha inicial no puede ser posterior a la final.')
      return
    }
    setRangeError('')
    setOpenId(null)
    setPage(1)
    setFilters(draft)
  }

  function clearFilters() {
    setRangeError('')
    setOpenId(null)
    setDraft(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  return (
    <section className={styles.page}>
      <PageHeader
        actions={
          <>
            <Button onClick={() => setReload((value) => value + 1)} variant="secondary">
              Actualizar
            </Button>
            <Button disabled={items.length === 0} onClick={() => downloadCsv(items)} variant="secondary">
              Exportar página (CSV)
            </Button>
          </>
        }
        description="Registro inmutable de las operaciones del sistema: qué ocurrió, en qué módulo, con qué resultado y por qué."
        eyebrow="ROOMLINK · ADMINISTRACIÓN"
        title="Bitácora"
      />

      <form className={styles.filters} onSubmit={applyFilters}>
        <Field htmlFor="log-action" label="Evento">
          <select
            autoComplete="off"
            id="log-action"
            name="action"
            onChange={(event) => setDraft({ ...draft, action: event.target.value })}
            value={draft.action}
          >
            <option value="">Todos</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field htmlFor="log-module" label="Módulo">
          <select
            autoComplete="off"
            id="log-module"
            name="module"
            onChange={(event) => setDraft({ ...draft, module: event.target.value })}
            value={draft.module}
          >
            <option value="">Todos</option>
            {MODULE_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field htmlFor="log-outcome" label="Resultado">
          <select
            autoComplete="off"
            id="log-outcome"
            name="outcome"
            onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}
            value={draft.outcome}
          >
            <option value="">Todos</option>
            {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field htmlFor="log-user" label="Usuario (ID)">
          <input
            autoComplete="off"
            id="log-user"
            name="userId"
            onChange={(event) => setDraft({ ...draft, userId: event.target.value })}
            spellCheck={false}
            type="text"
            value={draft.userId}
          />
        </Field>
        <Field htmlFor="log-from" label="Desde">
          <input
            autoComplete="off"
            id="log-from"
            max={draft.to || undefined}
            name="from"
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            type="date"
            value={draft.from}
          />
        </Field>
        <Field htmlFor="log-to" label="Hasta">
          <input
            autoComplete="off"
            id="log-to"
            min={draft.from || undefined}
            name="to"
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            type="date"
            value={draft.to}
          />
        </Field>
        <div className={styles.filterActions}>
          <Button type="submit">Filtrar</Button>
          {filtered || draft !== filters ? (
            <Button onClick={clearFilters} variant="secondary">Limpiar</Button>
          ) : null}
        </div>
      </form>
      {rangeError ? <Notice tone="error">{rangeError}</Notice> : null}

      {state.error && !loading ? <Notice tone="error">{state.error}</Notice> : null}

      {loading ? (
        <div className={styles.loading} role="status">Cargando bitácora…</div>
      ) : items.length ? (
        <>
          <p className={styles.count}>
            {total} {total === 1 ? 'registro' : 'registros'}
          </p>
          <ul className={styles.list}>
            {items.map((item, index) => {
              const rowId = item.id ?? `${item.createdAt}-${index}`
              const open = openId === rowId
              const hasMetadata = Object.keys(item.metadata ?? {}).length > 0
              return (
                <li key={rowId}>
                  <Card as="div" className={styles.entry}>
                    <div className={styles.entryHead}>
                      <Badge tone="accent">{describeAction(item.action)}</Badge>
                      {item.module ? <Badge>{item.module}</Badge> : null}
                      <Badge tone={OUTCOME_TONES[item.outcome] ?? 'neutral'}>{describeOutcome(item.outcome)}</Badge>
                      <time dateTime={item.createdAt}>{formatMoment(item.createdAt)}</time>
                    </div>
                    {item.description ? <p className={styles.description}>{item.description}</p> : null}
                    <p className={styles.entryMeta}>
                      Usuario: <code>{item.userId ?? 'Sistema'}</code>
                      {item.ipAddress ? <> · IP: <code>{item.ipAddress}</code></> : null}
                    </p>
                    {hasMetadata ? (
                      <>
                        <Button
                          aria-expanded={open}
                          className={styles.toggle}
                          onClick={() => setOpenId(open ? null : rowId)}
                          variant="quiet"
                        >
                          {open ? 'Ocultar detalle' : 'Ver detalle'}
                        </Button>
                        {open ? (
                          <pre className={styles.detail}>{JSON.stringify(item.metadata, null, 2)}</pre>
                        ) : null}
                      </>
                    ) : null}
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      ) : state.error ? null : (
        <EmptyState
          action={filtered ? <Button onClick={clearFilters} variant="secondary">Limpiar filtros</Button> : null}
          description={
            filtered
              ? 'Prueba con otro evento, módulo, resultado, usuario o rango de fechas.'
              : 'Cuando haya operaciones en el sistema aparecerán aquí.'
          }
          title={filtered ? 'Sin resultados' : 'La bitácora está vacía'}
        />
      )}

      {!loading && total > PAGE_SIZE ? (
        <nav aria-label="Paginación de la bitácora" className={styles.pagination}>
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)} variant="secondary">
            Anterior
          </Button>
          <span>Página {page} de {pages}</span>
          <Button disabled={page >= pages} onClick={() => setPage(page + 1)} variant="secondary">
            Siguiente
          </Button>
        </nav>
      ) : null}
    </section>
  )
}
