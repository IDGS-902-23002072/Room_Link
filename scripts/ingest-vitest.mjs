import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const found = args.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : fallback
}

const reportPath = argValue('report', process.env.VITEST_JSON_REPORT ?? 'reports/vitest-results.json')
const suite = argValue('suite', process.env.MONITOR_TEST_SUITE ?? 'backend:unit')
const complete = args.includes('--complete')
const baseUrl = process.env.ROOMLINK_BASE_URL ?? 'http://127.0.0.1:3000'
const ingestUrl = process.env.MONITOR_INGEST_URL ?? `${baseUrl}/api/v1/admin/monitoring/ingest/test-run`
const token = process.env.MONITOR_INGEST_TOKEN ?? ''

if (!token) {
  console.error(JSON.stringify({ origin: 'monitoring', event: 'test_ingest_skipped', reason: 'sin token de ingesta' }))
  process.exit(0)
}

let report
try {
  report = JSON.parse(await readFile(reportPath, 'utf8'))
} catch {
  console.error(JSON.stringify({ origin: 'monitoring', event: 'test_ingest_skipped', reason: 'no se pudo leer el reporte JSON', reportPath }))
  process.exit(0)
}

const sliFromName = (name) => {
  const match = name.match(/\[SLI\s+(\d{1,2}\.\d{1,2}|T\.\d{1,2})\]/i)
  return match ? match[1] : null
}
const moduleFromSli = (sliId) => {
  if (!sliId) return 'sin-sli'
  return sliId.startsWith('T.') ? 'PLAT' : `M${sliId.split('.')[0]}`
}

const results = (report.testResults ?? []).flatMap((file) =>
  (file.assertionResults ?? []).map((assertion) => {
    const sliId = sliFromName(assertion.fullName ?? '')
    const status = ['passed', 'failed', 'skipped'].includes(assertion.status) ? assertion.status : 'failed'
    return {
      sliId,
      module: moduleFromSli(sliId),
      testName: String(assertion.fullName ?? assertion.title ?? 'prueba sin nombre').slice(0, 300),
      result: status,
      dataSummary: null,
      expected: null,
      obtained: null,
      durationMs: Math.max(0, Math.round(Number(assertion.duration ?? 0))),
    }
  }),
)

const startedAt = new Date(report.startTime ?? Date.now()).toISOString()
const finishedAt = new Date().toISOString()
const run = {
  id: randomUUID(),
  startedAt,
  finishedAt,
  suite: suite.slice(0, 80),
  complete,
  totalTests: Number(report.numTotalTests ?? results.length),
  passedTests: Number(report.numPassedTests ?? 0),
  failedTests: Number(report.numFailedTests ?? 0),
  commitSha: process.env.GITHUB_SHA?.slice(0, 64) ?? null,
}

let response
try {
  response = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-monitor-token': token,
    },
    body: JSON.stringify({ run, results }),
  })
} catch {
  console.error(JSON.stringify({ origin: 'monitoring', event: 'test_ingest_failed', reason: 'endpoint de ingesta no disponible' }))
  process.exit(0)
}

const body = await response.json().catch(() => ({}))
console.log(JSON.stringify({
  origin: 'monitoring',
  event: 'test_ingest_finished',
  suite,
  complete,
  totalTests: run.totalTests,
  passedTests: run.passedTests,
  failedTests: run.failedTests,
  resultsSent: results.length,
  ingested: response.ok,
  code: body.code ?? null,
}))

if (!response.ok) process.exit(0)
