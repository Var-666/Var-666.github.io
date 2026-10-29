import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const directory = resolve(process.argv[2] ?? 'apps/web/out')
const portIndex = process.argv.indexOf('--port')
const port = portIndex < 0 ? 4173 : Number(process.argv[portIndex + 1])
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end()
    return
  }
  let path
  try {
    path = resolve(
      directory,
      '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname),
    )
  } catch {
    response.writeHead(400).end()
    return
  }
  if (path !== directory && !path.startsWith(directory + sep)) {
    response.writeHead(403).end()
    return
  }
  try {
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html')
    const bytes = await readFile(path)
    response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
    response.end(request.method === 'HEAD' ? undefined : bytes)
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500).end()
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Static preview: http://127.0.0.1:${server.address().port}`)
})
