import { expect, test, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'

const leftCsv = '编号,名称,数量\nA01,甲,1\nA02,乙,2\nA03,丙,3\n'
const rightCsv = '编号,名称,数量\nA01,甲,10\nA02,乙,2\nA04,丁,4\n'

async function upload(page: Page, side: '旧表（左）' | '新表（右）', name: string, text: string) {
  await page.setInputFiles(`input[aria-label="选择${side}文件"]`, {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(text, 'utf8'),
  })
}

async function blobBase64(page: Page, selector: string): Promise<string> {
  const link = page.locator(selector)
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  return page.evaluate(async (url) => {
    const buffer = await (await fetch(url)).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }, href)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/compare')
  await expect(page.getByRole('heading', { name: '表格对比' })).toBeVisible()
})

test('CSV 对比：新增 / 删除 / 修改与未变计数及逐列前后对照', async ({ page }) => {
  await upload(page, '旧表（左）', '旧表.csv', leftCsv)
  await upload(page, '新表（右）', '新表.csv', rightCsv)
  await expect(page.getByText('新增 1')).toBeVisible()
  await expect(page.getByText('删除 1')).toBeVisible()
  await expect(page.getByText('修改 1')).toBeVisible()
  await expect(page.getByText('未变 1')).toBeVisible()
  await expect(page.locator('.compare-key', { hasText: 'A04' })).toBeVisible()
  await expect(page.locator('.compare-key', { hasText: 'A03' })).toBeVisible()
  const change = page.locator('.compare-change', { hasText: '数量' })
  await expect(change).toContainText('1')
  await expect(change).toContainText('10')
})

test('导出 XLSX 三个工作表且内容与界面一致', async ({ page }) => {
  await upload(page, '旧表（左）', '旧表.csv', leftCsv)
  await upload(page, '新表（右）', '新表.csv', rightCsv)
  await page.getByRole('button', { name: /导出 XLSX/ }).click()
  const link = page.locator('a[download]')
  await expect(link).toBeVisible()
  expect(await link.getAttribute('download')).toBe('表格对比结果.xlsx')
  const base64 = await blobBase64(page, 'a[download]')
  const workbook = XLSX.read(Buffer.from(base64, 'base64'), { type: 'buffer' })
  expect(workbook.SheetNames).toEqual(['1-新增记录', '2-删除记录', '3-修改明细'])
  const added = workbook.Sheets['1-新增记录']
  expect(added['A2'].v).toBe('A04')
  expect(added['B2'].v).toBe('丁')
  const removed = workbook.Sheets['2-删除记录']
  expect(removed['A2'].v).toBe('A03')
  const changed = workbook.Sheets['3-修改明细']
  expect(changed['A2'].v).toBe('A01')
  expect(changed['B2'].v).toBe('数量')
  expect(changed['C2'].v).toBe('1')
  expect(changed['D2'].v).toBe('10')
})

test('重复主键显式提示且按首次出现匹配', async ({ page }) => {
  await upload(page, '旧表（左）', '旧表.csv', '编号,名称\nA01,甲\n')
  await upload(page, '新表（右）', '新表.csv', '编号,名称\nA01,甲\nA01,甲备份\nA09,新增\n')
  await expect(page.getByText(/新表「A01」×2/)).toBeVisible()
  await expect(page.getByText('未变 1')).toBeVisible()
  await expect(page.getByText('新增 1')).toBeVisible()
})

test('XLSX 输入：选择工作表后参与对比', async ({ page }) => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['编号', '名称', '数量'],
    ['A01', '甲', '1'],
    ['A02', '乙', '2'],
    ['A03', '丙', '3'],
  ])
  const summary = XLSX.utils.aoa_to_sheet([
    ['编号', '名称', '数量'],
    ['A01', '甲', '99'],
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '明细')
  XLSX.utils.book_append_sheet(workbook, summary, '汇总')
  await page.setInputFiles('input[aria-label="选择旧表（左）文件"]', {
    name: '旧表.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
  })
  await expect(page.getByRole('combobox', { name: '旧表（左）工作表' })).toContainText('明细')
  await upload(page, '新表（右）', '新表.csv', '编号,名称,数量\nA01,甲,1\nA02,乙,2\n')
  await expect(page.getByText('删除 1')).toBeVisible()
  await expect(page.getByText('修改 0')).toBeVisible()
  // 切到「汇总」工作表：A01 数量 1→99 变为修改
  await page.getByRole('combobox', { name: '旧表（左）工作表' }).click()
  await page.getByRole('option', { name: /汇总/ }).click()
  await expect(page.getByText('修改 1')).toBeVisible()
  const change = page.locator('.compare-change', { hasText: '数量' })
  await expect(change).toContainText('99')
})
