import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const directory = resolve(process.argv[2] ?? 'apps/web/out')
// Workers must belong to /tools/ to inherit its scoped offline controller.
const chunks = join(directory, '_next/static/chunks')
const workerDirectory = join(directory, 'tools/_next/static/chunks')
mkdirSync(workerDirectory, { recursive: true })
for (const name of readdirSync(chunks)) {
  if (/\.worker\.[^.]+\.js$/.test(name)) renameSync(join(chunks, name), join(workerDirectory, name))
}
const walk = (path) =>
  readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const file = join(path, entry.name)
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : []
  })
const sitemap = join(directory, 'sitemap.xml')
const date = new Date().toISOString().slice(0, 10)
writeFileSync(
  sitemap,
  readFileSync(sitemap, 'utf8').replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${date}</lastmod>`),
)
// Static Next.js bootstrapping uses inline scripts; authorize their exact contents per build.
for (const file of walk(directory).filter((file) => file.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8').replace(
    /<meta http-equiv="Content-Security-Policy"[^>]*>/g,
    '',
  )
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((match) => !/\bsrc=/.test(match[1]))
    .map((match) => "'sha256-" + createHash('sha256').update(match[2]).digest('base64') + "'")
  const policy =
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' " +
    [...new Set(hashes)].join(' ') +
    "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob:; worker-src 'self' blob:; child-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'"
  writeFileSync(
    file,
    html.replace(
      '<head>',
      '<head><meta http-equiv="Content-Security-Policy" content="' + policy + '">',
    ),
  )
}
const files = walk(directory)
  .filter((file) => {
    const path = relative(directory, file).split('\\').join('/')
    return (
      path !== 'tools/sw.js' &&
      (/^(?:_next\/static|tools|pdf-assets|icons|licenses)\//.test(path) ||
        ['manifest.webmanifest', 'favicon.svg', 'apple-touch-icon.png', 'og-image.png'].includes(
          path,
        ))
    )
  })
  .sort()
const hash = createHash('sha256')
for (const file of files) hash.update(relative(directory, file)).update(readFileSync(file))
const version = hash.digest('hex').slice(0, 16)
const manifest = files.map((file) => '/' + relative(directory, file).split('\\').join('/'))
const html = readFileSync(join(directory, 'tools/index.html'), 'utf8')
const core = [
  '/tools/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  ...Array.from(
    html.matchAll(/(?:src|href)="([^"?]*\/_next\/static\/[^"?]+)"/g),
    (match) => match[1],
  ),
]
const template = readFileSync(new URL('../apps/web/public/tools/sw.js', import.meta.url), 'utf8')
writeFileSync(
  join(directory, 'tools/sw.js'),
  template
    .replace('__BUILD_VERSION__', version)
    .replace('/* CORE_ASSETS */ []', JSON.stringify([...new Set(core)]))
    .replace('/* ALL_ASSETS */ []', JSON.stringify(manifest)),
)
console.log(`Offline build ${version}: ${manifest.length} local files`)
