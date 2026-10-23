import test from 'node:test'
import assert from 'node:assert/strict'
import { findWhitespaceCut } from './page-break'

function band(rows: string[]) {
  const pixels = new Uint8ClampedArray(rows.length * 4 * 4).fill(255)
  rows.forEach((row, y) => {
    if (row === 'ink') pixels[(y * 4 + 2) * 4] = 0
  })
  return pixels
}
test('page cut moves above text to the nearest two blank scanlines', () => {
  assert.equal(
    findWhitespaceCut(band(['white', 'white', 'ink', 'white', 'white', 'ink', 'ink']), 4, 7),
    4,
  )
})
test('a single empty scanline inside a glyph does not count as a line gap', () => {
  assert.equal(findWhitespaceCut(band(['ink', 'white', 'ink']), 4, 3), null)
})
test('solid images fall back to a fixed cut; white and transparent bands allow a cut', () => {
  assert.equal(findWhitespaceCut(band(['ink', 'ink', 'ink']), 4, 3), null)
  assert.equal(findWhitespaceCut(band(['white', 'white', 'white']), 4, 3), 2)
  assert.equal(findWhitespaceCut(new Uint8ClampedArray(4 * 4 * 3), 4, 3), 2)
})
