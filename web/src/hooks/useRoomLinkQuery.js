import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../services/api.js'

export function useRoomLinkQuery(path, token, refresh = 0) {
  const [result, setResult] = useState(null)
  const latest = useRef(null)

  useEffect(() => {
    if (!path) return
    const request = new AbortController()
    apiRequest(path, { token, signal: request.signal }).then((data) => {
      if (request.signal.aborted) return
      latest.current = { path, token, data }
      setResult({ path, token, data, loading: false, error: '' })
    }).catch((error) => {
      if (request.signal.aborted) return
      const previous = latest.current
      const data = previous?.path === path && previous?.token === token ? previous.data : null
      setResult({ path, token, data, loading: false, error: error.message })
    })
    return () => request.abort()
  }, [path, token, refresh])

  if (path && result?.path === path && result?.token === token) return result
  return { data: null, loading: Boolean(path), error: '' }
}
