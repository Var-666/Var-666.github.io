import test from 'node:test'
import assert from 'node:assert/strict'
import { readThemePreference } from './theme'

test('explicit theme is retained; missing, invalid or inaccessible storage follows the system', () => {
  assert.equal(
    readThemePreference(() => 'dark'),
    true,
  )
  assert.equal(
    readThemePreference(() => 'light'),
    false,
  )
  assert.equal(
    readThemePreference(() => null),
    null,
  )
  assert.equal(
    readThemePreference(() => 'invalid'),
    null,
  )
  assert.equal(
    readThemePreference(() => {
      throw new Error('denied')
    }),
    null,
  )
})
