import { expect, test, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { unzipSync } from 'fflate'

const csv = (name: string, text: string) => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(text),
})
function workbook() {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['编号', '部门'],
      ['001', '研发'],
    ]),
    '明细',
  )
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['编号', '部门'],
      ['009', '历史'],
    ]),
    '归档',
  )
  return {
    name: 'book.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(XLSX.write(book, { bookType: 'xlsx', type: 'buffer' })),
  }
}
async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click()
}
async function bytes(page: Page) {
  const link = page.locator('.table-tool a[download]')
  await expect(link).toBeVisible()
  return new Uint8Array(
    await page.evaluate(
      async (url) => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),
      await link.getAttribute('href'),
    ),
  )
}
const parse = (value: Uint8Array) =>
  Papa.parse<string[]>(
    Buffer.from(value)
      .toString()
      .replace(/^\uFEFF/, ''),
  ).data
async function upload(page: Page, files: ReturnType<typeof csv>[]) {
  await page.getByLabel('添加表格文件', { exact: true }).setInputFiles(files)
}

test('全局接收 XLSX+CSV：按列名补空合并，工作表切换使旧结果失效', async ({ page }) => {
  await page.goto('/')
  await page
    .getByLabel('首页选择文件', { exact: true })
    .setInputFiles([workbook(), csv('extra.csv', '部门,备注\n销售,新增')])
  await page.getByRole('button', { name: '合并、去重、筛选表格', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('表头')
  await choose(page, '合并方式', '按列名对齐补空')
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
  expect(parse(await bytes(page))).toEqual([
    ['编号', '部门', '备注'],
    ['001', '研发', ''],
    ['', '销售', '新增'],
  ])
  const oldUrl = await page.locator('.table-tool a[download]').getAttribute('href')
  await choose(page, 'book.xlsx 工作表', /归档/)
  await expect(page.locator('.table-tool a[download]')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(async (url) => {
        try {
          await fetch(url)
          return false
        } catch {
          return true
        }
      }, oldUrl),
    )
    .toBeTruthy()
  await expect(page.locator('.table-preview')).toContainText('009')
  await expect(page.locator('.table-preview')).toContainText('历史')
  await choose(page, '输出格式', 'XLSX')
  await page.getByRole('button', { name: '导出 XLSX', exact: true }).click()
  const book = XLSX.read(await bytes(page), { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0]]
  expect(sheet.A2.v).toBe('009')
  expect(sheet.A2.t).toBe('s')
  expect(sheet.B2.v).toBe('历史')
  expect(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })).toEqual([
    ['编号', '部门', '备注'],
    ['009', '历史', ''],
    ['', '销售', '新增'],
  ])
})

