import { apiRequest } from '../../services/api.js'

export async function getPublicProfile(userId, token, signal) {
  const path = `/api/v1/profiles/${encodeURIComponent(userId)}`
  const [profile, gallery] = await Promise.all([
    apiRequest(path, { token, signal }),
    apiRequest(`${path}/photos`, { token, signal }),
  ])
  const photos = gallery?.photos ?? gallery?.items
  if (!Array.isArray(photos)) {
    throw new Error('La galería devolvió una respuesta inválida.')
  }
  return { profile, photos }
}
