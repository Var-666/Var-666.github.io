import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'

const template = readFileSync(new URL('../apps/web/public/tools/sw.js', import.meta.url), 'utf8')
const base = 'https://example.test/'
const response = (text, status = 200, type = 'text/plain') => {
  const value = new Response(text, { status, headers: { 'content-type': type } })
  Object.defineProperty(value, 'type', { value: 'basic' })
  return value
}

function worker({ core = [], assets = [] } = {}) {
  const listeners = {},
    stores = new Map(),
    network = new Map(),
    hits = [],
    messages = []
  let skipped = false
  const fetch = async (request) => {
    const url = new URL(typeof request === 'string' ? request : request.url, base).href
    hits.push(url)
    const value = network.get(url)
    if (!value) throw new Error('offline')
    return value.clone()
  }
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const map = stores.get(name)
      const key = (request) =>
        new URL(typeof request === 'string' ? request : request.url, base).href
      const cache = {
        match: async (request, options) => {
          const requested = key(request)
          const found = [...map.keys()].find((url) =>
            options?.ignoreSearch
              ? url.split('?')[0] === requested.split('?')[0]
              : url === requested,
          )
          return found ? map.get(found).clone() : undefined
        },
        put: async (request, value) => {
          map.set(key(request), value.clone())
        },
        add: async (request) => {
          const value = await fetch(request)
          if (!value.ok) throw new Error('bad status')
          await cache.put(request, value)
        },
        addAll: async (requests) => {
          await Promise.all(requests.map(cache.add))
        },
      }
      return cache
    },
  }
  const self = {
    location: { origin: new URL(base).origin },
    clients: {
      claim: async () => {},
      matchAll: async () => [{ postMessage: (data) => messages.push(data) }],
    },
    skipWaiting: async () => {
      skipped = true
    },
    addEventListener: (name, handler) => {
      listeners[name] = handler
    },
  }
  runInNewContext(
    template
      .replace('/* CORE_ASSETS */ []', JSON.stringify(core))
      .replace('/* ALL_ASSETS */ []', JSON.stringify(assets)),
    { self, caches, fetch, URL, Response, Promise },
  )
  return {
    caches,
    network,
    hits,
    messages,
    skipped: () => skipped,
    dispatch: async (name, value = {}) => {
      const waits = []
      let result
      listeners[name]({
        ...value,
        waitUntil: (promise) => waits.push(promise),
        respondWith: (promise) => {
          result = promise
        },
      })
      const output = await result
      await Promise.all(waits)
      return output
    },
  }
}

const request = (path, mode = 'cors') => ({
  url: new URL(path, base).href,
  mode,
  method: 'GET',
  headers: new Headers(),
})
const cacheName = 'var-toolbox-__BUILD_VERSION__'

