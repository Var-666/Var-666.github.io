import test from 'node:test'
import assert from 'node:assert/strict'
import { filesToShare, outputParts, saveToDirectory } from './output-save'
import type { OutputFile } from './file-convert'
import { packOutputs } from './file-media'

const output = (name: string, content = name): OutputFile => ({
  name,
  blob: new Blob([content], { type: 'text/plain' }),
})
function directory(initial: Record<string, string> = {}, fail = '') {
  const files = new Map(Object.entries(initial)),
    created: string[] = [],
    aborted: string[] = []
  const handle = {
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (files.get(name) === '<directory>') throw new DOMException('folder', 'TypeMismatchError')
      if (!files.has(name) && !options?.create) throw new DOMException('missing', 'NotFoundError')
      if (options?.create && !files.has(name)) {
        files.set(name, '')
        created.push(name)
      }
      return {
        async createWritable() {
          let value = ''
          return {
            async write(blob: Blob) {
              if (name === fail) throw new DOMException('disk full', 'QuotaExceededError')
              value = await blob.text()
            },
            async close() {
              files.set(name, value)
            },
            async abort() {
              aborted.push(name)
            },
          }
        },
      }
    },
  } as unknown as FileSystemDirectoryHandle
  return { handle, files, created, aborted }
}

test('batch folder save preserves existing files/folders and avoids input/Unicode/case collisions', async () => {
  const memory = directory({ 'a.txt': 'original', 'a (2).txt': '<directory>' })
  const progress: string[] = []
  const names = await saveToDirectory(
    memory.handle,
    [
      output('a.txt', 'first'),
      output('a.txt', 'second'),
      output('A.TXT', 'third'),
      output('é.txt', 'NFC'),
      output('e\u0301.txt', 'NFD'),
    ],
    (done, total) => progress.push(`${done}/${total}`),
  )
  assert.deepEqual(names, ['a (3).txt', 'a (4).txt', 'A (5).TXT', 'é.txt', 'e\u0301 (2).txt'])
  assert.equal(memory.files.get('a.txt'), 'original')
  assert.equal(memory.files.get('a (2).txt'), '<directory>')
  assert.equal(memory.files.get('a (3).txt'), 'first')
  assert.equal(memory.files.get('a (4).txt'), 'second')
  assert.equal(progress.at(-1), '5/5')
})

test('ZIP outputs expose original named pieces without unzipping or changing bytes', async () => {
  const parts = [output('page-1.txt', '001'), output('page-2.txt', '中文')]
  const zip = await packOutputs(parts, 'all.zip')
  assert.deepEqual(outputParts([zip]), parts)
  const memory = directory()
  await saveToDirectory(memory.handle, [zip])
  assert.deepEqual(
    [...memory.files],
    [
      ['page-1.txt', '001'],
      ['page-2.txt', '中文'],
    ],
  )
})

test('save stops on partial failure, aborts the failed stream and reports preserved progress', async () => {
  const memory = directory({}, 'b.txt')
  await assert.rejects(
    saveToDirectory(memory.handle, [output('a.txt'), output('b.txt'), output('c.txt')]),
    /已保存 1\/3.*disk full/,
  )
  assert.equal(memory.files.get('a.txt'), 'a.txt')
  assert.equal(memory.files.has('c.txt'), false)
  assert.deepEqual(memory.aborted, ['b.txt'])
})

test('folder limits and unsafe file paths are validated before any file is created', async () => {
  const memory = directory()
  for (const name of ['../a', 'a/b', 'a\\b', '..', 'a\u0000.txt'])
    await assert.rejects(saveToDirectory(memory.handle, [output(name)]), /文件名/)
  await assert.rejects(saveToDirectory(memory.handle, []), /1000/)
  await assert.rejects(saveToDirectory(memory.handle, Array(1001).fill(output('a'))), /1000/)
  await assert.rejects(
    saveToDirectory(memory.handle, [{ name: 'big', blob: { size: 101 * 1024 * 1024 } as Blob }]),
    /100 MB/,
  )
  assert.deepEqual(memory.created, [])
})

test('file sharing checks actual file capabilities, preserves bytes and treats rejection as unsupported', async () => {
  const outputs = [output('中文.txt', '001中文')]
  const browser = {
    share: async () => {},
    canShare: (value: ShareData) => value.files?.[0].type === 'text/plain',
  }
  const files = filesToShare(outputs, browser)!
  assert.equal(files[0].name, '中文.txt')
  assert.equal(await files[0].text(), '001中文')
  assert.equal(filesToShare(outputs, { ...browser, canShare: () => false }), null)
  assert.equal(
    filesToShare(outputs, {
      ...browser,
      canShare: () => {
        throw new Error('unsupported')
      },
    }),
    null,
  )
  assert.equal(filesToShare([], browser), null)
})
