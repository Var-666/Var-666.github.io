import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const directory = resolve(process.argv[2] ?? 'dist')
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
const files = walk(directory)
  .filter((file) => relative(directory, file) !== 'sw.js')
  .sort()
const hash = createHash('sha256')
for (const file of files) hash.update(relative(directory, file)).update(readFileSync(file))
const version = hash.digest('hex').slice(0, 16)
const manifest = files.map((file) => './' + relative(directory, file).split('\\').join('/'))
const html = readFileSync(join(directory, 'index.html'), 'utf8')
const core = [
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  ...Array.from(
    html.matchAll(/(?:src|href)="([^"?]*\/assets\/[^"?]+)"/g),
    (match) => './assets/' + match[1].split('/assets/')[1],
  ),
]
const template = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
writeFileSync(
  join(directory, 'sw.js'),
  template
    .replace('__BUILD_VERSION__', version)
    .replace('/* CORE_ASSETS */ []', JSON.stringify([...new Set(core)]))
    .replace('/* ALL_ASSETS */ []', JSON.stringify(manifest)),
)
console.log(`Offline build ${version}: ${manifest.length} local files`)
