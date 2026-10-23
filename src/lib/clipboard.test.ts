import test from 'node:test'
import assert from 'node:assert/strict'
import { clipboardWithTimeout } from './clipboard'
test('clipboard access returns the successful result', async () => {
  assert.equal(await clipboardWithTimeout(() => Promise.resolve('文本')), '文本')
})
test('clipboard permission rejection reaches the fallback', async () => {
  const error = new Error('permission denied')
  await assert.rejects(
    clipboardWithTimeout(() => Promise.reject(error)),
    (value) => value === error,
  )
})
test('unanswered clipboard permission eventually reaches the fallback', async () => {
  await assert.rejects(
    clipboardWithTimeout(() => new Promise(() => {}), 10),
    /clipboard timed out/,
  )
})
