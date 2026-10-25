import test from 'node:test'
import assert from 'node:assert/strict'
import Papa from 'papaparse'
import { zipSync } from 'fflate'
import * as XLSX from 'xlsx'
import {
  loadWorkbook,
  sheetToCsv,
  sheetToJson,
  sheetToMarkdown,
  sheetNotices,
  parseCsvMatrix,
  matrixToExcelFile,
  csvFileToExcel,
  excelLimits,
  unzipTotalSize,
} from './file-excel'
import { markdownTables } from './file-text'

type FileLike = { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }

function fileFromWorkbook(sheets: Record<string, XLSX.WorkSheet>, name = '工作簿.xlsx'): FileLike {
  const workbook = XLSX.utils.book_new()
  for (const [sheetName, sheet] of Object.entries(sheets))
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer,
  }
}

function fileFromText(text: string, name: string): FileLike {
  const bytes = Buffer.from(text, 'utf8')
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer,
  }
}

async function fileFromOutput(name: string, blob: Blob): Promise<FileLike> {
  return { name, size: blob.size, arrayBuffer: () => blob.arrayBuffer() }
}

test('读取工作簿并按名称枚举全部工作表', async () => {
  const file = fileFromWorkbook({
    名单: XLSX.utils.aoa_to_sheet([['姓名'], ['小王']]),
    汇总: XLSX.utils.aoa_to_sheet([['数值'], [42]]),
  })
  const workbook = await loadWorkbook(file)
  assert.deepEqual(
    workbook.sheets.map((sheet) => sheet.name),
    ['名单', '汇总'],
  )
  assert.deepEqual(workbook.sheet('名单').rows, [['姓名'], ['小王']])
  assert.equal(workbook.sheet('名单'), workbook.sheet('名单'), '同一工作表不重复解析')
})

test('只转换选中的工作表，内容互不混入', async () => {
  const file = fileFromWorkbook({
    一月: XLSX.utils.aoa_to_sheet([['月份'], ['一月']]),
    二月: XLSX.utils.aoa_to_sheet([['月份'], ['二月']]),
  })
  const workbook = await loadWorkbook(file)
  assert.equal(sheetToCsv(workbook.sheet('二月')), '月份\r\n二月')
})

test('XLSX → CSV 保留引号逗号换行、空单元格与统一列宽', async () => {
  const source = [
    ['姓名', '备注', '编号'],
    ['小王', '含,逗号和"引号"\n换行', '00123'],
    ['李四', '', ''],
  ]
  const workbook = await loadWorkbook(fileFromWorkbook({ 数据: XLSX.utils.aoa_to_sheet(source) }))
  const csv = sheetToCsv(workbook.sheet('数据'))
  assert.deepEqual(Papa.parse<string[]>(csv, { skipEmptyLines: false }).data, source)
})

test('XLSX → JSON 处理中文、空表头与重复表头并给出提示', async () => {
  const source = [
    ['姓名', '备注', '姓名', ''],
    ['小王', '甲', '乙', '丙'],
  ]
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: XLSX.utils.aoa_to_sheet(source) }))
  const { text, notices } = sheetToJson(workbook.sheet('表'))
  assert.deepEqual(JSON.parse(text), [{ 姓名: '小王', 备注: '甲', '姓名(2)': '乙', 列4: '丙' }])
  assert.ok(notices.some((notice) => notice.includes('空表头')))
  assert.ok(notices.some((notice) => notice.includes('重复表头')))
})

test('重复表头的序号后缀不与原始字段撞名，JSON 字段值不被覆盖', async () => {
  // 回归：旧规则对 订单号、订单号(2)、订单号 会生成两个「订单号(2)」，fromEntries 时后值覆盖前值
  const workbook = await loadWorkbook(
    fileFromWorkbook({
      表: XLSX.utils.aoa_to_sheet([
        ['订单号', '订单号(2)', '订单号'],
        ['A', 'B', 'C'],
      ]),
    }),
  )
  assert.deepEqual(JSON.parse(sheetToJson(workbook.sheet('表')).text), [
    { 订单号: 'A', '订单号(2)': 'B', '订单号(3)': 'C' },
  ])
  for (const headers of [
    ['订单号', '订单号', '订单号(2)'],
    ['列1', ''],
    ['', '', '列2'],
  ]) {
    const values = headers.map((_, index) => `v${index}`)
    const file = fileFromWorkbook({ 表: XLSX.utils.aoa_to_sheet([headers, values]) })
    const parsed = JSON.parse(sheetToJson((await loadWorkbook(file)).sheet('表')).text)
    const keys = Object.keys(parsed[0])
    assert.equal(new Set(keys).size, keys.length, `表头应唯一：${keys.join(',')}`)
    assert.deepEqual(Object.values(parsed[0]), values, `字段值应按列序保留：${headers.join(',')}`)
  }
})

