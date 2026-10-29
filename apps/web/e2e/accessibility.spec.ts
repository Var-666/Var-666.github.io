import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { openTool } from './helpers/navigation'
import { modes } from '../src/features/toolbox/files/modes'

const csv = (name = '明细.csv', text = '编号,名称,数量\n001,办公用品,1\n002,中文,2') => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(text),
})

async function audit(page: Page, theme: 'light' | 'dark') {
  if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
  else await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('body')).toHaveCSS(
    'color',
    theme === 'dark' ? 'rgb(228, 232, 242)' : 'rgb(37, 43, 57)',
  )
  await expect(page.locator('h1:visible')).toHaveCSS(
    'color',
    theme === 'dark' ? 'rgb(228, 232, 242)' : 'rgb(37, 43, 57)',
  )
  // WebKit 需完成主题重绘，避免在切换帧采到旧的继承色。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    results.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    })),
  ).toEqual([])
}

const routes = [
  ['/', '欢迎来到 VAR。'],
  ['/tools/', '全部工具'],
  ['/tools/#/text', '文本整理'],
  ['/tools/#/files', '文件格式转换'],
  ['/tools/#/table', '表格批量处理'],
  ['/tools/#/compare', '表格对比'],
  ['/tools/#/pdf', 'PDF 页面整理'],
  ['/tools/#/rename', '批量重命名'],
] as const

for (const theme of ['light', 'dark'] as const) {
  for (const [url, heading] of routes) {
    test(`${theme}: ${heading} WCAG 2.2 AA 自动检查`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(url)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      if (heading === '全部工具')
        await page.getByRole('button', { name: '收藏文本整理', exact: true }).click()
      await audit(page, theme)
    })
  }
  test(`${theme}: 文本输入、更多操作与设置弹窗`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/text')
    await page
      .getByRole('textbox', { name: '原始文本', exact: true })
      .fill('  无障碍   检查\n第二行')
    await expect(page.getByText('整理完成', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /^修改明细/ }).click()
    await expect(page.locator('.diff-record').first()).toBeVisible()
    await page.getByRole('button', { name: /^更多操作/ }).click()
    await page.getByLabel('添加批量文本文件', { exact: true }).setInputFiles([
      { name: '一.txt', mimeType: 'text/plain', buffer: Buffer.from('  一   二') },
      { name: '二.txt', mimeType: 'text/plain', buffer: Buffer.from('  三   四') },
    ])
    await page.getByRole('button', { name: '开始处理', exact: true }).click()
    await expect(page.locator('.batch-state.state-done')).toHaveCount(2)
    await expect(page.getByRole('status').filter({ hasText: /^批量文本队列/ })).toContainText(
      '完成 2 个',
    )
    await page.getByRole('combobox', { name: '读取编码', exact: true }).click()
    await expect(page.getByRole('listbox')).toBeVisible()
    await expect(page.locator('.website-header')).toHaveAttribute('inert', '')
    expect(
      await page.getByRole('listbox').evaluate((element) => getComputedStyle(element).maxHeight),
    ).not.toBe('none')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: 'UTF-8', exact: true })).toBeFocused()
    await audit(page, theme)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.locator('.website-header')).not.toHaveAttribute('inert', '')
    await expect(page.getByRole('combobox', { name: '读取编码', exact: true })).toBeFocused()
    await audit(page, theme)
    await page.getByRole('button', { name: '全部设置' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page, theme)
    await page.getByRole('button', { name: '完成', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '全部设置' })).toBeFocused()
  })
  test(`${theme}: 表格处理与对比结果`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/table')
    await page.getByLabel('添加表格文件', { exact: true }).setInputFiles(csv())
    await expect(page.locator('.table-preview')).toBeVisible()
    for (const name of ['启用去重', '启用筛选', '启用列操作'])
      await page.getByRole('switch', { name, exact: true }).click()
    await page.getByText('列改名和顺序', { exact: true }).click()
    await audit(page, theme)
    await page.getByRole('tab', { name: '表格对比', exact: true }).click()
    await page.getByLabel('选择旧表（左）文件', { exact: true }).setInputFiles(csv('旧表.csv'))
    await page
      .getByLabel('选择新表（右）文件', { exact: true })
      .setInputFiles(csv('新表.csv', '编号,名称,数量\n001,办公用品,3\n003,新增,4'))
    await expect(page.getByText('修改 1', { exact: true })).toBeVisible()
    await audit(page, theme)
  })
  test(`${theme}: 文件转换结果与全局文件任务弹窗`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/files?mode=csv-excel')
    await page.getByLabel('选择待转换文件', { exact: true }).setInputFiles(csv())
    await expect(page.locator('.matrix-table')).toBeVisible()
    await page.getByRole('button', { name: '开始转换', exact: true }).click()
    await expect(page.locator('.file-row a[download]')).toBeVisible()
    await audit(page, theme)
    await page.locator('.file-row').getByRole('button', { name: '继续处理', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '你想做什么？' })).toBeVisible()
    await audit(page, theme)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
  test(`${theme}: PDF 页码、水印和键盘排序`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/pdf')
    const document = await PDFDocument.create()
    document.addPage().drawText('Page one')
    document.addPage().drawText('Page two')
    await page.locator('input[type=file]').setInputFiles({
      name: '检查.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await document.save()),
    })
    await expect(page.locator('.pdf-page')).toHaveCount(2)
    await page.getByRole('button', { name: '下移页面 1', exact: true }).press('Enter')
    await expect(page.locator('.pdf-page-origin').first()).toContainText('原第 2 页')
    await page.getByText('页码与水印', { exact: true }).click()
    await page.getByRole('switch', { name: '添加 PDF 页码', exact: true }).click()
    await page.getByRole('textbox', { name: 'PDF 水印文字', exact: true }).fill('检查')
    await audit(page, theme)
    await page.getByRole('button', { name: '放大页面 1', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page, theme)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '放大页面 1', exact: true })).toBeFocused()
  })
  test(`${theme}: 批量重命名预览与错误提示`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/rename')
    await page.getByLabel('选择需要重命名的文件', { exact: true }).setInputFiles(csv())
    await expect(page.locator('.rename-table tbody tr')).toHaveCount(1)
    await audit(page, theme)
    await page
      .getByRole('textbox', { name: '新文件名 明细.csv', exact: true })
      .fill('不合法/文件.csv')
    await expect(
      page.getByRole('textbox', { name: '新文件名 明细.csv', exact: true }),
    ).toHaveAttribute('aria-invalid', 'true')
    await audit(page, theme)
  })
  test(`${theme}: 文件转换全部模式与展开设置`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    for (const [mode, meta] of Object.entries(modes)) {
      await page.goto(`/tools/#/files?mode=${mode}`)
      await expect(page.getByRole('region', { name: meta.title, exact: true })).toBeVisible()
      await page.locator('details > summary').evaluateAll((elements) => {
        for (const element of elements) (element as HTMLElement).click()
      })
      await audit(page, theme)
    }
  })
}

