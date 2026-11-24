// Local provider fixtures for QA. Start with node serve-map-fixtures.mjs.
// Point GEOCODING_URL to http://127.0.0.1:4521/search and
// NEARBY_PLACES_URL to http://127.0.0.1:4521/interpreter on the API.
// Set E2E_QA_MAP_FIXTURES=1 when running the QA suite.
import { createServer } from 'node:http'

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4521')
  response.setHeader('Content-Type', 'application/json')
  if (url.pathname === '/search' && url.searchParams.get('q') === 'Centro de León QA' && url.searchParams.get('countrycodes') === 'mx') {
    return response.end(JSON.stringify([
      { lat: '21.1221', lon: '-101.683', display_name: 'Centro de León, Guanajuato' },
    ]))
  }
  if (url.pathname === '/interpreter' && request.method === 'POST') {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const query = new URLSearchParams(Buffer.concat(chunks).toString()).get('data')
    const point = /\(around:1500,(-?\d+\.\d+),(-?\d+\.\d+)\)/.exec(query || '')
    if (point) {
      return response.end(JSON.stringify({ elements: [
        { id: 7, type: 'node', lat: Number(point[1]) + 0.001, lon: Number(point[2]), tags: { amenity: 'pharmacy', name: 'Farmacia de prueba' } },
      ] }))
    }
  }
  response.statusCode = 400
  response.end('{}')
}).listen(4521, '127.0.0.1')