test('XLSX → Markdown 复用表格转义并可无损往返', async () => {
  const source = [
    ['姓名', '备注'],
    ['小王', '**原文** | <img> & `code`\n第二行'],
  ]
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: XLSX.utils.aoa_to_sheet(source) }))
  const markdown = sheetToMarkdown(workbook.sheet('表'))
  assert.match(markdown, /^\| 姓名 \| 备注 \|/)
  assert.deepEqual(Papa.parse<string[]>(markdownTables(markdown)[0]).data, source)
})

test('数字格式渲染的前导零按显示值导出', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['编号'], ['']])
  sheet['A2'] = { t: 'n', v: 123, z: '000000' }
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: sheet }))
  assert.equal(workbook.sheet('表').rows[1][0], '000123')
})

test('超长数字字符串不会被转成科学计数法或浮点', async () => {
  const source = [
    ['订单号', '工号'],
    ['12345678901234567890', '202600012345'],
  ]
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: XLSX.utils.aoa_to_sheet(source) }))
  assert.deepEqual(workbook.sheet('表').rows, source)
})

test('日期与时间按显示值导出而不是序列号', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['日期', '时间'],
    [new Date(2026, 9, 24), 0.5],
  ])
  sheet['A2'].z = 'yyyy-mm-dd'
  sheet['B2'] = { t: 'n', v: 0.5, z: 'hh:mm' }
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: sheet }))
  assert.deepEqual(workbook.sheet('表').rows, [
    ['日期', '时间'],
    ['2026-10-24', '12:00'],
  ])
})

test('存成数值的超长编号触发精度提示', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['编号'], ['']])
  sheet['A2'] = { t: 'n', v: 2_000_000_000_000_000 }
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: sheet }))
  const data = workbook.sheet('表')
  assert.equal(data.precisionLoss, 1)
  assert.ok(sheetNotices(data).some((notice) => notice.includes('15 位有效数字')))
  assert.equal(typeof data.rows[1][0], 'string')
})

test('小于 1e15 但有效数字超过 15 位的小数同样触发精度提示', async () => {
  const source = [
    ['循环小数', '浮点和', '对照', '整数'],
    [1 / 3, 0.1 + 0.2, 0.1, 123456789012345],
  ]
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: XLSX.utils.aoa_to_sheet(source) }))
  const data = workbook.sheet('表')
  assert.equal(data.precisionLoss, 2)
  // 导出遵循「显示值优先」：高精度数值按 General 渲染截短，原始数字无法恢复
  assert.equal(data.rows[1][0], '0.333333333')
  assert.equal(data.rows[1][1], '0.3')
  assert.ok(sheetNotices(data).some((notice) => notice.includes('无法恢复原始数字')))
})

test('CSV → XLSX 往返：BOM、引号、逗号、换行、前导零与长编号不变', async () => {
  const csv =
    '\uFEFF姓名,备注,编号\r\n小王,"第一行\n第二行,含逗号和""引号""",001\r\n李四,普通,12345678901234567890'
  const output = await csvFileToExcel(fileFromText(csv, '订单.csv'), { detectNumbers: false })
  assert.equal(output.name, '订单.xlsx')
  const workbook = await loadWorkbook(await fileFromOutput(output.name, output.blob))
  assert.equal(workbook.sheets[0].name, '订单')
  assert.deepEqual(workbook.sheet('订单').rows, [
    ['姓名', '备注', '编号'],
    ['小王', '第一行\n第二行,含逗号和"引号"', '001'],
    ['李四', '普通', '12345678901234567890'],
  ])
})

test('公式前缀文本写入后仍是文本，不会变成公式', async () => {
  const rows = ['=SUM(A1)', '+102', '-5', '@cmd', '1E5', '0123', '00123']
  const output = await matrixToExcelFile([['内容', ...rows]], '公式.csv', { detectNumbers: false })
  const bytes = new Uint8Array(await output.blob.arrayBuffer())
  const workbook = XLSX.read(bytes, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  for (let index = 1; index <= rows.length; index++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: index })]
    assert.equal(cell.t, 's', `${rows[index - 1]} 应为文本单元格`)
    assert.equal(cell.f, undefined, `${rows[index - 1]} 不应被写成公式`)
    assert.equal(cell.v, rows[index - 1])
  }
})

