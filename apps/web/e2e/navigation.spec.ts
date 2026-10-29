import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('工具尚未加载时可继续切换，迟到的模块不抢焦点或丢失草稿', async ({ page }) => {
  let resume = () => {}
  const paused = new Promise<void>((resolve) => {
    resume = resolve
  })
  await page.route('**/_next/static/chunks/PdfTool.*.js', async (route) => {
    await paused
    await route.continue()
  })
  await page.goto('/tools/#/text')
  await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('保留我的草稿')
  const home = page
    .getByRole('navigation', { name: '网站导航' })
    .getByRole('link', { name: '工具箱', exact: true })
  try {
    await home.click()
    await page.locator('a.tool-card[href="#/pdf"]').click()
    await expect(
      page.getByRole('status', { name: '正在加载PDF 页面整理', exact: true }),
    ).toHaveText('')
    await home.click()
    await page.locator('a.tool-card[href="#/rename"]').click()
    const heading = page.getByRole('heading', { name: '批量重命名', exact: true })
    await expect(heading).toBeFocused()
    const finished = page.waitForEvent('requestfinished', (request) =>
      /\/PdfTool\.[^/]+\.js$/.test(request.url()),
    )
    resume()
    await finished
    await expect(heading).toBeFocused()
    await home.click()
    await page.locator('a.tool-card[href="#/text"]').click()
    await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
      '保留我的草稿',
    )
  } finally {
    resume()
  }
})

test('多工具往返复用模块与线程，并保留已生成的下载', async ({ page }) => {
  const scripts: string[] = [],
    workers: string[] = []
  page.on('request', (request) => {
    if (/\/(TextTool|FileTool|TableTool|PdfTool|RenameTool)\.[^/]+\.js$/.test(request.url()))
      scripts.push(request.url())
  })
  page.on('worker', (worker) => workers.push(worker.url()))
  await page.goto('/tools/#/files?mode=json-csv')
  await page
    .getByLabel('选择待转换文件')
    .setInputFiles({
      name: 'keep.json',
      mimeType: 'application/json',
      buffer: Buffer.from('[{"编号":"001"}]'),
    })
  const download = page.locator('.file-row a[download]')
  await expect(download).toBeVisible()
  const url = await download.getAttribute('href')
  const home = page
    .getByRole('navigation', { name: '网站导航' })
    .getByRole('link', { name: '工具箱', exact: true })
  for (const [id, heading] of [
    ['text', '文本整理'],
    ['table', '表格批量处理'],
    ['pdf', 'PDF 页面整理'],
    ['rename', '批量重命名'],
    ['text', '文本整理'],
  ]) {
    await home.click()
    await page.locator(`a.tool-card[href="#/${id}"]`).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    if (id === 'text') {
      await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('  keep   draft  ')
      await expect(page.getByRole('textbox', { name: '整理结果', exact: true })).toHaveValue(
        'keep draft',
      )
    }
  }
  await home.click()
  await page.locator('a.tool-card[href="#/files"]').click()
  await expect(download).toHaveAttribute('href', url!)
  expect(await page.evaluate(async (href) => (await fetch(href!)).text(), url)).toContain('001')
  expect(new Set(scripts).size).toBe(scripts.length)
  expect(workers.filter((url) => /\/text\.worker\./.test(url))).toHaveLength(1)
})

test('键盘聚焦入口预热代码但不挂载工具，进入后可直接使用', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/tools/')
  await expect(page.getByRole('heading', { name: '全部工具', exact: true })).toBeVisible()
  expect(requests.some((url) => /\/(TextTool|FileTool)\.[^/]+\.js$/.test(url))).toBe(false)
  const loaded = page.waitForEvent('requestfinished', (request) =>
    /\/TextTool\.[^/]+\.js$/.test(request.url()),
  )
  const card = page.locator('a.tool-card[href="#/text"]')
  await card.focus()
  await loaded
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveCount(0)
  expect(requests.some((url) => /\/FileTool\.[^/]+\.js$/.test(url))).toBe(false)
  await card.press('Enter')
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toBeVisible()
})

test('悬停预热失败不跳转或报错，网络恢复后点击仍可加载', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/_next/static/chunks/PdfTool.*.js', (route) => route.abort())
  await page.goto('/tools/')
  const failed = page.waitForEvent('requestfailed', (request) =>
    /\/PdfTool\.[^/]+\.js$/.test(request.url()),
  )
  const card = page.locator('a.tool-card[href="#/pdf"]')
  await card.hover()
  await failed
  await expect(page.getByRole('heading', { name: '全部工具', exact: true })).toBeVisible()
  await expect(page.locator('.tool-load-error')).toHaveCount(0)
  await page.unroute('**/_next/static/chunks/PdfTool.*.js')
  await card.click()
  await expect(page.getByRole('heading', { name: 'PDF 页面整理', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
