import { expect, test } from '@playwright/test'

test('网站首页独立于工具箱，可以从入口进入工具箱', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'VAR', exact: true })).toBeVisible()
  await expect(page.locator('.app-shell')).toHaveCount(0)
  await page.getByRole('link', { name: '打开工具箱' }).click()
  await expect(page).toHaveURL(/\/tools\/$/)
  await expect(page.getByRole('heading', { name: '全部工具', exact: true })).toBeVisible()
})

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
  await expect(page.getByRole('heading', { name: 'VAR', exact: true })).toBeVisible()
})
