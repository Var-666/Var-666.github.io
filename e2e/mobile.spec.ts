import { expect, test } from '@playwright/test'

// 390px 手机宽度核对：核心控件可达、无横向溢出（溢出是移动端最常见的回归）
test.use({ viewport: { width: 390, height: 844 } })

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    return { scrollWidth: root.scrollWidth, innerWidth: window.innerWidth }
  })
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1)
}

test('首页：工具卡片单列可达，任务入口完整显示', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '全部工具' })).toBeVisible()
  await expect(page.getByRole('link', { name: /比较两份表格差异/ })).toBeVisible()
  for (const title of [
    '文本整理',
    '文件格式转换',
    '表格对比',
    '表格批量处理',
    'PDF 页面整理',
    '批量重命名',
  ])
    await expect(page.locator('.tool-card', { hasText: title })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('文件工具：压缩模式选项换行展示，队列长文件名不断行溢出', async ({ page }) => {
  await page.goto('/#/files')
  await page.getByRole('tab', { name: '图片' }).click()
  await page.getByRole('button', { name: '图片压缩' }).click()
  await expect(page.getByRole('combobox', { name: '目标大小' })).toBeVisible()
  // 最小合法 PNG（1×1），扩展名必须满足压缩模式的 accept 校验
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.setInputFiles('input[type=file]', {
    name: '一个特别特别特别长的中文文件名用来测试换行行为是否正常.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await expect(page.locator('.file-row')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('文本工具：更多操作面板与批量替换控件在窄屏可用', async ({ page }) => {
  await page.goto('/#/text')
  await page.getByRole('button', { name: '更多操作' }).click()
  await expect(page.getByRole('textbox', { name: '第 1 条查找' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('表格对比：双栏折叠为单列，交换图标竖排', async ({ page }) => {
  await page.goto('/#/compare')
  const grid = page.locator('.compare-grid')
  await expect(grid).toBeVisible()
  const direction = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(direction.split(' ').length).toBe(1) // 单列
  await expectNoHorizontalOverflow(page)
})

test('PDF 整理与重命名：主控件在视口内且无横向溢出', async ({ page }) => {
  await page.goto('/#/pdf')
  await expect(page.getByRole('heading', { name: 'PDF 页面整理' })).toBeVisible()
  await expect(page.locator('.file-drop')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.goto('/#/rename')
  await expect(page.getByRole('heading', { name: '批量重命名' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '统一名称' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('表格批量处理：选项行换行且不溢出', async ({ page }) => {
  await page.goto('/#/table')
  await expect(page.getByRole('heading', { name: '表格批量处理' })).toBeVisible()
  await expect(page.getByRole('button', { name: '添加 CSV 文件（最多 10 个）' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
