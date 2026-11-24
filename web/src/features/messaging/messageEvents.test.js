import assert from 'node:assert/strict'
import test from 'node:test'
import { listenToRoom } from './messageEvents.js'

test('lee eventos SSE fragmentados con la misma sesión que las peticiones del chat', async (t) => {
  const chunks = [
    'event: connected\r\n', 'data: {"roomId":"room-1"}\r\n\r', '\n',
    ': heartbeat\n\nevent: message.', 'created\ndata: {"message":\n', 'data: {"id":42}}\n\n',
  ]
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } }))
  const events = []
  const { signal } = new AbortController()
  await listenToRoom('/api/v1/messages/rooms/room-1/events', 'demo-token', signal, (...event) => events.push(event))
  assert.deepEqual(events, [
    ['connected', { roomId: 'room-1' }],
    ['message.created', { message: { id: 42 } }],
  ])
  const [, options] = fetchMock.mock.calls[0].arguments
  assert.equal(options.headers.Authorization, 'Bearer demo-token')
  assert.equal(options.headers.Accept, 'text/event-stream')
  assert.equal(options.signal, signal)
})
