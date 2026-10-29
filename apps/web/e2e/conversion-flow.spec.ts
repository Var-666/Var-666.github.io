import { expect, test, type Page } from '@playwright/test'

const row = (page: Page, name: string) => page.locator('.file-row').filter({ hasText: name })
async function encoding(page: Page, value: string) {
  await page.getByRole('combobox', { name: '读取编码', exact: true }).click()
  await page.getByRole('option', { name: value, exact: true }).click()
}

test('自动转换逐项保留成功结果；追加只处理新文件，失败不循环且可重试', async ({ page }) => {
  await page.addInitScript(() => {
    const reads: Record<string, number> = {}
    Object.assign(window, { conversionReads: reads })
    const original = File.prototype.arrayBuffer
    File.prototype.arrayBuffer = function () {
      reads[this.name] = (reads[this.name] ?? 0) + 1
      return original.call(this)
    }
  })
  const readCount = () =>
    page.evaluate(
      () => (window as unknown as { conversionReads: Record<string, number> }).conversionReads,
    )
  await page.goto('/tools/#/files?mode=json-csv')
  await page.getByLabel('选择待转换文件').setInputFiles([
    { name: 'good.json', mimeType: 'application/json', buffer: Buffer.from('[{"编号":"001"}]') },
    { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') },
  ])
  await expect(row(page, 'good.json').locator('a[download]')).toBeVisible()
  await expect(row(page, 'bad.json').getByRole('alert')).toBeVisible()
  const original = await row(page, 'good.json').locator('a[download]').getAttribute('href')
  await expect(page.getByRole('button', { name: '重试失败项', exact: true })).toBeEnabled()
  expect(await readCount()).toEqual({ 'good.json': 1, 'bad.json': 1 })
  await page.getByLabel('选择待转换文件').setInputFiles({
    name: 'new.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[{"编号":"002"}]'),
  })
  await expect(row(page, 'new.json').locator('a[download]')).toBeVisible()
  await expect(page.getByRole('button', { name: '重试失败项', exact: true })).toBeEnabled()
  expect(await row(page, 'good.json').locator('a[download]').getAttribute('href')).toBe(original)
  expect(await readCount()).toEqual({ 'good.json': 1, 'bad.json': 1, 'new.json': 1 })
  await page.getByRole('button', { name: '重试失败项', exact: true }).click()
  await expect(page.getByRole('button', { name: '重试失败项', exact: true })).toBeEnabled()
  // 等过一次重渲染窗口，确认错误状态没有触发自动重试循环。
  await page.waitForTimeout(250)
  expect(await readCount()).toEqual({ 'good.json': 1, 'bad.json': 2, 'new.json': 1 })
  await expect(page.locator('.conversion-auto')).toHaveText('已完成 2 个，失败 1 个')
  await page.getByRole('button', { name: '移除 bad.json', exact: true }).click()
  await expect(page.locator('.conversion-auto')).toHaveText('已完成 2 个文件')
  await expect(page.getByRole('button', { name: '开始转换' })).toHaveCount(0)
})

test('后台队列在换模式确认时不启动，取消后自动处理原文件', async ({ page }) => {
  await page.goto('/tools/#/files?mode=json-csv')
  await expect(page.getByLabel('选择待转换文件')).toBeAttached()
  await page.evaluate(() => {
    location.hash = '#/'
  })
  // 隐藏工具的待处理队列，模拟离开页面后返回时仍有待处理文件。
  await page.getByLabel('选择待转换文件').setInputFiles({
    name: 'queued.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[{"编号":"001"}]'),
  })
  await page.evaluate(() => {
    location.hash = '#/files?mode=image'
  })
  await expect(page.getByRole('dialog', { name: '导入新任务' })).toBeVisible()
  await expect(page.locator('.file-row a[download]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '切换并导入', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '保留当前内容', exact: true }).click()
  await expect(page.locator('.file-row a[download]')).toBeVisible()
  const url = await page.locator('.file-row a[download]').getAttribute('href')
  expect(await page.evaluate(async (url) => (await fetch(url!)).text(), url)).toContain('001')
})

test('编码变化撤销旧链接并自动重读，错误不会残留旧结果', async ({ page }) => {
  await page.goto('/tools/#/files?mode=csv-json')
  await page.getByLabel('选择待转换文件').setInputFiles({
    name: '中文.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('b1e0bac52cc3fbb3c60a3030312cd6d0cec40a', 'hex'),
  })
  const link = page.locator('.file-row a[download]')
  await expect(link).toBeVisible()
  const oldUrl = await link.getAttribute('href')
  await page.getByText('高级设置与说明', { exact: true }).click()
  await encoding(page, 'UTF-8')
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    '无法按 UTF-8',
  )
  await expect(link).toHaveCount(0)
  expect(
    await page.evaluate(async (url) => {
      try {
        await fetch(url!)
        return false
      } catch {
        return true
      }
    }, oldUrl),
  ).toBe(true)
  await encoding(page, 'GBK / GB18030')
  await expect(link).toBeVisible()
  expect(
    await page.evaluate(async (url) => (await fetch(url!)).json(), await link.getAttribute('href')),
  ).toEqual([{ 编号: '001', 名称: '中文' }])
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0)
})

for (const theme of ['light', 'dark'] as const)
  test(`次要参数默认收起，图片仍手动转换；390px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/files')
    await expect(page.getByRole('combobox', { name: '输出格式', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: '图片尺寸', exact: true })).toBeHidden()
    await page.getByLabel('选择待转换文件').setInputFiles({
      name: 'tiny.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGN0S33BgA0wYRUdtBIAPicBo5sMNB0AAAAASUVORK5CYII=',
        'base64',
      ),
    })
    await expect(page.getByRole('button', { name: '开始转换', exact: true })).toBeEnabled()
    await expect(page.locator('a[download]')).toHaveCount(0)
    await page.getByRole('button', { name: '开始转换', exact: true }).click()
    await expect(page.locator('a[download]')).toBeVisible()
    await page.getByText('高级设置与说明', { exact: true }).click()
    await page.getByRole('combobox', { name: '图片尺寸', exact: true }).click()
    await page.getByRole('option', { name: '缩放 50%', exact: true }).click()
    await expect(page.locator('a[download]')).toHaveCount(0)
    await expect(row(page, 'tiny.png')).toContainText('设置已更改，待重新转换')
    await page.getByRole('button', { name: '开始转换', exact: true }).click()
    await expect(page.locator('a[download]')).toBeVisible()
    const url = await page.locator('a[download]').getAttribute('href')
    expect(
      await page.evaluate(async (url) => {
        const bitmap = await createImageBitmap(await (await fetch(url!)).blob())
        const size = [bitmap.width, bitmap.height]
        bitmap.close()
        return size
      }, url),
    ).toEqual([4, 4])
    await page.addStyleTag({
      content: '*,*::before,*::after { transition: none !important; animation: none !important }',
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath('conversion-flow-mobile.png'), fullPage: true })
  })
