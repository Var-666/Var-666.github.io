import test from 'node:test'
import assert from 'node:assert/strict'
import { validateQueueFiles } from './file-queue'

const file = (name = 'image.png', size = 100) => ({ name, size }) as File
test('append validation counts the existing queue without mutating it', () => {
  const existing = Array.from({ length: 9 }, () => file())
  assert.doesNotThrow(() => validateQueueFiles(existing, [file('new.PNG')], '.png,.jpg', 20))
  assert.throws(() => validateQueueFiles(existing, [file(), file()], '.png', 20), /10/)
  assert.equal(existing.length, 9)
})
test('append validation enforces total bytes, individual size, extension and nonempty input', () => {
  assert.throws(
    () =>
      validateQueueFiles(
        [file('a.png', 40 * 1024 * 1024)],
        [file('b.png', 11 * 1024 * 1024)],
        '.png',
        20,
      ),
    /50 MB/,
  )
  assert.throws(
    () => validateQueueFiles([], [file('a.png', 21 * 1024 * 1024)], '.png', 20),
    /20 MB/,
  )
  assert.throws(() => validateQueueFiles([], [file('a.pdf')], '.png', 20), /请选择/)
  assert.throws(() => validateQueueFiles([], [file('a.png', 0)], '.png', 20), /不能为空/)
})
