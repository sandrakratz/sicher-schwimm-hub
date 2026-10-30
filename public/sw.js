self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Sicher Schwimmen', body: event.data && event.data.text() } }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sicher Schwimmen', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || undefined,
      requireInteraction: true,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus() }
      return self.clients.openWindow(url)
    }),
  )
})

// ---------------------------------------------------------------------------------------------
// Offline-Nutzung des Trainerbereichs
// - Programmdateien (/assets, Schriften, Symbole): zuerst aus dem Zwischenspeicher
// - Seiten unter /trainer: zuerst Netz, sonst die zuletzt gesehene Fassung (die Seite selbst enthält keine Daten;
//   Teilnehmerdaten liegen getrennt in der App-Datenbank und werden nach 48 h bzw. beim Abmelden gelöscht)
// - Alles andere (Server-Aufrufe, API, Fremdserver) läuft unverändert übers Netz und wird nie zwischengespeichert
// ---------------------------------------------------------------------------------------------
const SHELL = 'shell-v1'
const ASSETS = 'assets-v1'

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![SHELL, ASSETS].includes(k)).map((k) => caches.delete(k))),
    ),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'clear-shell') event.waitUntil(caches.delete(SHELL))
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_server')) return

  const isAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    /\.(png|jpe?g|svg|webp|woff2?)$/.test(url.pathname)
  if (isAsset) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  const wantsHtml = (req.headers.get('accept') || '').includes('text/html')
  if (wantsHtml && url.pathname.startsWith('/trainer')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(async () => {
          const cache = await caches.open(SHELL)
          return (
            (await cache.match(req)) ||
            (await cache.match('/trainer/offline')) ||
            (await cache.match('/trainer')) ||
            Response.error()
          )
        }),
    )
  }
})
