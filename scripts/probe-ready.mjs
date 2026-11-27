import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

const baseUrl = process.env.ROOMLINK_BASE_URL ?? 'http://127.0.0.1:3000'
const ingestUrl = process.env.MONITOR_INGEST_URL ?? `${baseUrl}/api/v1/admin/monitoring/ingest/probe`
const token = process.env.MONITOR_INGEST_TOKEN ?? ''
const requestId = randomUUID()

if (!token) {
  console.error(JSON.stringify({ origin: 'monitoring', event: 'probe_skipped', reason: 'sin token de ingesta' }))
  process.exit(1)
}

const startedAt = performance.now()
let status = 'down'
let httpStatus = null
let latencyMs = null
try {
  const response = await fetch(new URL('/ready', baseUrl), {
    signal: AbortSignal.timeout(5000),
    headers: { 'x-request-id': requestId },
  })
  httpStatus = response.status
  status = response.status === 200 ? 'up' : 'down'
  await response.arrayBuffer()
} catch {
  status = 'down'
} finally {
  latencyMs = Math.max(0, Math.round(performance.now() - startedAt))
}

const response = await fetch(ingestUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-monitor-token': token,
  },
  body: JSON.stringify({
    status,
    httpStatus,
    latencyMs,
    requestId,
    checkedAt: new Date().toISOString(),
  }),
})

const body = await response.json().catch(() => ({}))
console.log(JSON.stringify({
  origin: 'monitoring',
  event: 'probe_recorded',
  status,
  httpStatus,
  latencyMs,
  ingested: response.ok,
  code: body.code ?? null,
}))

if (!response.ok) process.exit(1)
