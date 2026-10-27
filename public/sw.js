// Generated build versions keep old hashed chunks from accumulating indefinitely.
const CACHE_PREFIX = 'var-toolbox-'
const CACHE = `${CACHE_PREFIX}__BUILD_VERSION__`
const CORE = /* CORE_ASSETS */ []
const ASSETS = /* ALL_ASSETS */ []
const READY = './__offline_ready__'
let preparing
let status = { state: 'idle', done: 0, total: ASSETS.length }

async function report() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true })
  for (const client of clients) client.postMessage({ type: 'OFFLINE_STATUS', ...status })
}

async function prepareOffline() {
  if (preparing) return preparing
  preparing = (async () => {
    const cache = await caches.open(CACHE)
    if (await cache.match(READY)) {
      status = { state: 'ready', done: ASSETS.length, total: ASSETS.length }
      await report()
      return
    }
    status = { state: 'preparing', done: 0, total: ASSETS.length }
    await report()
    let next = 0
    let failed = false
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (next < ASSETS.length) {
        const url = ASSETS[next++]
        try {
          if (!(await cache.match(url))) await cache.add(url)
          status.done++
        } catch {
          failed = true
        }
        await report()
      }
    }))
    status.state = failed ? 'incomplete' : 'ready'
    if (!failed) await cache.put(READY, new Response('ready'))
    await report()
  })().catch(async () => {
    status.state = 'incomplete'
    await report()
  }).finally(() => { preparing = undefined })
  return preparing
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    // A failed core install leaves the previous working worker active.
    await cache.addAll(CORE)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data === 'PREPARE_OFFLINE') event.waitUntil(prepareOffline())
  if (event.data === 'OFFLINE_STATUS') event.waitUntil((async () => {
    if (!preparing) {
      const cache = await caches.open(CACHE)
      const ready = await cache.match(READY)
      status = { state: ready ? 'ready' : 'idle', done: ready ? ASSETS.length : 0, total: ASSETS.length }
    }
    await report()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || request.headers.has('range') || !/^https?:$/.test(url.protocol)) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          await cache.put('./index.html', response.clone())
        }
        return response
      } catch {
        return (await cache.match('./index.html')) || Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const immutable = /\/(assets|pdf-assets)\//.test(url.pathname)
    // Same-origin immutable files are identical across CORS request headers.
    const cached = await cache.match(request, { ignoreSearch: immutable, ignoreVary: immutable })
    if (cached && immutable) return cached
    const fresh = async () => {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    }
    if (cached) {
      event.waitUntil(fresh().catch(() => undefined))
      return cached
    }
    try { return await fresh() } catch { return Response.error() }
  })())
})
