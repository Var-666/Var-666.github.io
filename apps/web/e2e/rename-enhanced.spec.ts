import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'

async function addFiles(page: Page, names: string[]) {
  await page.setInputFiles(
    'input[aria-label="选择需要重命名的文件"]',
    names.map((name) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(name) })),
  )
}

async function downloadBytes(page: Page): Promise<Buffer> {
  const link = page.locator('a[download]')
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  const base64 = await page.evaluate(async (url) => {
    const buffer = await (await fetch(url)).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }, href)
  return Buffer.from(base64, 'base64')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tools/#/rename')
  await expect(page.getByRole('heading', { name: '批量重命名' })).toBeVisible()
  await page.getByText('更多规则与名单导入', { exact: true }).click()
})

test('清理特殊字符：含冒号的统一名称从报错变为合法输出', async ({ page }) => {
  await addFiles(page, ['a.txt', 'b.txt'])
  await page.getByRole('textbox', { name: '统一名称' }).fill('报告:终稿')
  await expect(page.locator('.rename-error')).toHaveCount(2)
  await page.getByRole('switch', { name: '特殊字符换成空格' }).click()
  await expect(page.locator('.rename-error')).toHaveCount(0)
  await expect(page.locator('.rename-new input').first()).toHaveValue(/报告 终稿_001\.txt/)
})

test('从文本列表导入：数量不一致明确报错，一致后逐项生效并打包', async ({ page }) => {
  await addFiles(page, ['甲.png', '乙.png', '丙.png'])
  await page.getByRole('textbox', { name: '粘贴目标名称列表' }).fill('发票-01.png\n发票-02.png')
  await page.getByRole('button', { name: '导入名称' }).click()
  await expect(page.getByText(/2 个名称 vs 3 个文件/)).toBeVisible()
  await page
    .getByRole('textbox', { name: '粘贴目标名称列表' })
    .fill('发票-01.png\n发票-02.png\n发票-03.png')
  await page.getByRole('button', { name: '导入名称' }).click()
  await expect(page.locator('.rename-new input', { hasText: '' }).first()).toHaveValue(
    '发票-01.png',
  )
  await page.getByRole('button', { name: /生成 ZIP/ }).click()
  const bytes = await downloadBytes(page)
  const files = unzipSync(new Uint8Array(bytes))
  expect(Object.keys(files).sort()).toEqual(['发票-01.png', '发票-02.png', '发票-03.png'])
})

test('逐项编辑目标名：与生成名撞名被拦截，还原后可打包', async ({ page }) => {
  await addFiles(page, ['a.txt', 'b.txt'])
  await page.getByRole('textbox', { name: '统一名称' }).fill('同名')
  const second = page.getByRole('textbox', { name: '新文件名 b.txt' })
  await second.fill('同名_001.txt')
  await expect(page.locator('.rename-error')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /生成 ZIP/ })).toBeDisabled()
  await page.getByRole('button', { name: '还原 b.txt 的生成名' }).click()
  await expect(page.locator('.rename-error')).toHaveCount(0)
  await page.getByRole('button', { name: /生成 ZIP/ }).click()
  await expect(page.locator('a[download]')).toBeVisible()
})

test('队列重排后逐项覆盖被重置，避免错位应用', async ({ page }) => {
  await addFiles(page, ['a.txt', 'b.txt'])
  await page.getByRole('textbox', { name: '新文件名 a.txt' }).fill('覆盖名.txt')
  await expect(page.locator('.rename-new input').first()).toHaveValue('覆盖名.txt')
  await page.getByRole('button', { name: '上移 b.txt' }).click()
  await expect(page.locator('.rename-new input').first()).toHaveValue(/_001\.txt/)
})