test('跳过导航、工具焦点、表格标签方向键与草稿离开保护', async ({ page, browserName }) => {
  await page.goto('/tools/')
  await expect(page.getByRole('heading', { name: '全部工具', exact: true })).toBeVisible()
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
  await expect(page.getByRole('link', { name: '跳到主要内容', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await page.locator('.tool-card').filter({ hasText: '文本整理' }).press('Enter')
  await expect(page.getByRole('heading', { name: '文本整理', exact: true })).toBeFocused()
  await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('不要丢失的草稿')
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm')
    await dialog.dismiss()
  })
  await page
    .getByRole('navigation', { name: '网站导航' })
    .getByRole('link', { name: '首页', exact: true })
    .click()
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
    '不要丢失的草稿',
  )
  await openTool(page, '表格批量处理')
  await page.getByRole('tab', { name: '批量处理', exact: true }).press('ArrowRight')
  await expect(page.getByRole('tab', { name: '表格对比', exact: true })).toBeFocused()
  await expect(page.getByRole('heading', { name: '表格对比', exact: true })).toBeVisible()
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm')
    await dialog.accept()
  })
  await page
    .getByRole('navigation', { name: '网站导航' })
    .getByRole('link', { name: '首页', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: '欢迎来到 VAR。', exact: true })).toBeVisible()
})

test('320px 重排与文本间距调整后，所有入口无页面横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  for (const [url, heading] of routes) {
    await page.goto(url)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await page.addStyleTag({
      content:
        '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}',
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      heading,
    ).toBeLessThanOrEqual(1)
  }
})

for (const theme of ['light', 'dark'] as const) {
  test(`320px ${theme}: 导入后的表格、文本与弹窗可操作`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/table')
    await page.getByLabel('添加表格文件', { exact: true }).setInputFiles(csv())
    await expect(page.locator('.table-preview')).toBeVisible()
    await page.getByRole('switch', { name: '启用列操作', exact: true }).click()
    await page.getByText('列改名和顺序', { exact: true }).click()
    await audit(page, theme)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await openTool(page, '文本整理')
    await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('  手机上  处理的文本')
    await page.getByRole('button', { name: '全部设置' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await audit(page, theme)
    await page.getByRole('button', { name: '完成', exact: true }).focus()
    expect(
      await page.getByRole('button', { name: '完成', exact: true }).evaluate((e) => {
        const r = e.getBoundingClientRect()
        return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth
      }),
    ).toBe(true)
    await page.screenshot({ path: info.outputPath(`${theme}-mobile-settings.png`) })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: '全部设置' })).toBeFocused()
  })
}

test('刷新有草稿时提示，取消保留内容；清空后无需离开提示', async ({ page }) => {
  await page.goto('/tools/#/text')
  const source = page.getByRole('textbox', { name: '原始文本', exact: true })
  await source.fill('需要保留的内容')
  const dialog = page.waitForEvent('dialog')
  const reload = page.evaluate(() => window.location.reload())
  const confirmation = await dialog
  expect(confirmation.type()).toBe('beforeunload')
  await confirmation.dismiss()
  await reload
  await expect(source).toHaveValue('需要保留的内容')
  await source.fill('')
  await page
    .getByRole('navigation', { name: '网站导航' })
    .getByRole('link', { name: '首页', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: '欢迎来到 VAR。', exact: true })).toBeVisible()
})
