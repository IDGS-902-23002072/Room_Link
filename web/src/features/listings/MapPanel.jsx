import { lazy, Suspense } from 'react'

const LocationMap = lazy(() => import('./LocationMap.jsx'))

export function MapPanel(props) {
  return <Suspense fallback={<p className="listing-map" role="status">Cargando mapa…</p>}><LocationMap {...props} /></Suspense>
}
