import test from 'node:test'
import assert from 'node:assert/strict'
import Papa from 'papaparse'
import { convertFileText, markdownTables } from './file-text'

test('CSV preserves quoted commas, newlines, quotes and leading zeroes', () => {
  assert.deepEqual(
    JSON.parse(
      convertFileText(
        '\uFEFF姓名,备注,编号\r\n小王,"第一行\n第二行,含逗号和""引号""",001',
        'csv-json',
      ),
    ),
    [{ 姓名: '小王', 备注: '第一行\n第二行,含逗号和"引号"', 编号: '001' }],
  )
})
test('CSV rejects duplicate headers and inconsistent rows', () => {
  assert.throws(() => convertFileText('a,a\n1,2', 'csv-json'), /重复/)
  assert.throws(() => convertFileText('a,b\n1', 'csv-json'), /列数/)
  assert.throws(() => convertFileText('a,\n1,2', 'csv-json'), /列名/)
})
test('JSON uses union of fields, quotes strings and protects spreadsheet formulas', () => {
  assert.equal(
    convertFileText('[{"a":"=1+1","b":"001"},{"c":"x,y"}]', 'json-csv'),
    'a,b,c\r\n"\'=1+1",001,\r\n,,"x,y"',
  )
})
test('JSON rejects invalid shapes and nested values', () => {
  for (const input of ['{', '{}', '[]', '[1]', '[{"a":{}}]'])
    assert.throws(() => convertFileText(input, 'json-csv'))
})
test('Markdown export keeps content and strips formatting', () => {
  assert.equal(convertFileText('# 标题\n\n**正文**', 'markdown'), '标题\n\n正文')
})

test('JSON does not export inherited values for missing fields and rejects unsafe integers', () => {
  assert.equal(
    convertFileText('[{"toString":"value"},{"other":"ok"}]', 'json-csv'),
    'toString,other\r\nvalue,\r\n,ok',
  )
  assert.throws(() => convertFileText('[{"id":9007199254740993}]', 'json-csv'), /精度/)
})

test('CSV and Excel TSV become Markdown with literal formatting and multiline cells preserved', () => {
  const source = '姓名\t备注\t编号\r\n小王\t"**原文** | <img> & `code`\n第二行"\t001'
  const result = convertFileText(source, 'csv-markdown', '\t')
  assert.match(result, /^\| 姓名 \| 备注 \| 编号 \|\n\| --- \| --- \| --- \|/)
  const rows = Papa.parse<string[]>(markdownTables(result)[0]).data
  assert.deepEqual(rows, [
    ['姓名', '备注', '编号'],
    ['小王', '**原文** | <img> & `code`\n第二行', '001'],
  ])
  assert.throws(() => convertFileText('a,b\n1', 'csv-markdown'), /列数/)
})
test('Markdown extracts all real tables including nested tables but ignores fenced code', () => {
  const result = markdownTables(
    '```md\n| fake |\n| --- |\n```\n\n| a | b |\n| --- | --- |\n| **bold** | =1+1 |\n\n> | 姓名 |\n> | --- |\n> | 小王 |',
  )
  assert.equal(result.length, 2)
  assert.deepEqual(Papa.parse<string[]>(result[0]).data, [
    ['a', 'b'],
    ['bold', "'=1+1"],
  ])
  assert.deepEqual(Papa.parse<string[]>(result[1]).data, [['姓名'], ['小王']])
  assert.throws(() => markdownTables('# no table'), /没有找到/)
})

test('CSV headers with literal tabs and one-column tables use the declared delimiter', () => {
  const result = convertFileText('"a\tb",c\n001,002', 'csv-markdown')
  assert.deepEqual(Papa.parse<string[]>(markdownTables(result)[0]).data, [
    ['a\tb', 'c'],
    ['001', '002'],
  ])
  assert.equal(convertFileText('编号\n001', 'csv-markdown'), '| 编号 |\n| --- |\n| 001 |')
  assert.throws(() => convertFileText('', 'csv-markdown'), /不能为空/)
})
