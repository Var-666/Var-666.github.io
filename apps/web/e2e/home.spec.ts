import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tools/')
  await expect(page.getByRole('heading', { name: '全部工具' })).toBeVisible()
})

test('搜索命中任务入口并直达图片压缩模式', async ({ page }) => {
  await page.getByRole('searchbox', { name: '搜索工具' }).fill('压缩')
  const task = page.getByRole('link', { name: '压缩图片到指定大小' })
  await expect(task).toBeVisible()
  await task.click()
  await expect(page.getByRole('region', { name: '图片压缩' })).toBeVisible()
})

test('搜索无结果时给出提示，关键词分词后命中工具卡片', async ({ page }) => {
  await page.getByRole('searchbox', { name: '搜索工具' }).fill('不存在的功能')
  await expect(page.getByText('没有找到匹配的工具')).toBeVisible()
  await page.getByRole('searchbox', { name: '搜索工具' }).fill('提取 页面')
  await expect(page.locator('.tool-card').filter({ hasText: 'PDF 页面整理' })).toBeVisible()
  await expect(page.locator('.tool-card').filter({ hasText: '文本整理' })).toHaveCount(0)
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
