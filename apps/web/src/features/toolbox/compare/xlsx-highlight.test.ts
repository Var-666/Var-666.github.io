import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { unzipSync, strFromU8 } from 'fflate'
import { matricesToExcelFile } from '../files/file-excel'
import { highlightDiffWorkbook } from './xlsx-highlight'

test('diff export fills real added/deleted/old/new cells without changing values or header styles', async () => {
  const original = await matricesToExcelFile(
    [
      {
        name: '新增记录',
        rows: [
          ['id', 'value'],
          ['001', '=kept as text'],
        ],
      },
      {
        name: '删除记录',
        rows: [
          ['id', 'value'],
          ['002', '中文'],
        ],
      },
      {
        name: '修改明细',
        rows: [
          ['主键', '变化列', '旧值', '新值'],
          ['003', '数量', '1', '2'],
        ],
      },
    ],
    'diff',
  )
  const output = await highlightDiffWorkbook(original)
  const files = unzipSync(new Uint8Array(await output.blob.arrayBuffer()))
  const styles = strFromU8(files['xl/styles.xml'])
  assert.match(styles, /FFFCE4E4/)
  assert.match(styles, /FFE2F0D9/)
  const added = strFromU8(files['xl/worksheets/sheet1.xml']),
    removed = strFromU8(files['xl/worksheets/sheet2.xml']),
    changed = strFromU8(files['xl/worksheets/sheet3.xml'])
  const fillStyle = (xml: string, cell: string) =>
    Number(xml.match(new RegExp('<c[^>]*r="' + cell + '"[^>]*s="(\\d+)"'))?.[1])
  assert.ok(fillStyle(added, 'A2') > 0)
  assert.notEqual(fillStyle(added, 'A2'), fillStyle(removed, 'A2'))
  assert.equal(fillStyle(changed, 'C2'), fillStyle(removed, 'A2'))
  assert.equal(fillStyle(changed, 'D2'), fillStyle(added, 'A2'))
  assert.ok(!/<c[^>]*r="A1"[^>]*s="[1-9]/.test(added))
  const workbook = XLSX.read(await output.blob.arrayBuffer(), { type: 'array', cellStyles: true })
  assert.equal(workbook.Sheets[workbook.SheetNames[0]].A2.v, '001')
  assert.equal(workbook.Sheets[workbook.SheetNames[0]].B2.v, '=kept as text')
  assert.equal(workbook.Sheets[workbook.SheetNames[0]].B2.t, 's')
  assert.equal(workbook.Sheets[workbook.SheetNames[0]].B2.f, undefined)
  assert.equal(workbook.Sheets[workbook.SheetNames[1]].B2.v, '中文')
  assert.equal(workbook.Sheets[workbook.SheetNames[2]].D2.v, '2')
})
