import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tools/')
  await expect(page.getByRole('heading', { name: '全部工具' })).toBeVisible()
})

test('工具首页只保留网站导航、导入区和五个工具入口', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: '网站导航' })).toBeVisible()
  await expect(page.locator('.site-header')).toHaveCount(0)
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '常见任务', exact: true })).toHaveCount(0)
  await expect(page.locator('.tool-card')).toHaveCount(5)
  await expect(page.getByText('5 个工具', { exact: true })).toBeVisible()
  await expect(
    page
      .locator('.tool-card')
      .filter({ has: page.getByRole('heading', { name: '表格工具', exact: true }) }),
  ).toHaveCount(1)
})

test('统一表格入口可切换两个模式，返回后批量导入草稿保留', async ({ page }) => {
  await page
    .locator('.tool-card')
    .filter({ has: page.getByRole('heading', { name: '表格工具', exact: true }) })
    .click()
  await expect(page.getByRole('heading', { name: '表格批量处理', exact: true })).toBeVisible()
  await page.getByLabel('添加表格文件', { exact: true }).setInputFiles({
    name: 'draft.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('编号,名称\n001,甲'),
  })
  await expect(page.locator('.table-file-row')).toContainText('draft.csv')
  await page.getByRole('tab', { name: '表格对比', exact: true }).click()
  await expect(page.getByRole('heading', { name: '表格对比', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '批量处理', exact: true }).click()
  await expect(page.locator('.table-file-row')).toContainText('draft.csv')
})

test('收藏工具保存到本地，刷新后仍在常用区', async ({ page }) => {
  await page.getByRole('button', { name: '收藏批量重命名' }).click()
  await expect(page.getByRole('heading', { name: '常用工具' })).toBeVisible()
  // 本地只保存工具 id，不含任何正文或文件内容
  const stored = await page.evaluate(() => localStorage.getItem('var-favorite-tools'))
  expect(JSON.parse(stored ?? '[]')).toEqual(['rename'])
  await page.reload()
  await expect(page.getByRole('heading', { name: '常用工具' })).toBeVisible()
  await expect(page.getByRole('button', { name: '取消收藏批量重命名' })).toBeVisible()
  await page.getByRole('button', { name: '取消收藏批量重命名' }).click()
  await expect(page.getByRole('heading', { name: '常用工具' })).toHaveCount(0)
})

test('打开过的工具出现在最近使用', async ({ page }) => {
  await page.locator('.tool-card').filter({ hasText: 'PDF 页面整理' }).click()
  await expect(page).toHaveURL(/#\/pdf$/)
  // 面包屑只在进入工具后渲染，等待它确认 React 已处理导航（避免 URL 与状态间的竞态）
  await expect(page.locator('.tool-breadcrumb')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '全部工具' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '最近使用' })).toBeVisible()
  await expect(page.locator('.task-chip').filter({ hasText: 'PDF 页面整理' }).first()).toBeVisible()
})
