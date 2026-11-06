import assert from 'node:assert/strict'
import test from 'node:test'

import {
  QUESTIONS,
  calculateSummary,
  isCompleteAnswers,
  validateDraft,
} from './compatibility.js'

test('el test web usa las siete dimensiones del cuestionario móvil', () => {
  assert.deepEqual(
    QUESTIONS.map(({ id }) => id),
    ['schedule', 'cleanliness', 'noise', 'smoking', 'pets', 'visits', 'genderPref'],
  )
})

test('solo permite finalizar con siete enteros entre uno y cinco', () => {
  const complete = Object.fromEntries(QUESTIONS.map(({ id }) => [id, 3]))
  assert.equal(isCompleteAnswers(complete), true)
  assert.equal(isCompleteAnswers({ ...complete, pets: 6 }), false)
  assert.equal(isCompleteAnswers({ ...complete, pets: '3' }), false)
  assert.equal(isCompleteAnswers({ schedule: 3 }), false)
  assert.equal(isCompleteAnswers({ ...complete, extra: 1 }), false)
})

test('calcula porcentajes y categorías con la fórmula de convivencia', () => {
  const answers = Object.fromEntries(QUESTIONS.map(({ id }) => [id, 1]))
  answers.cleanliness = 2
  answers.noise = 3
  answers.pets = 4
  answers.smoking = 5

  assert.deepEqual(
    calculateSummary(answers).map(({ percentage, level }) => [percentage, level]),
    [
      [0, 'bajo'],
      [25, 'bajo'],
      [50, 'medio'],
      [100, 'alto'],
      [75, 'alto'],
      [0, 'bajo'],
      [0, 'bajo'],
    ],
  )
})

test('acepta borradores parciales válidos y rechaza dimensiones desconocidas', () => {
  assert.equal(validateDraft({ schedule: 2, pets: 5 }), true)
  assert.equal(validateDraft({ visits: 0 }), false)
  assert.equal(validateDraft({ unknown: 3 }), false)
})
