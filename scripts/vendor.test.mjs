import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

test('vendored SheetJS is the original pinned official archive and installs without a CDN URL', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
  const dependency = lock.packages['node_modules/xlsx']
  const bytes = readFileSync(new URL('../vendor/xlsx-0.20.3.tgz', import.meta.url))
  const original =
    'sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA=='
  assert.equal(dependency.version, '0.20.3')
  assert.equal(dependency.resolved, 'file:vendor/xlsx-0.20.3.tgz')
  assert.equal(dependency.integrity, original)
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), original)
})
