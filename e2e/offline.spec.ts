import { exifJpeg } from './fixtures/exif'
import { expect, test, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

async function waitForSwControl(page: Page) {
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)
}
const routes = [
  ['text', '文本整理'],
  ['files', '文件格式转换'],
  ['compare', '表格对比'],
  ['table', '表格批量处理'],
  ['pdf', 'PDF 页面整理'],
  ['rename', '批量重命名'],
] as const

test('Service Worker 接管页面，缓存版本来自构建且入口完整', async ({ page }) => {
  await page.goto('/manifest.webmanifest')
  await page.evaluate(async () => {
    await caches.open('var-toolbox-v1')
    await caches.open('other-app')
  })
  await waitForSwControl(page)
  const state = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter((key) => key.startsWith('var-toolbox-'))
    const cache = await caches.open(keys[0])
    return {
      keys,
      entries: (await cache.keys()).length,
      index: Boolean(await cache.match('./index.html')),
    }
  })
  expect(state.keys).toHaveLength(1)
  expect(state.keys[0]).toMatch(/^var-toolbox-[a-f0-9]{16}$/)
  expect(state.entries).toBeGreaterThan(5)
  expect(await page.evaluate(() => caches.has('other-app'))).toBe(true)
  expect(state.index).toBe(true)
})

test('首次离线准备后，未访问过的六个工具与本地字体都可断网使用', async ({ page, context }) => {
  await waitForSwControl(page)
  await expect(page.getByRole('button', { name: '离线就绪', exact: true })).toBeVisible({
    timeout: 20_000,
  })
  const missing = await page.evaluate(async () => {
    const key = (await caches.keys()).find((key) => key.startsWith('var-toolbox-'))!
    const cache = await caches.open(key)
    const entries = (await cache.keys()).map((request) => request.url)
    return {
      tools: ['TextTool', 'FileTool', 'CompareTool', 'TableTool', 'PdfTool', 'RenameTool'].filter(
        (name) => !entries.some((url) => url.includes('/assets/' + name + '-')),
      ),
      fonts: entries.filter((url) => /\/pdf-assets\/cmaps\//.test(url)).length,
    }
  })
  expect(missing.tools).toEqual([])
  expect(missing.fonts).toBeGreaterThan(100)
  await context.setOffline(true)
  for (const [route, heading] of routes) {
    await page.goto(`/#/${route}`)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
  await page.goto('/#/text')
  await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('  Offline   test  ')
  await expect(page.getByRole('textbox', { name: '整理结果', exact: true })).toHaveValue(
    'Offline test',
  )
  const pdf = await PDFDocument.create()
  pdf.addPage().drawText('Offline PDF preview')
  await page.goto('/#/pdf')
  await page.setInputFiles('input[aria-label="选择需要整理的 PDF"]', {
    name: 'offline.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  })
  await expect(page.locator('.pdf-thumbnail canvas')).toBeVisible()
  await page.getByRole('button', { name: '放大页面 1', exact: true }).click()
  await expect(page.locator('.pdf-preview-dialog canvas')).toBeVisible()
  await page.goto('/#/rename')
  await page
    .getByLabel('选择需要重命名的文件')
    .setInputFiles({ name: 'offline.jpg', mimeType: 'image/jpeg', buffer: exifJpeg() })
  await page.getByRole('button', { name: '读取照片时间', exact: true }).click()
  await expect(page.getByText('拍摄 2026:10:26 09:08:07', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '替换', exact: true }).click()
  await page.getByRole('textbox', { name: '查找文字', exact: true }).fill('^offline$')
  await page.getByRole('textbox', { name: '替换为', exact: true }).fill('renamed')
  await page.getByRole('switch', { name: '正则表达式', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '新文件名 offline.jpg' })).toHaveValue(
    'renamed_001.jpg',
  )
  await context.setOffline(false)
})

test.describe('懒加载失败恢复（不依赖 SW 预热）', () => {
  test.use({ serviceWorkers: 'block' })

  test('断网失败保持错误界面与导航，重试可恢复并保留其他工具草稿', async ({
    page,
    context,
  }, info) => {
    await page.goto('/#/text')
    await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('尚未下载的草稿')
    await context.setOffline(true)
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: 'PDF 页面整理', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('PDF 页面整理加载失败')
    // Wait past transient Suspense UI; the old test passed before the rejection arrived.
    await page.waitForTimeout(3000)
    await expect(page.getByRole('heading', { name: 'PDF 页面整理加载失败' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
    await page.screenshot({ path: info.outputPath('recoverable-load-error.png'), fullPage: true })
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '文本整理', exact: true })
      .click()
    await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
      '尚未下载的草稿',
    )
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: 'PDF 页面整理', exact: true })
      .click()
    await context.setOffline(false)
    await page.getByRole('button', { name: '重试加载', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'PDF 页面整理', exact: true })).toBeVisible()
  })

  test('旧版本分块丢失最多自动刷新一次，持续失败仍显示可恢复界面', async ({ page }) => {
    let navigations = 0
    page.on('request', (request) => {
      if (request.isNavigationRequest()) navigations++
    })
    await page.route('**/assets/PdfTool-*.js', (route) => route.abort())
    await page.goto('/#/pdf')
    await expect(page.getByRole('heading', { name: 'PDF 页面整理加载失败' })).toBeVisible({
      timeout: 10_000,
    })
    expect(navigations).toBe(2)
    await page.waitForTimeout(1500)
    expect(navigations).toBe(2)
    await expect(page.getByRole('button', { name: '刷新页面', exact: true })).toBeVisible()
  })
})
