import { expect, test, type Page } from '@playwright/test'

async function openSettings(page: Page) {
  await page.getByRole('button', { name: '全部设置' }).click()
  await expect(page.getByRole('heading', { name: /整理设置/ })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tools/#/text')
  await expect(page.getByRole('heading', { name: '文本整理' })).toBeVisible()
})

test('自定义预设：保存 → 刷新 → 应用生效 → 删除后消失', async ({ page }) => {
  // 关掉「首尾空格」制造一个可辨识的规则组合
  await page.getByRole('switch', { name: '清理首尾空格' }).click()
  await openSettings(page)
  await page.getByRole('textbox', { name: '预设名称' }).fill('我的日报')
  await page.getByRole('button', { name: '保存当前规则' }).click()
  await expect(page.getByText('已保存自定义预设「我的日报」')).toBeVisible()
  // 本地只存规则，不存正文
  const stored = await page.evaluate(() => localStorage.getItem('var-user-presets'))
  const parsed = JSON.parse(stored ?? '[]')
  expect(parsed[0].name).toBe('我的日报')
  expect(Object.keys(parsed[0])).toEqual(
    expect.arrayContaining(['id', 'name', 'preset', 'options']),
  )
  // 刷新后预设仍在，应用后开关保持关闭
  await page.reload()
  const chip = page.getByRole('button', { name: '应用自定义预设 我的日报' })
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(page.getByRole('switch', { name: '清理首尾空格' })).not.toBeChecked()
  // 删除后刷新仍不存在
  await openSettings(page)
  await page.getByRole('button', { name: '删除自定义预设 我的日报' }).click()
  await expect(page.getByRole('button', { name: '应用自定义预设 我的日报' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: /应用自定义预设/ })).toHaveCount(0)
})

test('文件工具参数记忆：压缩目标刷新后保留', async ({ page }) => {
  await page.goto('/tools/#/files')
  await page.getByRole('tab', { name: '表格' }).isVisible()
  await page.getByRole('tab', { name: '图片' }).click()
  await page.getByRole('button', { name: '图片压缩' }).click()
  await page.getByRole('combobox', { name: '目标大小' }).click()
  await page.getByRole('option', { name: '500 KB' }).click()
  // 等待 300ms 防抖写入
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.getByRole('heading', { name: '文件格式转换' })).toBeVisible()
  await page.getByRole('tab', { name: '图片' }).click()
  await page.getByRole('button', { name: '图片压缩' }).click()
  await expect(page.getByRole('combobox', { name: '目标大小' })).toContainText('500 KB')
})
