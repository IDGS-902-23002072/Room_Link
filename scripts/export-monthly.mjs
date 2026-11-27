import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const found = args.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : fallback
}

const defaultDir = fileURLToPath(new URL('../reports/', import.meta.url))
const period = argValue('period', process.env.MONITOR_PERIOD ?? '')
const outDir = resolve(argValue('out-dir', defaultDir))
const baseUrl = (process.env.ROOMLINK_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
// El token se lee solo del entorno: nunca aparece en la línea de comandos ni en los logs.
const token = process.env.MONITOR_ADMIN_TOKEN ?? ''

const log = (event, extra = {}, stream = console.log) =>
  stream(JSON.stringify({ origin: 'monitoring', event, ...extra }))

if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
  log('export_failed', { reason: 'periodo inválido; usa --period=YYYY-MM' }, console.error)
  process.exit(1)
}
if (!token) {
  log('export_failed', { reason: 'falta MONITOR_ADMIN_TOKEN' }, console.error)
  process.exit(1)
}

const url = new URL(`${baseUrl}/api/v1/admin/monitoring/export/requests.csv`)
url.searchParams.set('month', period)

try {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    log('export_failed', { reason: 'respuesta no autorizada o no disponible', status: response.status }, console.error)
    process.exit(1)
  }
  // Se guardan los bytes tal cual: response.text() quita el BOM que emite la API.
  const bytes = Buffer.from(await response.arrayBuffer())
  const text = bytes.toString('utf8')
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? ''
  if (!header.startsWith('period,') || !header.includes('is_good')) {
    log('export_failed', { reason: 'el CSV no tiene el encabezado esperado' }, console.error)
    process.exit(1)
  }
  const path = resolve(outDir, `solicitudes-${period}.csv`)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).length - 1
  log('export_finished', { period, rows, bytes: bytes.length, path })
} catch (error) {
  log(
    'export_failed',
    { reason: 'no se pudo descargar el CSV', detail: error instanceof Error ? error.name : 'error' },
    console.error,
  )
  process.exit(1)
}
