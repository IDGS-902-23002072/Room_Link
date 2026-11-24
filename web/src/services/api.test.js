import assert from 'node:assert/strict'
import test from 'node:test'
import { apiRequest } from './api.js'

test('permite subir fotos multipart y eliminar fotos con respuesta 204', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) =>
    options.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : Response.json({ photos: [{ id: 'photo-1' }] }, { status: 201 }),
  )
  const path = '/api/v1/profiles/test-user/photos'
  const token = 'test-token'
  const body = new FormData()
  body.append('photos', new Blob(['photo'], { type: 'image/png' }), 'profile.png')

  assert.deepEqual(await apiRequest(path, { token, method: 'POST', body }), { photos: [{ id: 'photo-1' }] })
  const [, uploadOptions] = fetchMock.mock.calls[0].arguments
  assert.equal(uploadOptions.body, body)
  assert.equal(uploadOptions.headers.Authorization, 'Bearer test-token')
  assert.equal(uploadOptions.headers['Content-Type'], undefined)
  assert.equal(await apiRequest(`${path}/photo-1`, { token, method: 'DELETE' }), null)
})
