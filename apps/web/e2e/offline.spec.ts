import { openTool } from './helpers/navigation'
import { exifJpeg } from './fixtures/exif'
import { expect, test, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

async function waitForSwControl(page: Page) {
  await page.goto('/tools/')
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
      index: Boolean(await cache.match('/tools/index.html')),
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
        (name) => !entries.some((url) => url.includes('/_next/static/chunks/' + name + '.')),
      ),
      fonts: entries.filter((url) => /\/pdf-assets\/cmaps\//.test(url)).length,
    }
  })
  expect(missing.tools).toEqual([])
  expect(missing.fonts).toBeGreaterThan(100)
  await context.setOffline(true)
  for (const [route, heading] of routes) {
    await page.goto(`/tools/#/${route}`)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0)
  }
  await page.goto('/tools/#/table')
  await page.getByLabel('添加表格文件', { exact: true }).setInputFiles({
    name: 'offline.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('编号,名称\n001,本地解析'),
  })
  await expect(page.locator('.table-preview')).toContainText('001')
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
  const csvDownload = page.locator('.table-tool a[download]')
  await expect(csvDownload).toBeVisible()
  expect(
    await page.evaluate(
      async (url) => (await fetch(url!)).text(),
      await csvDownload.getAttribute('href'),
    ),
  ).toContain('001,本地解析')
  await page.goto('/tools/#/text')
  await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('  Offline   test  ')
  await expect(page.getByRole('textbox', { name: '整理结果', exact: true })).toHaveValue(
    'Offline test',
  )
  await page.getByRole('button', { name: /^更多操作/ }).click()
  await page
    .locator('summary')
    .filter({ hasText: /^简繁转换$/ })
    .click()
  await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('头发和软件')
  await page.getByRole('button', { name: '开始简繁转换', exact: true }).click()
  await expect(page.getByLabel('简繁转换预览')).toHaveText('頭髮和軟件')
  await page
    .locator('summary')
    .filter({ hasText: /^内容提取$/ })
    .click()
  await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('offline@example.com')
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.getByLabel('提取结果预览')).toHaveText('offline@example.com')
  const pdf = await PDFDocument.create()
  pdf.addPage().drawText('Offline PDF preview')
  await page.goto('/tools/#/pdf')
  await page.setInputFiles('input[aria-label="选择 PDF 或图片"]', {
    name: 'offline.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  })
  await expect(page.locator('.pdf-thumbnail canvas')).toBeVisible()
  await page.getByRole('button', { name: '放大页面 1', exact: true }).click()
  await expect(page.locator('.pdf-preview-dialog canvas')).toBeVisible()
  await page.goto('/tools/#/rename')
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
  await page.goto('/tools/#/files')
  await page.getByLabel('选择待转换文件').setInputFiles('e2e/fixtures/colors.heic')
  await page.getByRole('combobox', { name: '输出格式', exact: true }).click()
  await page.getByRole('option', { name: 'JPG', exact: true }).click()
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  await expect(page.locator('.file-row a[download]')).toBeVisible()
  const heicUrl = await page.locator('.file-row a[download]').getAttribute('href')
  expect(
    await page.evaluate(async (url) => {
      const blob = await (await fetch(url!)).blob(),
        bitmap = await createImageBitmap(blob)
      const dimensions = [bitmap.width, bitmap.height]
      bitmap.close()
      return { type: blob.type, dimensions }
    }, heicUrl),
  ).toEqual({ type: 'image/jpeg', dimensions: [64, 40] })
  await page.goto('/tools/#/pdf')
  await page
    .getByLabel('选择 PDF 或图片', { exact: true })
    .setInputFiles('e2e/fixtures/encrypted.pdf')
  await page.getByLabel('PDF 打开密码', { exact: true }).fill(' 密碼-123 ')
  await page.getByRole('button', { name: '解密并导入', exact: true }).click()
  await expect(page.locator('.pdf-page')).toHaveCount(3)
  await expect(page.locator('.pdf-page-origin').filter({ hasText: 'offline.pdf' })).toHaveCount(1)
  await expect(page.locator('[aria-label="解密结果"] a[download]')).toBeVisible()
  await page
    .locator('summary')
    .filter({ hasText: /^PDF 结构压缩$/ })
    .click()
  await page.getByRole('button', { name: '压缩并导出所选', exact: true }).click()
  await expect(page.locator('.conversion-actions a[download]')).toBeVisible()
  await context.setOffline(false)
})

test.describe('懒加载失败恢复（不依赖 SW 预热）', () => {
  test.use({ serviceWorkers: 'block' })

  test('工具首次加载不闪现文字，导航可用且返回后草稿保留', async ({ page }) => {
    let resume = () => {}
    const paused = new Promise<void>((resolve) => {
      resume = resolve
    })
    await page.route('**/_next/static/chunks/PdfTool.*.js', async (route) => {
      await paused
      await route.continue()
    })
    await page.goto('/tools/#/text')
    await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('切换后仍保留的草稿')
    const navigation = page.getByRole('navigation', { name: '网站导航' })
    await openTool(page, 'PDF 页面整理')
    try {
      const pending = page.getByRole('status', { name: '正在加载PDF 页面整理', exact: true })
      await expect(pending).toHaveAttribute('aria-busy', 'true')
      await expect(pending).toHaveText('')
      await expect(navigation).toBeVisible()
    } finally {
      resume()
    }
    await expect(page.getByRole('heading', { name: 'PDF 页面整理', exact: true })).toBeVisible()
    await openTool(page, '文本整理')
    await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
      '切换后仍保留的草稿',
    )
  })

  test('断网失败保持错误界面与导航，重试可恢复并保留其他工具草稿', async ({
    page,
    context,
  }, info) => {
    await page.goto('/tools/#/text')
    await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('尚未下载的草稿')
    await context.setOffline(true)
    await openTool(page, 'PDF 页面整理')
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
      'PDF 页面整理加载失败',
    )
    // Wait past transient Suspense UI; the old test passed before the rejection arrived.
    await page.waitForTimeout(3000)
    await expect(page.getByRole('heading', { name: 'PDF 页面整理加载失败' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '网站导航' })).toBeVisible()
    await page.screenshot({ path: info.outputPath('recoverable-load-error.png'), fullPage: true })
    await openTool(page, '文本整理')
    await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
      '尚未下载的草稿',
    )
    await openTool(page, 'PDF 页面整理')
    await context.setOffline(false)
    await page.getByRole('button', { name: '重试加载', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'PDF 页面整理', exact: true })).toBeVisible()
  })

  test('旧版本分块丢失最多自动刷新一次，持续失败仍显示可恢复界面', async ({ page }) => {
    let navigations = 0
    page.on('request', (request) => {
      if (request.isNavigationRequest()) navigations++
    })
    await page.route('**/_next/static/chunks/PdfTool.*.js', (route) => route.abort())
    await page.goto('/tools/#/pdf')
    await expect(page.getByRole('heading', { name: 'PDF 页面整理加载失败' })).toBeVisible({
      timeout: 10_000,
    })
    expect(navigations).toBe(2)
    await page.waitForTimeout(1500)
    expect(navigations).toBe(2)
    await expect(page.getByRole('button', { name: '刷新页面', exact: true })).toBeVisible()
  })
})
