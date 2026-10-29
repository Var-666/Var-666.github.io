import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const original = (page: Page) => page.getByRole('textbox', { name: '原始文本', exact: true })
async function extras(page: Page, panel: string) {
  await page.getByRole('button', { name: '更多操作', exact: true }).click()
  await page
    .locator('summary')
    .filter({ hasText: new RegExp('^' + panel + '$') })
    .click()
}
async function select(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('四类预设从原文提取；正则捕获保留001，应用可撤销且不持久化正文', async ({ page }) => {
  await page.goto('/tools/#/text')
  await original(page).fill(
    'a@example.com a@example.com 13800138000 https://example.com/a 11010519491231002X',
  )
  await extras(page, '内容提取')
  for (const [type, value] of [
    ['邮箱', 'a@example.com'],
    ['手机号', '13800138000'],
    ['网址', 'https://example.com/a'],
    ['身份证', '11010519491231002X'],
  ]) {
    await select(page, '提取类型', type)
    await page.getByRole('button', { name: '开始提取', exact: true }).click()
    await expect(page.getByLabel('提取结果预览')).toHaveText(value)
  }
  await original(page).fill('编号：001；编号：002')
  await select(page, '提取类型', '自定义正则')
  await page.getByLabel('提取正则表达式').fill('编号：(\\d+)')
  await page.getByRole('switch', { name: '仅提取第一个捕获组', exact: true }).click()
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.getByLabel('提取结果预览')).toHaveText('001\n002')
  await page.getByRole('button', { name: '应用提取结果', exact: true }).click()
  await expect(original(page)).toHaveValue('001\n002')
  await page.getByRole('button', { name: '撤销上次替换或清空', exact: true }).click()
  await expect(original(page)).toHaveValue('编号：001；编号：002')
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('编号：001')
})

test('非法正则/灾难回溯停止后可继续提取，不覆盖正文', async ({ page }) => {
  await page.goto('/tools/#/text')
  await original(page).fill('a'.repeat(30_000) + '!')
  await extras(page, '内容提取')
  await select(page, '提取类型', '自定义正则')
  await page.getByLabel('提取正则表达式').fill('[')
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    '正则表达式或标志无效',
  )
  await page.getByLabel('提取正则表达式').fill('(a+)+$')
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    '处理超时',
    {
      timeout: 5000,
    },
  )
  await expect(original(page)).toHaveValue('a'.repeat(30_000) + '!')
  await original(page).fill('恢复：ok@example.com')
  await select(page, '提取类型', '邮箱')
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.getByLabel('提取结果预览')).toHaveText('ok@example.com')
  await original(page).fill('a'.repeat(30_000) + '!')
  await select(page, '提取类型', '自定义正则')
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.getByRole('button', { name: '正在提取…', exact: true })).toBeDisabled()
  await original(page).fill('final@example.com')
  await select(page, '提取类型', '邮箱')
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.getByLabel('提取结果预览')).toHaveText('final@example.com')
  // 等过被取消请求的截止时间，旧超时不能覆盖新预览。
  await page.waitForTimeout(1700)
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0)
  await expect(page.getByLabel('提取结果预览')).toHaveText('final@example.com')
})

test('Worker加载失败明确报错；重试可恢复，不执行主线程正则降级', async ({ page }) => {
  await page.route('**/_next/static/chunks/text-extra.worker.*.js', (route) => route.abort())
  await page.goto('/tools/#/text')
  await original(page).fill('a@example.com')
  await extras(page, '内容提取')
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    '处理线程加载失败',
  )
  await expect(page.getByRole('button', { name: '应用提取结果', exact: true })).toHaveCount(0)
  await page.unroute('**/_next/static/chunks/text-extra.worker.*.js')
  await page.getByRole('button', { name: '开始提取', exact: true }).click()
  await expect(page.getByLabel('提取结果预览')).toHaveText('a@example.com')
})

