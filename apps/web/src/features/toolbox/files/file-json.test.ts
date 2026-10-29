import test from 'node:test'
import assert from 'node:assert/strict'
import Papa from 'papaparse'
import { jsonToCsv } from './file-json'
import { identifyFile, intakeTasks, prepareTransfer } from '../file-intake'

const matrix = (text: string) => Papa.parse<string[]>(text).data

test('nested JSON paths stay unambiguous and arrays/empty values retain their data', () => {
  const converted = jsonToCsv(
    '[{"user":{"name":"小王","id":"001"},"user.name":"literal","arr":[{"x":1},2],"empty":{},"nil":null,"__proto__":"safe","back\\\\key":{"x":"=1+1"}},{"user":{"name":"乙"},"toString":"own"}]',
  )
  assert.deepEqual(matrix(converted.text), [
    [
      'user.name',
      'user.id',
      'user\\.name',
      'arr',
      'empty',
      'nil',
      '__proto__',
      'back\\\\key.x',
      'toString',
    ],
    ['小王', '001', 'literal', '[{"x":1},2]', '{}', '', 'safe', "'=1+1", ''],
    ['乙', '', '', '', '', '', '', '', 'own'],
  ])
  assert.equal(converted.notices.length, 2)
})

test('JSON Lines preserves record order, skips whitespace, accepts BOM and identifies bad line', () => {
  const result = jsonToCsv(
    '\uFEFF{"编号":"001","user":{"name":"甲"}}\r\n\r\n{"编号":"002","x":"a,b"}\n',
    true,
  )
  assert.deepEqual(matrix(result.text), [
    ['编号', 'user.name', 'x'],
    ['001', '甲', ''],
    ['002', '', 'a,b'],
  ])
  assert.match(result.notices[0], /2 条/)
  assert.deepEqual(matrix(jsonToCsv('{"a":1}', true).text), [['a'], ['1']])
  assert.throws(() => jsonToCsv('{"a":1}\n\n{bad}', true), /第 3 行格式/)
  assert.throws(() => jsonToCsv('{"a":1}\n[]', true), /第 2 行需要是一个对象/)
  assert.throws(() => jsonToCsv('\n', true), /非空/)
})

test('nested unsafe integers, non-finite values and expansion resource limits are rejected', () => {
  for (const source of [
    '[{"a":{"b":9007199254740993}}]',
    '[{"a":[9007199254740993]}]',
    '[{"a":1e309}]',
  ])
    assert.throws(() => jsonToCsv(source), /精度|数值范围/)
  let deep: unknown = 1
  for (let i = 0; i < 34; i++) deep = { a: deep }
  assert.throws(() => jsonToCsv(JSON.stringify([deep])), /32 层/)
  const wide = Object.fromEntries(Array.from({ length: 1025 }, (_, i) => ['c' + i, i]))
  assert.throws(() => jsonToCsv(JSON.stringify([wide])), /1024 列/)
  assert.throws(() => jsonToCsv(JSON.stringify(Array(100_001).fill({ a: 1 }))), /10 万/)
  const cells = [{}, ...Array.from({ length: 1000 }, () => ({}))]
  cells[0] = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ['c' + i, '']))
  assert.throws(() => jsonToCsv(JSON.stringify(cells)), /100 万/)
})

test('global intake preserves JSON Lines suffix so conversion uses the line parser', async () => {
  for (const extension of ['jsonl', 'ndjson']) {
    const entry = await identifyFile(new File(['{"id":"001"}\n{"id":"002"}'], 'logs.' + extension))
    assert.equal(entry.kind, 'json')
    const task = intakeTasks([entry]).find((task) => task.mode === 'json-csv')!
    assert.equal(prepareTransfer(task, [entry]).files![0].name, 'logs.' + extension)
  }
})
