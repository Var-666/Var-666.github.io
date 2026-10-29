import { expect, test } from '@playwright/test'

for (const width of [1033, 390]) {
  test(`${width}px: 网站导航在首页和工具箱之间切换，当前栏目明确`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '欢迎来到 VAR。', exact: true })).toBeVisible()
    await expect(page.locator('.app-shell')).toHaveCount(0)
    const navigation = page.getByRole('navigation', { name: '网站导航' })
    await expect(navigation.getByRole('link', { name: '首页', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await navigation.getByRole('link', { name: '工具箱', exact: true }).click()
    await expect(page).toHaveURL(/\/tools\/$/)
    await expect(page.getByRole('heading', { name: '全部工具', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: '工具箱', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await page
      .locator('.tool-card')
      .filter({ has: page.getByRole('heading', { name: '文本整理', exact: true }) })
      .click()
    await page
      .getByRole('textbox', { name: '原始文本', exact: true })
      .fill('通过网站导航返回也保留草稿')
    await navigation.getByRole('link', { name: '工具箱', exact: true }).click()
    await expect(page.getByRole('heading', { name: '全部工具', exact: true })).toBeVisible()
    await page
      .locator('.tool-card')
      .filter({ has: page.getByRole('heading', { name: '文本整理', exact: true }) })
      .click()
    await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
      '通过网站导航返回也保留草稿',
    )
    page.once('dialog', (dialog) => dialog.accept())
    await navigation.getByRole('link', { name: '首页', exact: true }).click()
    await expect(page.getByRole('heading', { name: '欢迎来到 VAR。', exact: true })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow).toBe(false)
  })
}

test('既有工具地址转到 tools 路径并保留模式参数', async ({ page }) => {
  await page.goto('/#/files?mode=image-compress')
  await expect(page).toHaveURL(/\/tools\/#\/files\?mode=image-compress$/)
  await expect(page.getByRole('region', { name: '图片压缩' })).toBeVisible()
})

test('工具的离线服务只控制 tools 路径，网站首页不被接管', async ({ page }) => {
  await page.goto('/tools/')
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toMatch(/\/tools\/sw\.js$/)
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(new URL(scope).pathname).toBe('/tools/')
  await page.goto('/')
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull()
  await expect(page.getByRole('heading', { name: '欢迎来到 VAR。', exact: true })).toBeVisible()
})
