import assert from 'node:assert/strict'
import test from 'node:test'

import {
  RENT_FILTERS,
  describeApplicationStatus,
  describeRules,
  formatAvailability,
  formatCostAmount,
  formatHostName,
  formatRent,
  formatRoomLocation,
  formatRoommates,
  formatShortDate,
  indexApplications,
} from './rooms.js'

const TODAY = new Date(2026, 10, 23) // 23 nov 2026, hora local

test('la renta se muestra en pesos mensuales', () => {
  assert.equal(formatRent(3500), `$${(3500).toLocaleString('es-MX')} MXN/mes`)
  assert.equal(formatRent('abc'), 'Renta no indicada')
})

test('los costos se muestran en pesos sin asumir que son mensuales', () => {
  assert.equal(formatCostAmount(1800), `$${(1800).toLocaleString('es-MX')} MXN`)
  assert.equal(formatCostAmount(null), 'Monto no indicado')
})

test('las fechas se formatean sin desfase de zona horaria', () => {
  assert.equal(formatShortDate('2026-12-01'), '1 dic 2026')
  assert.equal(formatShortDate('2027-01-15'), '15 ene 2027')
  assert.equal(formatShortDate(null), '')
})

test('la disponibilidad distingue entre ahora y una fecha futura', () => {
  assert.equal(formatAvailability(null, TODAY), 'Disponible ahora')
  assert.equal(formatAvailability('2026-11-23', TODAY), 'Disponible ahora')
  assert.equal(formatAvailability('2026-11-01', TODAY), 'Disponible ahora')
  assert.equal(formatAvailability('2026-12-01', TODAY), 'Disponible desde 1 dic 2026')
})

test('la ubicación usa zona y ciudad, o la dirección como respaldo', () => {
  assert.equal(formatRoomLocation({ zone: 'Centro', city: 'León' }), 'Centro · León')
  assert.equal(formatRoomLocation({ zone: null, city: 'León' }), 'León')
  assert.equal(formatRoomLocation({ address: 'Calle 5 #10' }), 'Calle 5 #10')
  assert.equal(formatRoomLocation({}), 'Ubicación no indicada')
})

test('el anfitrión sin nombre se muestra como Anfitrión', () => {
  assert.equal(formatHostName({ hostName: 'Mariana R.' }), 'Mariana R.')
  assert.equal(formatHostName({ hostName: '  ' }), 'Anfitrión')
  assert.equal(formatHostName({ hostName: null }), 'Anfitrión')
})

test('los compañeros se muestran en singular y plural', () => {
  assert.equal(formatRoommates(1), 'Hasta 1 compañero')
  assert.equal(formatRoommates(3), 'Hasta 3 compañeros')
  assert.equal(formatRoommates(null), 'No indicado')
})

test('las reglas omiten lo que el anfitrión no indicó', () => {
  assert.deepEqual(describeRules(null), [])
  assert.deepEqual(describeRules({ partiesAllowed: null, petsAllowed: undefined }), [])
  const rows = describeRules({
    partiesAllowed: false,
    petsAllowed: true,
    smokingAllowed: false,
    quietHoursStart: '22:00:00',
    quietHoursEnd: '07:00:00',
    visitsPolicy: null,
    commonAreasNotes: null,
    extraRules: null,
  })
  assert.deepEqual(rows.map(({ label }) => label), [
    'Fiestas',
    'Mascotas',
    'Fumar',
    'Horario de silencio',
  ])
  assert.equal(rows[3].value, '22:00 a 07:00')
  assert.equal(rows[1].value, 'Permitidas')
})

test('los filtros de renta incluyen "cualquier precio" sin tope', () => {
  assert.equal(RENT_FILTERS[0].maxRent, undefined)
  assert.ok(RENT_FILTERS.slice(1).every(({ maxRent }) => maxRent > 0))
})

test('indexa las postulaciones por habitación y tolera datos inválidos', () => {
  assert.deepEqual(indexApplications(null), {})
  assert.deepEqual(
    indexApplications([{ listingId: 'a', status: 'accepted' }, { listingId: 'b' }, {}]),
    { a: 'accepted', b: 'pending' },
  )
})

test('describe el estado de la postulación', () => {
  assert.equal(describeApplicationStatus('accepted'), 'Postulación aceptada')
  assert.equal(describeApplicationStatus('otro'), 'Postulación enviada')
})
