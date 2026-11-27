const baseUrl = process.env.ROOMLINK_BASE_URL ?? 'http://127.0.0.1:3000'
const ingestUrl = process.env.MONITOR_INGEST_URL ?? `${baseUrl}/api/v1/admin/monitoring/ingest/backup`
const token = process.env.MONITOR_INGEST_TOKEN ?? ''

const date = process.env.BACKUP_DATE ?? new Date().toISOString().slice(0, 10)
const status = process.env.BACKUP_STATUS ?? 'success'
const sizeBytes = process.env.BACKUP_SIZE_BYTES ? Number(process.env.BACKUP_SIZE_BYTES) : null
const durationMs = process.env.BACKUP_DURATION_MS ? Number(process.env.BACKUP_DURATION_MS) : null

if (!token) {
  console.error(JSON.stringify({ origin: 'monitoring', event: 'backup_skipped', reason: 'sin token de ingesta' }))
  process.exit(1)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['success', 'failed'].includes(status)) {
  console.error(JSON.stringify({ origin: 'monitoring', event: 'backup_skipped', reason: 'fecha o estado inválido' }))
  process.exit(1)
}

const response = await fetch(ingestUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-monitor-token': token,
  },
  body: JSON.stringify({ backupDate: date, status, sizeBytes, durationMs }),
})
const body = await response.json().catch(() => ({}))

console.log(JSON.stringify({
  origin: 'monitoring',
  event: 'backup_recorded',
  backupDate: date,
  status,
  ingested: response.ok,
  code: body.code ?? null,
}))

if (!response.ok) process.exit(1)
