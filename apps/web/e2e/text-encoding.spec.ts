import { expect, test, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'

const csv = {
  name: '中文.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from('b1e0bac52cc3fbb3c60a3030312cd6d0cec40a', 'hex'),
}
const md = {
  name: '中文.md',
  mimeType: 'text/markdown',
  buffer: Buffer.from('2320d6d0cec40a0a2a2ab2e2cad42a2a', 'hex'),
}
async function chooseEncoding(page: Page, label: string, value: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: value, exact: true }).click()
}
async function downloadBuffer(page: Page) {
  const link = page.locator('a[download]').first()
  await expect(link).toBeVisible()
  return Buffer.from(
    await page.evaluate(
      async (url) => {
        const bytes = new Uint8Array(await (await fetch(url!)).arrayBuffer())
        let value = ''
        for (const byte of bytes) value += String.fromCharCode(byte)
        return btoa(value)
      },
      await link.getAttribute('href'),
    ),
    'base64',
  )
}

test('TXT/MD 自动识别 GBK，强制 UTF-8 失败不覆盖正文，切回后可继续整理', async ({ page }) => {
  await page.goto('/tools/#/text')
  await page.setInputFiles('input[aria-label="导入文本文件"]', md)
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
    '# 中文\n\n**测试**',
  )
  await expect(page.locator('.text-import-options')).toContainText('已按 GBK / GB18030 读取')
  await chooseEncoding(page, '读取编码', 'UTF-8')
  await expect(page.getByText(/无法按 UTF-8 读取/)).toBeVisible()
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
    '# 中文\n\n**测试**',
  )
  await chooseEncoding(page, '读取编码', '自动识别')
  await page.getByRole('button', { name: 'MD 转纯文本', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '整理结果', exact: true })).toHaveValue(
    '中文\n\n测试',
  )
})

for (const [mode, file] of [
  ['markdown', md],
  [
    'markdown-csv',
    {
      ...md,
      buffer: Buffer.from(
        '7c20b1e0bac5207c20c3fbb3c6207c0a7c202d2d2d207c202d2d2d207c0a7c20303031207c20d6d0cec4207c',
        'hex',
      ),
    },
  ],
  ['csv-json', csv],
  [
    'json-csv',
    {
      name: '中文.json',
      mimeType: 'application/json',
      buffer: Buffer.from('5b7b22c3fbb3c6223a22d6d0cec4227d5d', 'hex'),
    },
  ],
  [
    'csv-markdown',
    {
      ...csv,
      name: '中文.tsv',
      buffer: Buffer.from('b1e0bac509c3fbb3c60a30303109d6d0cec40a', 'hex'),
    },
  ],
] as const)
  test(`${mode}: GBK 文件转换结果中文不乱码`, async ({ page }) => {
    await page.goto('/tools/#/files?mode=' + mode)
    await expect(page.getByRole('heading', { name: '文件格式转换', exact: true })).toBeVisible()
    await page.setInputFiles('input[aria-label="选择待转换文件"]', file)
    await expect(page.locator('.file-row-group')).toContainText('已按 GBK / GB18030 读取')
    expect((await downloadBuffer(page)).toString('utf8')).toContain('中文')
  })

test('CSV→Excel 预览、手动编码重读和下载使用同一解码策略', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tools/#/files?mode=csv-excel')
  await expect(page.getByRole('heading', { name: '文件格式转换', exact: true })).toBeVisible()
  await page.setInputFiles('input[aria-label="选择待转换文件"]', csv)
  await expect(page.locator('.matrix-table')).toContainText('中文')
  await page.getByText('高级设置与说明', { exact: true }).click()
  await chooseEncoding(page, '读取编码', 'UTF-8')
  await expect(page.locator('.file-row')).toContainText('无法按 UTF-8')
  await chooseEncoding(page, '读取编码', 'GBK / GB18030')
  await expect(page.locator('.matrix-table')).toContainText('001')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  const workbook = XLSX.read(await downloadBuffer(page), { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  expect(sheet.A2.v).toBe('001')
  expect(sheet.B2.v).toBe('中文')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath('gbk-csv-excel.png'), fullPage: true })
})

test('表格对比可手动重读 GBK，两边显示真实编码并生成正确差异', async ({ page }) => {
  await page.goto('/tools/#/compare')
  await page.setInputFiles('input[aria-label="选择旧表（左）文件"]', csv)
  await page.setInputFiles('input[aria-label="选择新表（右）文件"]', {
    ...csv,
    name: '新表.csv',
    buffer: Buffer.from('b1e0bac52cc3fbb3c60a3030312cb2e2cad40a', 'hex'),
  })
  await expect(page.getByText('修改 1', { exact: true })).toBeVisible()
  await expect(page.locator('.compare-change')).toContainText('中文')
  await expect(page.locator('.compare-change')).toContainText('测试')
  await chooseEncoding(page, '旧表（左）读取编码', 'UTF-8')
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    '无法按 UTF-8',
  )
  await chooseEncoding(page, '旧表（左）读取编码', '自动识别')
  await expect(page.getByText('修改 1', { exact: true })).toBeVisible()
})

test('表格批处理重新解码失败保留原表，批量文本显示每文件编码', async ({ page }) => {
  await page.goto('/tools/#/table')
  await page.setInputFiles('input[aria-label="添加表格文件"]', csv)
  await expect(page.locator('.table-preview')).toContainText('中文')
  await chooseEncoding(page, '读取编码', 'UTF-8')
  await expect(page.getByText(/无法按 UTF-8 读取/)).toBeVisible()
  await expect(page.locator('.table-preview')).toContainText('001')
  await expect(page.getByRole('combobox', { name: '读取编码', exact: true })).toHaveText('自动识别')
  await page.goto('/tools/#/text')
  await page.getByRole('button', { name: '更多操作' }).click()
  await page.setInputFiles('input[aria-label="添加批量文本文件"]', md)
  await page.getByRole('button', { name: '开始处理', exact: true }).click()
  await expect(page.locator('.batch-item')).toContainText('已按 GBK / GB18030 读取')
  await chooseEncoding(page, '批量读取编码', 'UTF-8')
  await page.getByRole('button', { name: '开始处理', exact: true }).click()
  await expect(page.locator('.batch-state.state-error')).toBeVisible()
})
