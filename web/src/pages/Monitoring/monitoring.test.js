import assert from 'node:assert/strict'
import test from 'node:test'
import { formatLocal, formatUtc6 } from './monitoring.js'

test('las corridas se muestran en UTC-6 sin cambiar la bitácora', () => {
  const finishedAt = '2026-11-28T02:49:19.000Z'
  const shifted = '2026-11-27T20:49:19.000Z'

  assert.match(formatUtc6(finishedAt), /27 nov 2026, 8:49:19/)
  assert.match(formatLocal(shifted), /27 nov 2026, 8:49:19/)
  assert.match(formatLocal(finishedAt), /28 nov 2026, 2:49:19/)
})

test('una fecha inválida no rompe el panel', () => {
  assert.equal(formatUtc6('no-fecha'), 'Fecha no disponible')
  assert.equal(formatLocal('no-fecha'), 'Fecha no disponible')
})