test('开启数字识别时只转换安全数字，其余保持文本', async () => {
  const matrix = parseCsvMatrix(
    '整数,前导零,长编号,科学计数,负数,小数\n42,0123,123456789012345,1E5,-5,3.14',
  ).rows
  const output = await matrixToExcelFile(matrix, '数字.csv', { detectNumbers: true })
  const bytes = new Uint8Array(await output.blob.arrayBuffer())
  const sheet = XLSX.read(bytes, { type: 'array' }).Sheets['数字']
  const type = (column: number) => sheet[XLSX.utils.encode_cell({ r: 1, c: column })].t
  assert.equal(type(0), 'n', '42 转为数字')
  assert.equal(type(1), 's', '0123 保留文本')
  assert.equal(type(2), 's', '15 位以上编号保留文本')
  assert.equal(type(3), 's', '科学计数法字符串保留文本')
  assert.equal(type(4), 's', '以 - 开头保留文本')
  assert.equal(type(5), 'n', '3.14 转为数字')
})

test('parseCsvMatrix 补齐参差行并提示，空内容报错', () => {
  const { rows, notices } = parseCsvMatrix('a,b\n1')
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['1', ''],
  ])
  assert.ok(notices.some((notice) => notice.includes('补齐')))
  assert.throws(() => parseCsvMatrix(''), /为空/)
})

test('内部空单元格保留，末尾空行空列裁剪', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['a', '', 'b'],
    ['1', '', '2'],
    ['', '', ''],
  ])
  sheet['!ref'] = 'A1:D4'
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: sheet }))
  assert.deepEqual(workbook.sheet('表').rows, [
    ['a', '', 'b'],
    ['1', '', '2'],
  ])
})

test('空工作表、损坏文件与超出限制的工作表给出明确错误', async () => {
  const empty = await loadWorkbook(fileFromWorkbook({ 空表: XLSX.utils.aoa_to_sheet([]) }))
  assert.equal(empty.sheet('空表').rows.length, 0)
  assert.throws(() => sheetToCsv(empty.sheet('空表')), /没有可读取的数据/)
  const broken = Buffer.from('PK\u0003\u0004 not a real workbook')
  await assert.rejects(
    () =>
      loadWorkbook({
        name: '坏.xlsx',
        size: broken.length,
        arrayBuffer: async () =>
          broken.buffer.slice(broken.byteOffset, broken.byteOffset + broken.length) as ArrayBuffer,
      }),
    /无法读取/,
  )
  const sheet = XLSX.utils.aoa_to_sheet([['a']])
  sheet['!ref'] = `A1:${XLSX.utils.encode_col(excelLimits.maxCols + 1)}1`
  const workbook = await loadWorkbook(fileFromWorkbook({ 超大: sheet }))
  assert.throws(() => workbook.sheet('超大'), /超出处理上限/)
})

test('unzipTotalSize 只累加声明的解压大小，不解压；损坏输入报错', () => {
  const encoder = new TextEncoder()
  const zipped = zipSync({ 'a.txt': encoder.encode('hello'), 'b.txt': encoder.encode('你好') })
  assert.equal(unzipTotalSize(zipped), 5 + 6)
  assert.throws(() => unzipTotalSize(Buffer.from('not a zip')))
})

test('压缩炸弹在解析前被拒绝：压缩体积达标但声明解压总量超限', async () => {
  const zeros = new Uint8Array(excelLimits.maxUnzipBytes + 1)
  const bomb = zipSync({ 'xl/worksheets/sheet1.xml': zeros })
  assert.ok(bomb.byteLength <= excelLimits.maxFileBytes, '压缩后应先通过 10 MB 文件体积检查')
  await assert.rejects(
    () =>
      loadWorkbook({
        name: '炸弹.xlsx',
        size: bomb.byteLength,
        arrayBuffer: async () =>
          bomb.buffer.slice(bomb.byteOffset, bomb.byteOffset + bomb.byteLength) as ArrayBuffer,
      }),
    /解压后超过/,
  )
})

test('没有缓存结果的公式按空值导出并提示', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['数量', '合计'],
    ['5', ''],
  ])
  sheet['B2'] = { t: 'n', f: 'A2*2' }
  const workbook = await loadWorkbook(fileFromWorkbook({ 表: sheet }))
  const data = workbook.sheet('表')
  assert.equal(data.missingFormulaValues, 1)
  assert.equal(data.rows[1][1], '')
  assert.ok(sheetNotices(data).some((notice) => notice.includes('没有缓存计算结果')))
})

test('重复转换同一矩阵输出一致', async () => {
  const matrix = parseCsvMatrix('名称,编号\n甲,001\n乙,002').rows
  const first = await matrixToExcelFile(matrix, '稳定.csv', { detectNumbers: false })
  const second = await matrixToExcelFile(matrix, '稳定.csv', { detectNumbers: false })
  assert.deepEqual(
    Buffer.from(await first.blob.arrayBuffer()),
    Buffer.from(await second.blob.arrayBuffer()),
  )
})
