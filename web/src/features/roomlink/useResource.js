import { useEffect, useState } from 'react'

const loading = { data: null, error: '', loading: true }

export function useResource(load) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState(loading)
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ data, error: '', loading: false }) },
      (error) => { if (!controller.signal.aborted) setState({ data: null, error: error.message, loading: false }) },
    )
    return () => controller.abort()
  }, [load, revision])

  function refresh() {
    setState(loading)
    setRevision((value) => value + 1)
  }
  return { ...state, refresh }
}
