import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

test('vendored SheetJS is the original pinned official archive and installs without a CDN URL', () => {
  const lock = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8')
  const manifest = JSON.parse(
    readFileSync(new URL('../apps/web/package.json', import.meta.url), 'utf8'),
  )
  const bytes = readFileSync(new URL('../apps/web/vendor/xlsx-0.20.3.tgz', import.meta.url))
  const original =
    'sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA=='
  assert.equal(manifest.dependencies.xlsx, 'file:vendor/xlsx-0.20.3.tgz')
  assert.ok(lock.includes(original))
  assert.ok(lock.includes('file:apps/web/vendor/xlsx-0.20.3.tgz'))
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), original)
})