test('build manifests cover lazy chunks and fonts, version changes with output, sitemap date is generated', () => {
  const directory = mkdtempSync(join(tmpdir(), 'var-offline-'))
  try {
    for (const path of ['_next/static/chunks', 'pdf-assets/cmaps', 'icons', 'tools'])
      mkdirSync(join(directory, path), { recursive: true })
    const files = {
      'index.html':
        '<html><head><script src="/_next/static/chunks/index-abc.js"></script><script>self.__next_f=[]</script></head></html>',
      'tools/index.html':
        '<html><head><script src="/_next/static/chunks/index-abc.js"></script></head></html>',
      'sitemap.xml': '<lastmod>2000-01-01</lastmod>',
      '_next/static/chunks/index-abc.js': 'main',
      '_next/static/chunks/PdfTool-def.js': 'pdf',
      '_next/static/chunks/text.worker.abc.js': 'worker',
      'pdf-assets/cmaps/test.bcmap': 'font',
      'manifest.webmanifest': '{}',
      'favicon.svg': 'svg',
      'icons/icon-192.png': 'png',
      'icons/icon-512.png': 'png',
    }
    for (const [path, data] of Object.entries(files)) writeFileSync(join(directory, path), data)
    const build = () => {
      execFileSync(process.execPath, [
        fileURLToPath(new URL('./build-offline.mjs', import.meta.url)),
        directory,
      ])
      return readFileSync(join(directory, 'tools/sw.js'), 'utf8')
    }
    const initial = build()
    assert.equal(initial, build())
    assert.equal(
      readFileSync(join(directory, 'tools/_next/static/chunks/text.worker.abc.js'), 'utf8'),
      'worker',
    )
    assert.equal(existsSync(join(directory, '_next/static/chunks/text.worker.abc.js')), false)
    assert.match(initial, /\/tools\/_next\/static\/chunks\/text.worker.abc.js/)
    const html = readFileSync(join(directory, 'index.html'), 'utf8')
    assert.match(html, /Content-Security-Policy/)
    assert.match(html, /script-src 'self' 'wasm-unsafe-eval' 'sha256-/)
    assert.equal((html.match(/Content-Security-Policy/g) ?? []).length, 1)
    assert.doesNotMatch(html, /script-src[^;]*'unsafe-inline'/)
    assert.match(initial, /\/_next\/static\/chunks\/PdfTool-def.js/)
    assert.match(initial, /\/pdf-assets\/cmaps\/test.bcmap/)
    assert.doesNotMatch(initial, /__BUILD_VERSION__|CORE_ASSETS|ALL_ASSETS/)
    assert.match(
      readFileSync(join(directory, 'sitemap.xml'), 'utf8'),
      new RegExp(new Date().toISOString().slice(0, 10)),
    )
    writeFileSync(join(directory, '_next/static/chunks/PdfTool-def.js'), 'changed')
    assert.notEqual(initial, build())
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('activation removes only older toolbox caches', async () => {
  const sw = worker()
  await sw.caches.open('var-toolbox-v1')
  await sw.caches.open(cacheName)
  await sw.caches.open('other-app')
  await sw.dispatch('activate')
  assert.deepEqual(await sw.caches.keys(), [cacheName, 'other-app'])
})

test('hashed assets are served from cache without revalidation', async () => {
  const sw = worker(),
    cache = await sw.caches.open(cacheName)
  await cache.put('./_next/static/chunks/tool-abc.js', response('cached chunk'))
  assert.equal(
    await (
      await sw.dispatch('fetch', { request: request('/_next/static/chunks/tool-abc.js') })
    ).text(),
    'cached chunk',
  )
  assert.equal(sw.hits.length, 0)
})

test('unsuccessful navigation never replaces the last good offline HTML', async () => {
  const sw = worker(),
    cache = await sw.caches.open(cacheName)
  await cache.put('/tools/index.html', response('<h1>working</h1>', 200, 'text/html'))
  sw.network.set(base, response('<h1>unavailable</h1>', 503, 'text/html'))
  assert.equal((await sw.dispatch('fetch', { request: request('/', 'navigate') })).status, 503)
  sw.network.clear()
  assert.equal(
    await (await sw.dispatch('fetch', { request: request('/', 'navigate') })).text(),
    '<h1>working</h1>',
  )
})

test('offline readiness requires every asset; a retry fills gaps without fetching cached files', async () => {
  const sw = worker({ assets: ['./_next/static/chunks/a.js', './pdf-assets/font'] })
  sw.network.set(base + '_next/static/chunks/a.js', response('a'))
  await sw.dispatch('message', { data: 'PREPARE_OFFLINE' })
  assert.equal(sw.messages.at(-1).state, 'incomplete')
  assert.equal(await (await sw.caches.open(cacheName)).match('./__offline_ready__'), undefined)
  sw.network.set(base + 'pdf-assets/font', response('font'))
  await sw.dispatch('message', { data: 'PREPARE_OFFLINE' })
  assert.equal(sw.messages.at(-1).state, 'ready')
  assert.equal(sw.hits.filter((url) => url.endsWith('/_next/static/chunks/a.js')).length, 1)
  assert.equal(
    await (await (await sw.caches.open(cacheName)).match('./__offline_ready__')).text(),
    'ready',
  )
})

test('a failed core install does not replace the working service worker', async () => {
  const sw = worker({ core: ['/tools/index.html', './_next/static/chunks/main.js'] })
  sw.network.set(base + 'index.html', response('index'))
  await assert.rejects(sw.dispatch('install'))
  assert.equal(sw.skipped(), false)
})