test('主键左/内/全连接保留一对多和前导零，空键不互相匹配，变更结果清空旧下载', async ({ page }) => {
  await page.goto('/#/table')
  await upload(page, [
    csv('left.csv', '编号,部门\n001,研发\n002,销售\n,左空'),
    csv('right.csv', '员工号,部门\n001,经理一\n001,经理二\n003,财务\n,右空'),
  ])
  await choose(page, '合并方式', '全连接（保留两表）')
  await expect(page.getByText('结果 6 行 × 3 列', { exact: true })).toBeVisible()
  await expect(
    page.getByText('匹配 2 对 · 左表未匹配 2 行 · 右表未匹配 2 行', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
  expect(parse(await bytes(page))).toEqual([
    ['编号', '部门', '部门（右表）'],
    ['001', '研发', '经理一'],
    ['001', '研发', '经理二'],
    ['002', '销售', ''],
    ['', '左空', ''],
    ['003', '', '财务'],
    ['', '', '右空'],
  ])
  await choose(page, '合并方式', '内连接（只保留匹配）')
  await expect(page.locator('.table-tool a[download]')).toHaveCount(0)
  await expect(page.getByText('结果 2 行 × 3 列', { exact: true })).toBeVisible()
  await choose(page, '合并方式', '左连接（保留左表）')
  await expect(page.getByText('结果 4 行 × 3 列', { exact: true })).toBeVisible()
})

test('列删除/改名/重排后按正确字段拆分，导出 CSV 与预览一致', async ({ page }) => {
  await page.goto('/#/table')
  await upload(page, [csv('cols.csv', '编号,部门,姓名\n001,研发,甲\n002,销售,乙')])
  await expect(page.getByRole('combobox', { name: '去重列' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '筛选关键词' })).toHaveCount(0)
  await page.getByRole('switch', { name: '启用列操作', exact: true }).click()
  await page.getByRole('button', { name: '编号', exact: true }).click()
  await page.getByText('列改名和顺序', { exact: true }).click()
  await page.getByRole('textbox', { name: '姓名 新列名', exact: true }).fill('员工')
  await page.getByRole('button', { name: '上移列 姓名', exact: true }).click()
  await choose(page, '按列拆分', '部门')
  await page.getByRole('button', { name: '导出 CSV（ZIP）', exact: true }).click()
  const parts = unzipSync(await bytes(page))
  expect(Object.keys(parts)).toEqual(['研发.csv', '销售.csv'])
  expect(parse(parts['研发.csv'])).toEqual([
    ['员工', '部门'],
    ['甲', '研发'],
  ])
  expect(parse(parts['销售.csv'])).toEqual([
    ['员工', '部门'],
    ['乙', '销售'],
  ])
  await choose(page, '按列拆分', '编号')
  await expect(page.getByRole('alert')).toContainText('拆分列已被删除')
  await expect(page.locator('.table-tool a[download]')).toHaveCount(0)
})

test('清理后重名和空值/字面占位符的分组导出均保留全部数据', async ({ page }) => {
  await page.goto('/#/table')
  await upload(page, [
    csv('groups.csv', '分组,编号\n研发/一部,001\n研发?一部,002\n,003\n（空值）,004'),
  ])
  await choose(page, '按列拆分', '分组')
  await page.getByRole('button', { name: '导出 CSV（ZIP）', exact: true }).click()
  const parts = unzipSync(await bytes(page))
  expect(Object.keys(parts)).toEqual([
    '研发 一部.csv',
    '研发 一部 (2).csv',
    '（空值）.csv',
    '（空值） (2).csv',
  ])
  expect(Object.values(parts).map((value) => parse(value)[1][1])).toEqual([
    '001',
    '002',
    '003',
    '004',
  ])

  await choose(page, '输出格式', 'XLSX（多工作表）')
  await page.getByRole('button', { name: '导出 XLSX（多工作表）', exact: true }).click()
  const book = XLSX.read(await bytes(page), { type: 'array' })
  expect(book.SheetNames).toHaveLength(4)
  expect(book.SheetNames.map((name) => book.Sheets[name].B2.v)).toEqual([
    '001',
    '002',
    '003',
    '004',
  ])
})

test('大于旧上限的 CSV 可导入；预览只截显示，导出保留完整长单元格', async ({ page }) => {
  await page.goto('/#/table')
  const text = 'x'.repeat(2_100_000)
  await upload(page, [csv('large.csv', '编号,正文\n001,' + text)])
  await expect(page.locator('.table-preview')).toContainText('001')
  expect((await page.locator('.table-preview').textContent())!.length).toBeLessThan(500)
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
  const out = parse(await bytes(page))
  expect(out[1][1]).toHaveLength(text.length)
  await choose(page, '输出格式', 'XLSX')
  await page.getByRole('button', { name: '导出 XLSX', exact: true }).click()
  await expect(page.getByText(/单元格超过 Excel 的 32767 字符/)).toBeVisible()
  await upload(page, [
    { name: 'too-big.csv', mimeType: 'text/csv', buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 120) },
  ])
  await expect(page.getByText('文件不能为空，且单个不超过 10 MB', { exact: true })).toBeVisible()
  await expect(page.locator('.table-file-row')).toContainText('large.csv')
})

test('连接展开超过行数边界时停止，原表可切回追加继续使用', async ({ page }) => {
  await page.goto('/#/table')
  await upload(page, [
    csv('a.csv', 'id,v\n' + Array(400).fill('x,a').join('\n')),
    csv('b.csv', 'id,v\n' + Array(400).fill('x,b').join('\n')),
  ])
  await choose(page, '合并方式', '全连接（保留两表）')
  await expect(page.getByRole('alert')).toContainText('超出 10 万行')
  await expect(page.locator('.table-tool a[download]')).toHaveCount(0)
  await choose(page, '合并方式', '同结构追加')
  await expect(page.getByText('结果 800 行 × 2 列', { exact: true })).toBeVisible()
})

for (const theme of ['light', 'dark'] as const)
  test(`390px ${theme}: 表格步骤默认收拢，连接和列操作展开无溢出`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/#/table')
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important}',
    })
    await upload(page, [
      csv('left.csv', '编号,部门\n001,研发'),
      csv('right.csv', '编号,部门\n001,销售'),
    ])
    await choose(page, '合并方式', '左连接（保留左表）')
    await page.getByRole('switch', { name: '启用筛选' }).click()
    await page.getByRole('switch', { name: '启用列操作' }).click()
    await page.getByText('列改名和顺序', { exact: true }).click()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy()
    await page.screenshot({ path: info.outputPath('table-upgrade-mobile.png'), fullPage: true })
  })

test('百万格边界实际合并/导出/再次导入可用，编号和全部行数不丢失', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/#/table')
  const header = Array.from({ length: 10 }, (_, i) => 'c' + i).join(',')
  const body = (from: number, count: number) =>
    header +
    '\n' +
    Array.from({ length: count }, (_, i) =>
      Array(10)
        .fill(String(from + i).padStart(6, '0'))
        .join(','),
    ).join('\n')
  await upload(page, [csv('part1.csv', body(0, 50000)), csv('part2.csv', body(50000, 49999))])
  await expect(page.getByText('结果 99999 行 × 10 列', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
  const data = await bytes(page)
  const lines = Buffer.from(data).toString().trim().split(/\r?\n/)
  expect(lines).toHaveLength(100000)
  expect(lines[1]).toBe(Array(10).fill('000000').join(','))
  expect(lines.at(-1)).toBe(Array(10).fill('099998').join(','))
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await page
    .getByLabel('添加表格文件', { exact: true })
    .setInputFiles({ name: 'roundtrip.csv', mimeType: 'text/csv', buffer: Buffer.from(data) })
  await expect(page.getByText('结果 99999 行 × 10 列', { exact: true })).toBeVisible()
  expect((await page.locator('.table-preview').textContent())!.length).toBeLessThan(2000)
})
