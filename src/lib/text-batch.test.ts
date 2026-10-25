import test from 'node:test'
import assert from 'node:assert/strict'
import {
  batchTextLimits,
  batchTextOutputName,
  processBatchTextFiles,
  validateBatchTextFiles,
} from './text-batch'
import { baseOptions, type Options } from './text'

const options: Options = { ...baseOptions, collapseSpaces: true, blankLines: 'remove' }

const makeFile = (name: string, content: string | Uint8Array) => {
  const bytes =
    typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content)
  return new File([bytes], name)
}

test('批量处理：逐文件应用规则，输出名与统计正确', async () => {
  const files = [makeFile('甲.txt', '你好  世界\n\n\n\n尾行'), makeFile('乙.md', '单行  文本')]
  const states: string[] = []
  const summary = await processBatchTextFiles(files, options, {
    onStart: (id) => states.push(`${id}:working`),
    onDone: (id, result) => {
      states.push(`${id}:done`)
      assert.ok(result.text.length > 0)
    },
    onError: () => states.push('unexpected'),
  })
  assert.deepEqual(summary, { done: 2, failed: 0 })
  assert.deepEqual(states, ['batch-0:working', 'batch-0:done', 'batch-1:working', 'batch-1:done'])
  // 规则生效：双空格折叠、空行移除
  assert.equal(states.length, 4)
  assert.equal(batchTextOutputName('目录/日报 2026.txt'), '日报 2026-整理.txt')
  assert.equal(batchTextOutputName('无扩展名'), '无扩展名-整理.txt')
})

test('单文件错误隔离：坏编码与超大文件报错，其余照常完成', async () => {
  const files = [
    makeFile('坏.bin', new Uint8Array([0xff, 0xfe, 0x00])),
    makeFile('好.txt', '正文  内容'),
    makeFile('大.txt', 'x'.repeat(batchTextLimits.maxFileBytes + 1)),
  ]
  const errors: string[] = []
  const summary = await processBatchTextFiles(files, options, {
    onStart: () => undefined,
    onDone: (_id, result) => errors.push(`ok:${result.text}`),
    onError: (id, message) => errors.push(`${id}:${message}`),
  })
  assert.deepEqual(summary, { done: 1, failed: 2 })
  assert.match(errors[0], /batch-0:读取失败，请使用 UTF-8 编码。/)
  assert.match(errors[1], /^ok:/)
  assert.match(errors[2], /batch-2:单个文件不超过 2 MB。/)
})

test('数量与总量限制在入队前拦截', () => {
  assert.throws(
    () =>
      validateBatchTextFiles(18, [
        makeFile('a.txt', ''),
        makeFile('b.txt', ''),
        makeFile('c.txt', ''),
      ]),
    /最多处理 20 个/,
  )
  assert.throws(
    () => validateBatchTextFiles(0, [makeFile('a.txt', 'x'.repeat(21 * 1024 * 1024))]),
    /20 MB/,
  )
  assert.doesNotThrow(() => validateBatchTextFiles(19, [makeFile('a.txt', '')]))
})
