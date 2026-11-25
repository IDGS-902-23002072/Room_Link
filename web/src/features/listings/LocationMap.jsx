import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { coordinates } from './listings.js'

const leon = [21.122, -101.683]

export default function LocationMap({ location, onPick, places, selected }) {
  const container = useRef(null)
  const map = useRef(null)
  const dot = useRef(null)
  const [latitude, longitude] = coordinates(location) || []

  useEffect(() => {
    const instance = L.map(container.current, { scrollWheelZoom: false, zoomControl: false })
    L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(instance)
    // Carto basemaps: CDN gratuito apto para uso en navegador sin API key.
    // OpenStreetMap bloquea (403) el hotlinking directo de sus tiles por su
    // tile usage policy; Carto sirve los mismos datos de OSM sin ese bloqueo.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      referrerPolicy: 'origin',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(instance)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      dot.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (latitude === undefined || longitude === undefined) {
      dot.current?.remove()
      dot.current = null
      instance.setView(leon, 12)
      return
    }
    const point = [latitude, longitude]
    if (dot.current) {
      dot.current.setLatLng(point)
      instance.panTo(point)
    } else {
      dot.current = L.circleMarker(point, { radius: 9, color: '#175d48', fillColor: '#78d9b5', fillOpacity: 1 }).addTo(instance)
      instance.setView(point, 15)
    }
  }, [latitude, longitude])

  useEffect(() => {
    if (!onPick) return
    const instance = map.current
    const pick = ({ latlng }) => onPick(latlng.lat.toFixed(6), L.Util.wrapNum(latlng.lng, [-180, 180], true).toFixed(6))
    instance.on('click', pick)
    return () => instance.off('click', pick)
  }, [onPick])

  useEffect(() => {
    if (!places?.length) return
    const instance = map.current
    const layer = L.layerGroup().addTo(instance)
    for (const place of places) {
      const point = coordinates(place)
      if (!point) continue
      const active = place.id === selected
      const label = document.createElement('span')
      label.textContent = place.label
      L.circleMarker(point, { radius: active ? 8 : 5, color: '#533d68', fillColor: '#d9bce4', fillOpacity: 1 })
        .bindTooltip(label).addTo(layer)
      if (active) instance.panTo(point)
    }
    return () => layer.remove()
  }, [places, selected])

  return <div aria-label={onPick ? 'Mapa para elegir la ubicación' : 'Mapa de ubicación de la habitación'} className="listing-map" ref={container} role="region" />
}
