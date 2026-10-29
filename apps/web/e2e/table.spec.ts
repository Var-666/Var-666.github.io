import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'

const csvA = '编号,部门,姓名\nA01,研发,甲\nA02,销售,乙\n'
const csvB = '编号,部门,姓名\nA01,研发,甲\nA03,人事,丙\n'

async function upload(page: Page, name: string, text: string) {
  await page.setInputFiles('input[aria-label="添加表格文件"]', {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(text, 'utf8'),
  })
}

async function downloadBytes(page: Page): Promise<{ name: string; bytes: Buffer }> {
  const link = page.locator('a[download]')
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  const name = (await link.getAttribute('download')) ?? ''
  const base64 = await page.evaluate(async (url) => {
    const buffer = await (await fetch(url)).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }, href)
  return { name, bytes: Buffer.from(base64, 'base64') }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tools/#/table')
  await expect(page.getByRole('heading', { name: '表格批量处理' })).toBeVisible()
})

test('两份 CSV 合并 + 按编号去重：分步统计与导出内容一致', async ({ page }) => {
  await upload(page, '一.csv', csvA)
  await upload(page, '二.csv', csvB)
  await expect(page.getByText('合并 2 份 · 4 行')).toBeVisible()
  await page.getByRole('switch', { name: '启用去重' }).click()
  await page.getByRole('combobox', { name: '去重列' }).click()
  await page.getByRole('option', { name: '编号' }).click()
  await expect(page.getByText('去重删除 1 行')).toBeVisible()
  await expect(page.getByText('结果 3 行 × 3 列')).toBeVisible()
  await page.getByRole('button', { name: /导出 CSV/ }).click()
  const { name, bytes } = await downloadBytes(page)
  expect(name).toBe('处理结果.csv')
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '')
  expect(text).toContain('编号,部门,姓名')
  expect(text).toContain('A01,研发,甲')
  expect(text).toContain('A02,销售,乙')
  expect(text).toContain('A03,人事,丙')
  expect((text.match(/A01,/g) ?? []).length).toBe(1)
})

test('表头不一致的文件被点名拒绝，其他文件不受影响', async ({ page }) => {
  await upload(page, '一.csv', csvA)
  await upload(page, '坏.csv', '编号,部门\nA09,研发\n')
  await expect(
    page.getByText(/「一\.csv」的表头与「坏\.csv」不一致|「坏\.csv」的表头与「一\.csv」不一致/),
  ).toBeVisible()
})

test('按部门拆分导出 ZIP，逐个文件核对内容', async ({ page }) => {
  await upload(page, '一.csv', csvA)
  await upload(page, '二.csv', csvB)
  await page.getByRole('combobox', { name: '按列拆分' }).click()
  await page.getByRole('option', { name: '部门' }).click()
  await expect(page.getByText(/拆分为 3 组/)).toBeVisible()
  await page.getByRole('button', { name: /导出 CSV（ZIP）/ }).click()
  const { name, bytes } = await downloadBytes(page)
  expect(name).toBe('处理结果-拆分.zip')
  const files = unzipSync(new Uint8Array(bytes))
  const names = Object.keys(files).sort()
  expect(names).toEqual(['人事.csv', '研发.csv', '销售.csv'])
  expect(
    Buffer.from(files['研发.csv'])
      .toString('utf8')
      .replace(/^\uFEFF/, ''),
  ).toBe('编号,部门,姓名\r\nA01,研发,甲\r\nA01,研发,甲')
})

test('删除列与筛选的组合在预览计数中体现', async ({ page }) => {
  await upload(page, '一.csv', csvA)
  await upload(page, '二.csv', csvB)
  await page.getByRole('switch', { name: '启用列操作' }).click()
  await page.getByRole('button', { name: '姓名' }).click()
  await expect(page.getByText('删除列 姓名')).toBeVisible()
  await expect(page.getByText('结果 4 行 × 2 列')).toBeVisible()
  await page.getByRole('switch', { name: '启用筛选' }).click()
  await page.getByRole('combobox', { name: '筛选列' }).click()
  await page.getByRole('option', { name: '部门' }).click()
  await page.getByRole('textbox', { name: '筛选关键词' }).fill('研发')
  await expect(page.getByText('筛选移除 2 行')).toBeVisible()
  await expect(page.getByText('结果 2 行 × 2 列')).toBeVisible()
})
