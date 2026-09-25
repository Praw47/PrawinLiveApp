const APP_ROOT = new URL(self.registration.scope).pathname
const APP_URL = new URL(APP_ROOT, self.location.origin).href
const CACHE_NAME = `prawin-live-v1-${APP_ROOT.replace(/[^a-z0-9]/gi, '-')}`
const APP_SHELL = [
  APP_URL,
  new URL('manifest.webmanifest', APP_URL).href,
  new URL('favicon.svg', APP_URL).href,
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('prawin-live-v1-') && name !== CACHE_NAME).map((name) => caches.delete(name))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(APP_URL, copy))
      return response
    }).catch(() => caches.match(APP_URL)))
    return
  }

  if (new URL(request.url).pathname.startsWith(`${APP_ROOT}assets/`)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
      return response
    })))
  }
})