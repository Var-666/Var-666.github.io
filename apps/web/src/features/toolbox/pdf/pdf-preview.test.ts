import test from 'node:test'
import assert from 'node:assert/strict'
import { previewLayout } from './pdf-preview'

test('fit preview retains portrait and rotated landscape aspect ratio within the visible area', () => {
  for (const [width, height] of [
    [595, 842],
    [842, 595],
  ]) {
    const layout = previewLayout(width, height, 700, 600, null, 2)
    assert.ok(layout.cssWidth <= 668 && layout.cssHeight <= 568)
    assert.ok(Math.abs(layout.cssWidth / layout.cssHeight - width / height) < 0.003)
    assert.ok(layout.width <= layout.cssWidth * 2)
    assert.ok(layout.renderScale * width <= layout.width + 0.000001)
    assert.ok(layout.renderScale * height <= layout.height + 0.000001)
  }
})
test('zoom changes display size and caps high density canvas memory', () => {
  const normal = previewLayout(595, 842, 700, 600, 1, 2)
  const zoomed = previewLayout(595, 842, 700, 600, 4, 3)
  assert.equal(normal.cssWidth, 595)
  assert.equal(zoomed.cssWidth, 2380)
  assert.ok(zoomed.width * zoomed.height <= 12_000_000)
  assert.ok(zoomed.width <= 8192 && zoomed.height <= 8192)
  const huge = previewLayout(100000, 100000, 300, 500, 4, 2)
  assert.ok(huge.cssWidth <= 16384 && huge.width * huge.height <= 12_000_000)
  assert.equal(huge.scale, huge.maxScale)
})
test('preview rejects invalid dimensions instead of allocating an invalid canvas', () => {
  for (const width of [0, -1, Infinity, NaN])
    assert.throws(() => previewLayout(width, 842, 700, 600, null, 1))
})
