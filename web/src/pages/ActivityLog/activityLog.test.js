import assert from 'node:assert/strict'
import test from 'node:test'

import { PAGE_SIZE, buildQuery, dayBoundary, describeAction, toCsv, totalPages } from './activityLog.js'

test('describe los eventos conocidos y deja los demás tal cual', () => {
  assert.equal(describeAction('SanctionIssuedEvent'), 'Sanción emitida')
  assert.equal(describeAction('OtroEvento'), 'OtroEvento')
})

test('la consulta calcula el desplazamiento y omite filtros vacíos', () => {
  const params = new URLSearchParams(buildQuery({ page: 3, action: '', userId: '  ', from: '', to: '' }))
  assert.equal(params.get('limit'), String(PAGE_SIZE))
  assert.equal(params.get('offset'), String(PAGE_SIZE * 2))
  assert.equal(params.has('action'), false)
  assert.equal(params.has('userId'), false)
  assert.equal(params.has('from'), false)
})

test('la consulta incluye acción, usuario y rango de fechas', () => {
  const params = new URLSearchParams(
    buildQuery({ page: 1, action: 'SanctionIssuedEvent', userId: ' u1 ', from: '2026-11-01', to: '2026-11-30' }),
  )
  assert.equal(params.get('action'), 'SanctionIssuedEvent')
  assert.equal(params.get('userId'), 'u1')
  assert.ok(new Date(params.get('from')) < new Date(params.get('to')))
})

test('el fin de día incluye todo el día y las fechas inválidas se ignoran', () => {
  const start = new Date(dayBoundary('2026-11-24', 'start'))
  const end = new Date(dayBoundary('2026-11-24', 'end'))
  assert.equal(end.getDate(), 24)
  assert.equal(start.getHours(), 0)
  assert.equal(end.getHours(), 23)
  assert.equal(dayBoundary('24/11/2026', 'start'), null)
})

test('las páginas totales nunca bajan de una', () => {
  assert.equal(totalPages(0), 1)
  assert.equal(totalPages(PAGE_SIZE), 1)
  assert.equal(totalPages(PAGE_SIZE + 1), 2)
})

test('el CSV escapa comillas y neutraliza fórmulas', () => {
  const csv = toCsv([
    { createdAt: '2026-11-24T00:00:00.000Z', action: 'X', userId: '=cmd', ipAddress: null, metadata: { a: '"q"' } },
  ])
  const [header, row] = csv.split('\r\n')
  assert.equal(header.startsWith('"Fecha","Evento"'), true)
  assert.ok(row.includes(`"'=cmd"`))
  assert.ok(row.includes('""a"":""\\""q\\'))
})
