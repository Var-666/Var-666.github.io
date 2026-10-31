import { expect, test } from '@playwright/test'
import { Document, ImageRun, Packer, Paragraph, TextRun } from 'docx'
import Papa from 'papaparse'

test.use({ serviceWorkers: 'block' })

for (const blocked of ['object', 'methods'] as const) {
  test(`存储 ${blocked} 被拒绝时，工具箱、收藏、文本和文件转换仍可用`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((kind) => {
      const denied = () => {
        throw new DOMException('Storage denied', 'SecurityError')
      }
      if (kind === 'object') Object.defineProperty(window, 'localStorage', { get: denied })
      else
        for (const method of ['getItem', 'setItem', 'removeItem'])
          Object.defineProperty(Storage.prototype, method, { value: denied })
    }, blocked)
    await page.goto('/tools/')
    const favorite = page.getByRole('button', { name: '收藏文本整理', exact: true })
    await favorite.click()
    await page.getByRole('button', { name: '取消收藏文本整理', exact: true }).click()
    await expect(favorite).toBeVisible()
    await page.getByRole('button', { name: '切换深色主题', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.locator('.tool-card').filter({ hasText: '文本整理' }).click()
    await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('  hello   world  ')
    await expect(page.getByRole('textbox', { name: '整理结果', exact: true })).toHaveValue(
      'hello world',
    )
    // 直接子级 = 面包屑返回链接；工具条内的工具切换器也是链接，不能混入
    await page.locator('.tool-breadcrumb > a').click()
    await page.locator('.tool-card').filter({ hasText: '文件格式转换' }).click()
    await expect(page.getByRole('combobox', { name: '输出格式', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`首页首次绘制即应用保存的 ${theme}，不依赖工具箱或 hydration`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' })
    await page.addInitScript((value) => localStorage.setItem('var-theme', value), theme)
    await page.route('**/_next/static/**/*.js', (route) => route.abort())
    await page.goto('/')
    if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
    else await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(page.locator('body')).toHaveCSS(
      'color',
      theme === 'dark' ? 'rgb(228, 232, 242)' : 'rgb(37, 43, 57)',
    )
  })
}

test('系统主题更新全站，手动选择在首页导航、刷新后保留', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('link', { name: '浏览工具箱', exact: true }).click()
  await page.getByRole('button', { name: '切换浅色主题', exact: true }).click()
  await page
    .getByRole('navigation', { name: '网站导航' })
    .getByRole('link', { name: '首页', exact: true })
    .click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(errors).toEqual([])
})

test('Word 损坏图片明确失败且不留下载，正常图文文件仍可转换', async ({ page }) => {
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGN0S33BgA0wYRUdtBIAPicBo5sMNB0AAAAASUVORK5CYII=',
    'base64',
  )
  const docx = async (data: Buffer) =>
    Packer.toBuffer(
      new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun('Important diagram'),
                  new ImageRun({ type: 'png', data, transformation: { width: 120, height: 80 } }),
                ],
              }),
            ],
          },
        ],
      }),
    )
  await page.goto('/tools/#/files?mode=word-pdf')
  await page.getByLabel('选择待转换文件').setInputFiles([
    {
      name: 'broken.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await docx(Buffer.from('corrupt png')),
    },
    {
      name: 'good.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await docx(image),
    },
  ])
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  const broken = page.locator('.file-row').filter({ hasText: 'broken.docx' })
  await expect(broken.getByRole('alert')).toContainText('图片无法读取')
  await expect(broken.locator('a[download]')).toHaveCount(0)
  const good = page.locator('.file-row').filter({ hasText: 'good.docx' })
  await expect(good.locator('a[download]')).toBeVisible()
  await expect(
    page.getByText('文件队列：2 个文件，已完成 1 个，失败 1 个。', { exact: true }),
  ).toBeAttached()
})