test('任意两段独立对比并高亮；输入变化清结果，收起操作保留草稿，超限不截断', async ({ page }) => {
  await page.goto('/tools/#/text')
  await original(page).fill('主编辑器保持不变')
  await extras(page, '任意文本对比')
  await page.getByLabel('对比旧文本').fill('第一行\n  编号001\n删除行')
  await page.getByLabel('对比新文本').fill('第一行\n编号002\n新增行')
  await page.getByRole('button', { name: '比较两段文本', exact: true }).click()
  await expect(page.getByLabel('独立对比结果')).toBeVisible()
  await expect(page.getByLabel('旧文本差异')).toHaveText('第一行\n  编号001\n删除行')
  await expect(page.getByLabel('新文本差异')).toHaveText('第一行\n编号002\n新增行')
  expect(await page.getByLabel('旧文本差异').locator('.diff-del').count()).toBeGreaterThan(0)
  expect(await page.getByLabel('新文本差异').locator('.diff-ins').count()).toBeGreaterThan(0)
  await expect(original(page)).toHaveValue('主编辑器保持不变')
  await page.getByRole('button', { name: '更多操作', exact: true }).click()
  await page.getByRole('button', { name: '更多操作', exact: true }).click()
  await expect(page.getByLabel('对比旧文本')).toHaveValue('第一行\n  编号001\n删除行')
  await page.getByLabel('对比新文本').fill('同文')
  await expect(page.getByLabel('独立对比结果')).toHaveCount(0)
  await page.getByLabel('对比旧文本').fill('同文')
  await page.getByRole('button', { name: '比较两段文本', exact: true }).click()
  await expect(page.getByText('两段文本完全一致', { exact: true })).toBeVisible()
  await page.getByLabel('对比旧文本').fill('x'.repeat(200_001))
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    '合计最多 20 万字符',
  )
  await expect(page.getByRole('button', { name: '比较两段文本', exact: true })).toBeDisabled()
  await expect(page.getByLabel('对比旧文本')).toHaveValue('x'.repeat(200_001))
})

test('OpenCC词汇转换实际应用和撤销，切换方向不会沿用旧预览', async ({ page }) => {
  await page.goto('/tools/#/text')
  await original(page).fill('头发，理发，发展，后台；自行车和软件 001')
  await extras(page, '简繁转换')
  await page.getByRole('button', { name: '开始简繁转换', exact: true }).click()
  await expect(page.getByLabel('简繁转换预览')).toHaveText(
    '頭髮，理髮，發展，後臺；自行車和軟件 001',
  )
  await select(page, '简繁转换方向', '简体 → 台湾常用词')
  await expect(page.getByLabel('简繁转换预览')).toHaveCount(0)
  await page.getByRole('button', { name: '开始简繁转换', exact: true }).click()
  await expect(page.getByLabel('简繁转换预览')).toContainText('腳踏車和軟體 001')
  await page.getByRole('button', { name: '应用简繁转换', exact: true }).click()
  await expect(original(page)).toHaveValue('頭髮，理髮，發展，後臺；腳踏車和軟體 001')
  await page.getByRole('button', { name: '撤销上次替换或清空', exact: true }).click()
  await expect(original(page)).toHaveValue('头发，理发，发展，后台；自行车和软件 001')
})

for (const theme of ['light', 'dark'] as const)
  test(`390px ${theme}：对比结果和详细中英统计可读、键盘可关闭`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/text')
    await original(page).fill('你𠀀😀 Hello-world, café!\n\n第二段。')
    await page.getByRole('button', { name: '原始文本详细统计', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '原始文本详细统计', exact: true })
    for (const [label, number] of [
      ['全部字符', '28'],
      ['汉字', '5'],
      ['英文单词', '2'],
      ['标点', '4'],
      ['段落', '2'],
    ]) {
      await expect(
        dialog
          .locator('.text-stats-grid > div')
          .filter({ has: page.locator('dt').filter({ hasText: new RegExp('^' + label + '$') }) })
          .locator('dd'),
      ).toHaveText(number)
    }
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important}',
    })
    await page.screenshot({ path: info.outputPath('text-statistics-mobile.png') })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await extras(page, '任意文本对比')
    await page.getByLabel('对比旧文本').fill('编号001 原稿')
    await page.getByLabel('对比新文本').fill('编号002 修改稿')
    await page.getByRole('button', { name: '比较两段文本', exact: true }).click()
    await expect(page.getByLabel('独立对比结果')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await page.getByLabel('独立对比结果').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('text-extra-mobile.png') })
    await page.getByRole('tab', { name: '整理结果', exact: true }).click()
    await page.getByRole('button', { name: '整理结果详细统计', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '整理结果详细统计', exact: true })).toBeVisible()
  })
