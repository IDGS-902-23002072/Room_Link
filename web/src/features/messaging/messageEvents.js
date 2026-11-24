import { apiFetch } from '../../services/api.js'

export async function listenToRoom(path, token, signal, onEvent) {
  const response = await apiFetch(path, { token, signal, accept: 'text/event-stream' })
  if (!response.headers.get('Content-Type')?.includes('text/event-stream') || !response.body) {
    throw new Error('El canal de mensajes en vivo no está disponible.')
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let eventName = ''
  let data = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += value
      let lineEnd = buffer.indexOf('\n')
      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd).replace(/\r$/, '')
        buffer = buffer.slice(lineEnd + 1)
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
        if (!line) {
          if (eventName && data.length) onEvent(eventName, JSON.parse(data.join('\n')))
          eventName = ''
          data = []
        }
        lineEnd = buffer.indexOf('\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}
