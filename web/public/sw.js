/* global self, caches */
const offlineCache = 'roomlink-offline-v1'
const offlinePage = '/offline.html'
const offlineAssets = [offlinePage, '/manifest.webmanifest', '/app-icon-192.png', '/app-icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(offlineCache).then((cache) => cache.addAll(offlineAssets)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name.startsWith('roomlink-offline-') && name !== offlineCache).map((name) => caches.delete(name)),
  )).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.mode !== 'navigate' || request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/descargas/')) return
  event.respondWith(fetch(request).catch(() => caches.match(offlinePage)))
})
