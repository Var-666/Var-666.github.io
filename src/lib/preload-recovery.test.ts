import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimPreloadReload } from './preload-recovery'

test('preload recovery reloads only once, online and before any interaction', () => {
  const saved = new Map<string, string>()
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value)
    },
  }
  assert.equal(claimPreloadReload(storage, false, false), false)
  assert.equal(claimPreloadReload(storage, true, true), false)
  assert.equal(claimPreloadReload(storage, true, false), true)
  assert.equal(claimPreloadReload(storage, true, false), false)
  assert.equal(
    claimPreloadReload(
      {
        ...storage,
        getItem: () => {
          throw new Error('blocked')
        },
      },
      true,
      false,
    ),
    false,
  )
})
