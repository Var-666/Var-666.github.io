import test from 'node:test'
import assert from 'node:assert/strict'
import { imageDimensions, pdfPageNumbers } from './media-options'

test('image sizing preserves aspect ratio, avoids upscaling and retains at least one pixel', () => {
  assert.deepEqual(imageDimensions(3840, 2160, '1920'), { width: 1920, height: 1080 })
  assert.deepEqual(imageDimensions(640, 480, '1280'), { width: 640, height: 480 })
  assert.deepEqual(imageDimensions(100, 200, 'half'), { width: 50, height: 100 })
  assert.deepEqual(imageDimensions(1, 1, 'half'), { width: 1, height: 1 })
  assert.deepEqual(imageDimensions(90, 80, 'original'), { width: 90, height: 80 })
})
test('PDF page ranges deduplicate and retain document order', () => {
  assert.deepEqual(pdfPageNumbers('', 3), [1, 2, 3])
  assert.deepEqual(pdfPageNumbers('3,1-2,2， 5', 5), [1, 2, 3, 5])
})
test('PDF page ranges reject malformed, descending and out of bounds ranges before rendering', () => {
  for (const value of ['0', '1-6', '4-2', '2.5', '1,,2', 'a', '1-', '999999999999999999']) {
    assert.throws(() => pdfPageNumbers(value, 5))
  }
})
