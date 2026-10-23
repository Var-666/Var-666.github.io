import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync } from 'fflate'
import { packOutputs } from './file-media'

test('multi-page and multi-table export packs every named output without altering bytes', async () => {
  const output = await packOutputs(
    [
      { name: '表.page-1.png', blob: new Blob([new Uint8Array([137, 80, 78, 71])]) },
      { name: '表.table-1.csv', blob: new Blob(['\uFEFF编号\r\n001']) },
    ],
    'result.zip',
  )
  assert.equal(output.name, 'result.zip')
  assert.equal(output.blob.type, 'application/zip')
  const files = unzipSync(new Uint8Array(await output.blob.arrayBuffer()))
  assert.deepEqual([...files['表.page-1.png']], [137, 80, 78, 71])
  assert.deepEqual(files['表.table-1.csv'], new TextEncoder().encode('\uFEFF编号\r\n001'))
})
test('archive rejects oversized output before reading its bytes', async () => {
  const blob = { size: 101 * 1024 * 1024 } as Blob
  await assert.rejects(packOutputs([{ name: 'big.png', blob }], 'big.zip'), /100 MB/)
})

test('reserved object key cannot silently disappear from the archive', async () => {
  await assert.rejects(
    packOutputs([{ name: '__proto__', blob: new Blob(['content']) }], 'renamed.zip'),
    /文件名/,
  )
})
