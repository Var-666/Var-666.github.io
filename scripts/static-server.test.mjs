import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

test('static preview serves Next.js HTML and WASM, rejects malformed paths and missing files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'var-preview-'))
  writeFileSync(join(directory, 'index.html'), '<h1>VAR</h1>')
  writeFileSync(join(directory, 'test.wasm'), 'wasm')
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('./serve-static.mjs', import.meta.url)),
    directory,
    '--port',
    '0',
  ])
  try {
    const [message] = await once(child.stdout, 'data')
    const url = message.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0]
    const index = await fetch(url)
    assert.equal(index.status, 200)
    assert.equal(await index.text(), '<h1>VAR</h1>')
    assert.equal((await fetch(url + '/test.wasm')).headers.get('content-type'), 'application/wasm')
    assert.equal((await fetch(url + '/missing.js')).status, 404)
    assert.equal((await fetch(url + '/%')).status, 400)
    assert.equal((await fetch(url + '/..%2foutside')).status, 403)
    assert.equal((await fetch(url, { method: 'POST' })).status, 405)
  } finally {
    child.kill()
    await once(child, 'exit')
    rmSync(directory, { recursive: true, force: true })
  }
})
