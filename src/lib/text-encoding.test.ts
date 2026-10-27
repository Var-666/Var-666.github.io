import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeText, readTextFile } from './text-encoding'

const gbk = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]).buffer // 中文

test('UTF-8 is preferred, including BOM; legacy Chinese is decoded without replacement characters', async () => {
  assert.deepEqual(decodeText(new TextEncoder().encode('\uFEFF中文001').buffer), {
    text: '中文001',
    encoding: 'UTF-8',
  })
  assert.deepEqual(decodeText(gbk), { text: '中文', encoding: 'GBK / GB18030' })
  assert.equal(decodeText(new Uint8Array([0x95, 0x32, 0x82, 0x36]).buffer).text, '𠀀')
  assert.equal((await readTextFile(new File([gbk], 'legacy.txt'))).text, '中文')
})

test('manual encoding is honored; invalid, binary and UTF-16 input are rejected', () => {
  assert.throws(() => decodeText(gbk, 'utf-8'), /无法按 UTF-8/)
  assert.equal(decodeText(gbk, 'gb18030').text, '中文')
  for (const bytes of [[0xff], [0xff, 0xfe, 0x00], [65, 0, 66, 0]])
    assert.throws(() => decodeText(new Uint8Array(bytes).buffer), /无法按/)
})
