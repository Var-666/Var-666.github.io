// VAR 工具箱 Service Worker：静态资源离线缓存，让已用过的工具在断网后仍可打开。
// 策略：导航请求网络优先（保证发布新版本后能及时拿到），其余同源 GET 走
// stale-while-revalidate（带哈希的构建产物内容不变，可安全复用缓存）。
const VERSION = 'v1'
const CACHE = `var-toolbox-${VERSION}`
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // 预缓存逐项写入，单个资源失败不阻塞安装
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Range 请求（PDF.js 分段加载）和 blob/data 交给浏览器直接处理
  if (request.headers.has('range') || !/^https?:$/.test(url.protocol)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(CACHE)
          cache.put('./index.html', response.clone())
          return response
        } catch {
          const cache = await caches.open(CACHE)
          return (
            (await cache.match('./index.html')) || (await cache.match('./')) || Response.error()
          )
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request, {
        ignoreSearch: url.pathname.startsWith('/assets/'),
      })
      if (cached) {
        // 后台更新，下次请求使用新内容
        event.waitUntil(
          fetch(request)
            .then((response) => (response.ok ? cache.put(request, response) : undefined))
            .catch(() => undefined),
        )
        return cached
      }
      try {
        const response = await fetch(request)
        if (response.ok && response.type === 'basic') cache.put(request, response.clone())
        return response
      } catch {
        return Response.error()
      }
    })(),
  )
})
