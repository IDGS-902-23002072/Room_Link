import { apiRequest } from '../../services/api.js'

export const QUESTIONS = [
  {
    id: 'schedule',
    category: 'Horarios',
    prompt: '¿A qué hora sueles empezar tu día?',
    options: [
      'Antes de las 6:00 a. m.',
      'Entre las 6:00 y las 8:00 a. m.',
      'Entre las 8:00 y las 10:00 a. m.',
      'Entre las 10:00 a. m. y el mediodía.',
      'Después del mediodía.',
    ],
  },
  {
    id: 'cleanliness',
    category: 'Limpieza',
    prompt: '¿Qué tan importante es para ti que la casa esté limpia y ordenada?',
    options: [
      'Poco importante: me basta con una limpieza básica.',
      'Algo importante: prefiero limpiar cuando hace falta.',
      'Importante: me gusta mantener un orden regular.',
      'Muy importante: prefiero limpiar con frecuencia.',
      'Esencial: necesito que esté siempre muy limpia y ordenada.',
    ],
  },
  {
    id: 'noise',
    category: 'Ruido',
    prompt: '¿Qué ambiente de ruido prefieres en casa la mayor parte del tiempo?',
    options: [
      'Mucho silencio; prefiero evitar la música y el ruido.',
      'Poco ruido; música o conversaciones a volumen bajo.',
      'Un nivel moderado; el ruido cotidiano está bien.',
      'Me gustan la música y las conversaciones en casa.',
      'Prefiero un ambiente animado y no me molestan las reuniones.',
    ],
  },
  {
    id: 'smoking',
    category: 'Fumar en casa',
    prompt: '¿Qué tan cómodo/a te sentirías viviendo con alguien que fuma dentro de casa?',
    options: [
      'No me sentiría cómodo/a; prefiero que nadie fume dentro.',
      'Preferiría que no fume dentro, aunque puedo hablarlo.',
      'Me es indiferente si hay acuerdos claros.',
      'Me sentiría cómodo/a si fuma de vez en cuando.',
      'No me molesta que fumen dentro (o yo también fumo).',
    ],
  },
  {
    id: 'pets',
    category: 'Mascotas',
    prompt: '¿Qué tan cómodo/a te sentirías viviendo con mascotas?',
    options: [
      'Prefiero vivir en una casa sin mascotas.',
      'Podría aceptar una mascota con algunos límites.',
      'Me es indiferente convivir con mascotas.',
      'Me gustan las mascotas y no me molestan en casa.',
      'Me encanta convivir con mascotas.',
    ],
  },
  {
    id: 'visits',
    category: 'Visitas',
    prompt: '¿Con qué frecuencia te gustaría recibir visitas en casa?',
    options: [
      'Nunca o casi nunca.',
      'Solo en ocasiones especiales.',
      'Una o dos veces al mes.',
      'Aproximadamente una vez por semana.',
      'Varias veces por semana.',
    ],
  },
  {
    id: 'genderPref',
    category: 'Preferencia de género',
    prompt: '¿Qué tan importante es para ti que las personas con quienes compartes vivienda sean de tu mismo género?',
    options: [
      'No es importante; puedo compartir con personas de cualquier género.',
      'Tengo una leve preferencia por personas de mi mismo género.',
      'Prefiero que sean de mi mismo género, pero consideraría otras opciones.',
      'Es muy importante que sean de mi mismo género.',
      'Solo quiero compartir con personas de mi mismo género.',
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

export function getRecommendationFeed(userId, page, token, signal) {
  return apiRequest(
    `/api/v1/compatibility/${encodeURIComponent(userId)}/feed?page=${page}`,
    { token, signal },
  )
}

export function getCandidate(userId, candidateId, token, signal) {
  return apiRequest(
    `/api/v1/compatibility/${encodeURIComponent(userId)}/candidates/${encodeURIComponent(candidateId)}`,
    { token, signal },
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
