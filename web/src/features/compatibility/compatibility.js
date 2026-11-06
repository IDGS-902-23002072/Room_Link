import { apiRequest } from '../../services/api.js'

export const QUESTIONS = [
  {
    id: 'schedule',
    category: 'Horarios',
    prompt: '¿Qué tan compatible es tu horario con una rutina compartida?',
    options: ['Muy temprano', 'Temprano', 'Intermedio', 'Tarde', 'Nocturno'],
  },
  {
    id: 'cleanliness',
    category: 'Limpieza',
    prompt: '¿Qué importancia tiene para ti mantener todo limpio?',
    options: ['Poca', 'Algo', 'Moderada', 'Mucha', 'Esencial'],
  },
  {
    id: 'noise',
    category: 'Ruido',
    prompt: '¿Qué nivel de ruido prefieres en casa?',
    options: ['Silencio', 'Muy bajo', 'Moderado', 'Con música', 'Social'],
  },
  {
    id: 'smoking',
    category: 'Tabaco',
    prompt: '¿Qué tan cómodo estás conviviendo con el tabaco?',
    options: ['Nada cómodo', 'Poco', 'Neutral', 'Cómodo', 'Fumo o tolero'],
  },
  {
    id: 'pets',
    category: 'Mascotas',
    prompt: '¿Qué tanto te gustan las mascotas en casa?',
    options: ['No las tolero', 'Poco', 'Me da igual', 'Me gustan', 'Las amo'],
  },
  {
    id: 'visits',
    category: 'Visitas',
    prompt: '¿Qué tan frecuentes te gustaría que fueran las visitas?',
    options: ['Nunca', 'Rara vez', 'Ocasionalmente', 'Frecuentemente', 'Muy frecuentes'],
  },
  {
    id: 'genderPref',
    category: 'Preferencia de género',
    prompt: '¿Qué preferencia tienes sobre el género de tus roomies?',
    options: [
      'Solo mi género',
      'Mayormente mi género',
      'Sin preferencia fuerte',
      'Me da igual',
      'Sin preferencia',
    ],
  },
]

const QUESTION_IDS = new Set(QUESTIONS.map(({ id }) => id))
const DRAFT_KEY = '@roomlink/web/compatibility-draft'

export function isValidAnswer(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

export function isCompleteAnswers(answers) {
  return (
    answers !== null &&
    typeof answers === 'object' &&
    !Array.isArray(answers) &&
    Object.keys(answers).length === QUESTIONS.length &&
    QUESTIONS.every(({ id }) => isValidAnswer(answers[id]))
  )
}

export function validateDraft(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return Object.entries(value).every(
    ([dimension, answer]) => QUESTION_IDS.has(dimension) && isValidAnswer(answer),
  )
}

export function calculateSummary(answers) {
  if (!validateDraft(answers)) {
    throw new Error('Las respuestas deben ser enteros de 1 a 5.')
  }
  return QUESTIONS.flatMap(({ id, category }) => {
    const answer = answers[id]
    if (answer === undefined) return []
    const percentage = Math.round(((answer - 1) / 4) * 100)
    return [
      {
        dimension: id,
        category,
        percentage,
        level: percentage <= 33 ? 'bajo' : percentage <= 66 ? 'medio' : 'alto',
      },
    ]
  })
}

export function saveLocalDraft(userId, answers) {
  if (!validateDraft(answers)) {
    throw new Error('No se puede guardar un borrador con respuestas inválidas.')
  }
  try {
    window.localStorage.setItem(
      `${DRAFT_KEY}:${userId}`,
      JSON.stringify(answers),
    )
  } catch {
    throw new Error('No se pudo guardar el borrador en este navegador.')
  }
}

export function loadLocalDraft(userId) {
  let stored
  try {
    stored = window.localStorage.getItem(`${DRAFT_KEY}:${userId}`)
  } catch {
    throw new Error('No se pudo recuperar el borrador de este navegador.')
  }
  if (!stored) return {}

  try {
    const parsed = JSON.parse(stored)
    if (!validateDraft(parsed)) {
      throw new Error('El borrador guardado contiene respuestas inválidas.')
    }
    return parsed
  } catch (error) {
    try {
      window.localStorage.removeItem(`${DRAFT_KEY}:${userId}`)
    } catch {
      throw new Error('El borrador es inválido y no se pudo eliminar.')
    }
    if (error instanceof Error && error.message.includes('borrador guardado')) {
      throw error
    }
    throw new Error('El borrador guardado está dañado y se eliminó.')
  }
}

export function clearLocalDraft(userId) {
  try {
    window.localStorage.removeItem(`${DRAFT_KEY}:${userId}`)
  } catch {
    throw new Error('El test se guardó, pero no se pudo eliminar el borrador.')
  }
}

export function getCompatibilityTest(userId, token) {
  return apiRequest(
    `/api/v1/compatibility/${encodeURIComponent(userId)}`,
    { token },
  )
}

export function saveCompatibilityTest(userId, answers, token) {
  if (!isCompleteAnswers(answers)) {
    throw new Error('Contesta las siete preguntas con valores de 1 a 5.')
  }
  return apiRequest(`/api/v1/compatibility/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(answers),
  })
}

export function getRecommendationFeed(userId, page, token) {
  return apiRequest(
    `/api/v1/compatibility/${encodeURIComponent(userId)}/feed?page=${page}`,
    { token },
  )
}

export function getCandidate(userId, candidateId, token) {
  return apiRequest(
    `/api/v1/compatibility/${encodeURIComponent(userId)}/candidates/${encodeURIComponent(candidateId)}`,
    { token },
  )
}

export function sendConnectionRequest(userId, candidateId, token) {
  return apiRequest(
    `/api/v1/compatibility/${encodeURIComponent(userId)}/connections`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ candidateId, introMessage: null }),
    },
  )
}
