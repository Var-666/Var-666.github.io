import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { readTable, workbookTable, validateInputTables } from '../table-tool/input'
import { tableLimits } from './table-process'

test('batch table imports actual XLSX display values and lets each workbook select its sheet', async () => {
  const book = XLSX.utils.book_new(),
    sheet = XLSX.utils.aoa_to_sheet([
      ['编号', '部门'],
      [7, '研发'],
    ])
  sheet.A2.z = '00000'
  XLSX.utils.book_append_sheet(book, sheet, '明细')
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['编号', '部门'],
      ['009', '销售'],
    ]),
    '汇总',
  )
  const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  const input = await readTable(new File([bytes], 'data.xlsx'), 'utf-8')
  assert.deepEqual(input.rows, [['00007', '研发']])
  assert.equal(input.encoding, undefined)
  const selected = workbookTable(input.file, input.workbook!, '汇总', input.expandedBytes, input.id)
  assert.equal(selected.id, input.id)
  assert.deepEqual(selected.rows, [['009', '销售']])
  assert.deepEqual(input.rows, [['00007', '研发']])
})

test('batch CSV limit increases to 10 MB while other text converters keep their default', async () => {
  const content = '编号,备注\n001,' + 'x'.repeat(2_100_000)
  const input = await readTable(new File([content], 'large.csv'), 'auto')
  assert.equal(input.rows[0][0], '001')
  assert.equal(input.rows[0][1].length, 2_100_000)
  await assert.rejects(
    readTable(new File([new Uint8Array(tableLimits.maxFileBytes + 1)], 'too-large.csv'), 'auto'),
    /10 MB/,
  )
  await assert.rejects(readTable(new File(['data'], 'old.xls'), 'auto'), /CSV 或 XLSX/)
})

test('duplicate/blank table headers receive stable names and notices instead of ambiguous column operations', async () => {
  const input = await readTable(new File(['编号,编号,\n001,002,值'], 'headers.csv'), 'auto')
  assert.deepEqual(input.headers, ['编号', '编号(2)', '列3'])
  assert.deepEqual(input.rows, [['001', '002', '值']])
  assert.ok(input.notices.some((notice) => notice.includes('重复表头')))
  assert.ok(input.notices.some((notice) => notice.includes('空表头')))
})

test('oversized headers are refused before they enter selectors and preview DOM', async () => {
  await assert.rejects(
    readTable(new File(['x'.repeat(513) + '\n001'], 'header.csv'), 'auto'),
    /512 字符/,
  )
})

test('batch input rows/cells and workbook expansion have aggregate limits', async () => {
  const base = await readTable(new File(['a,b,c,d,e,f\n1,2,3,4,5,6'], 'a.csv'), 'auto')
  assert.throws(
    () => validateInputTables([{ ...base, rows: Array(200001).fill(['x']) }]),
    /20 万行/,
  )
  const wide = { ...base, rows: Array(100000).fill(['1', '2', '3', '4', '5', '6']) }
  assert.throws(() => validateInputTables([wide, wide]), /100 万格/)
  assert.throws(
    () => validateInputTables([{ ...base, expandedBytes: 256 * 1024 * 1024 + 1 }]),
    /256 MB/,
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['id'], ['001']]), 'a')
  const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'a.xlsx')
  await assert.rejects(readTable(file, 'auto', undefined, 1), /本批 XLSX 解压总量/)
})

test('10 MB byte boundary accepts multibyte UTF-8 while character limit remains independent', async () => {
  const chars = Math.floor((tableLimits.maxFileBytes - 2) / 3)
  const body = '中'.repeat(chars) + 'x'.repeat(tableLimits.maxFileBytes - 2 - chars * 3)
  const file = new File(['a\n', body], 'exact.csv')
  assert.equal(file.size, tableLimits.maxFileBytes)
  assert.equal((await readTable(file, 'auto')).rows[0][0].length, body.length)
  await assert.rejects(
    readTable(new File(['a\n', 'x'.repeat(10_000_000)], 'chars.csv'), 'auto'),
    /1000 万/,
  )
})
