import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'

const base = new URL(process.env.QA_BASE_URL ?? 'http://localhost:3000')
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname), 'El ensayo de carga requiere un entorno local.')
const results = await Promise.all(Array.from({ length: 4 }, async () => {
  const samples = []
  for (let i = 0; i < 10; i += 1) {
    const start = performance.now()
    const response = await fetch(new URL('/api/v1/rooms/feed?pageSize=1', base), { signal: AbortSignal.timeout(5000) })
    assert.equal(response.status, 200)
    assert.ok(Array.isArray((await response.json()).items))
    samples.push(performance.now() - start)
  }
  return samples
}))
const samples = results.flat().sort((a, b) => a - b)
const p95 = samples[Math.ceil(samples.length * 0.95) - 1]
console.log(`${samples.length} lecturas correctas · p95 ${p95.toFixed(1)} ms`)
assert.ok(p95 < 2000, 'p95 del feed supera el umbral de QA de 2 segundos.')