test('大 CSV 在 Worker 解析并分批返回，导出保留完整行列及前导零', async ({ page }, info) => {
  const threads: string[] = []
  page.on('worker', (worker) => threads.push(worker.url()))
  await page.goto('/tools/#/table')
  await expect(page.getByRole('heading', { name: '表格批量处理', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const durations: number[] = []
    Object.assign(window, { csvLongTasks: durations })
    if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
      new PerformanceObserver((list) =>
        durations.push(...list.getEntries().map((entry) => Math.round(entry.duration))),
      ).observe({ type: 'longtask' })
  })
  const headers = Array.from({ length: 20 }, (_, index) => `col${index}`)
  const rows = Array.from({ length: 49998 }, (_, index) => [
    String(index).padStart(6, '0'),
    ...headers.slice(1).map((_, column) => `value${column + 1}`),
  ])
  const buffer = Buffer.from(Papa.unparse([headers, ...rows]))
  await page
    .getByLabel('添加表格文件', { exact: true })
    .setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer })
  await expect(page.getByText('结果 49998 行 × 20 列', { exact: true })).toBeVisible()
  expect(threads.some((url) => /\/tools\/_next\/static\/chunks\/.*csv\.worker\./.test(url))).toBe(
    true,
  )
  await info.attach('CSV import long tasks', {
    body: JSON.stringify(
      await page.evaluate(() => (window as unknown as { csvLongTasks: number[] }).csvLongTasks),
    ),
    contentType: 'application/json',
  })
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
  const link = page.locator('.table-tool a[download]')
  await expect(link).toBeVisible()
  const text = await page.evaluate(
    async (url) => (await fetch(url!)).text(),
    await link.getAttribute('href'),
  )
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, '')).data
  expect(result).toHaveLength(49999)
  expect(result[0]).toEqual(headers)
  expect(result[1]).toEqual(rows[0])
  expect(result.at(-1)).toEqual(rows.at(-1))
})

test('CSV 线程无法加载时提示失败并恢复操作，不丢弃已有表格', async ({ page }) => {
  await page.goto('/tools/#/table')
  const input = page.getByLabel('添加表格文件', { exact: true })
  await input.setInputFiles({
    name: 'good.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id,value\n001,保留'),
  })
  await expect(page.locator('.table-preview')).toContainText('保留')
  await page.route(/csv\.worker\.[^/]+\.js$/, (route) => route.abort())
  await input.setInputFiles({
    name: 'next.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id,value\n002,新数据'),
  })
  await expect(page.getByText(/无法加载 CSV 处理线程/)).toBeVisible()
  await expect(input).toBeEnabled()
  await expect(page.locator('.table-preview')).toContainText('保留')
  await expect(page.locator('.table-preview')).not.toContainText('新数据')
})

test('CSV 线程未响应时，30 秒后终止并恢复文件选择', async ({ page }) => {
  await page.goto('/tools/#/table')
  await expect(page.getByRole('heading', { name: '表格批量处理', exact: true })).toBeVisible()
  await page.clock.install()
  await page.evaluate(() => {
    Object.assign(window, { csvWorkerTerminated: false })
    Object.defineProperty(window, 'Worker', {
      value: class {
        postMessage() {}
        terminate() {
          Object.assign(window, { csvWorkerTerminated: true })
        }
      },
    })
  })
  const input = page.getByLabel('添加表格文件', { exact: true })
  await input.setInputFiles({
    name: 'waiting.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id\n001'),
  })
  await expect(input).toBeDisabled()
  await expect(page.getByText('正在读取或导出表格，请稍候。', { exact: true })).toBeVisible()
  await page.clock.fastForward(30_001)
  await expect(page.getByText(/CSV 读取超过 30 秒/)).toBeVisible()
  await expect(input).toBeEnabled()
  expect(
    await page.evaluate(
      () => (window as unknown as { csvWorkerTerminated: boolean }).csvWorkerTerminated,
    ),
  ).toBe(true)
  await expect(page.locator('.table-preview')).toHaveCount(0)
})
