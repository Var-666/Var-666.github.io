import { expect, test, type Page } from '@playwright/test'

const routes = [
  ['', '全部工具'],
  ['text', '文本整理'],
  ['files', '文件格式转换'],
  ['compare', '表格对比'],
  ['table', '表格批量处理'],
  ['pdf', 'PDF 页面整理'],
  ['rename', '批量重命名'],
] as const

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
}

for (const width of [1440, 800, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${width}px ${theme}: 全工具布局与编辑器高亮排版契约`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      for (const [route, title] of routes) {
        await page.goto(`/tools/#/${route}`)
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
        await expect(
          page.getByRole('button', { name: theme === 'dark' ? '切换浅色主题' : '切换深色主题' }),
        ).toBeVisible()
        await noOverflow(page)
        if (!route) {
          const collisions = await page.locator('.tool-card-wrap').evaluateAll(
            (cards) =>
              cards.filter((card) => {
                const a = card.querySelector('h2 svg')!.getBoundingClientRect()
                const b = card.querySelector('.tool-favorite')!.getBoundingClientRect()
                return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
              }).length,
          )
          expect(collisions).toBe(0)
        }
        if (width > 650) {
          const nav = page.getByRole('navigation', { name: '主导航' })
          await expect(nav).toBeVisible()
          expect(await nav.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1)
        }
        if (route === 'text') {
          await page
            .getByRole('textbox', { name: '原始文本', exact: true })
            .fill(
              '  中文 English 123   排版对齐\n\n第二行   需要整理\n' +
                '长行换行测试 abc  '.repeat(35),
            )
          await expect(page.locator('.diff-overlay .diff-del').first()).toBeAttached()
          await page
            .getByRole('textbox', { name: '原始文本', exact: true })
            .press('ControlOrMeta+Home')
          const mismatches = await page.locator('.editor-body').evaluateAll((bodies) =>
            bodies.flatMap((body) => {
              const editor = body.querySelector('.text-editor'),
                overlay = body.querySelector('.diff-overlay')
              if (!editor || !overlay) return []
              const a = getComputedStyle(editor),
                b = getComputedStyle(overlay)
              const properties = [
                'padding',
                'font-size',
                'line-height',
                'font-family',
                'white-space',
                'overflow-wrap',
              ]
              return properties.filter((p) => a.getPropertyValue(p) !== b.getPropertyValue(p))
            }),
          )
          expect(mismatches).toEqual([])
          await noOverflow(page)
        }
        await page.screenshot({ path: info.outputPath(`${route || 'home'}.png`), fullPage: true })
      }
    })
  }
}

test('编辑器断点两侧持续保持一致，导航不挤压主题按钮', async ({ page }) => {
  await page.goto('/tools/#/text')
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '离线就绪', exact: true })).toBeVisible({
    timeout: 20_000,
  })
  for (const width of [650, 651, 900, 901, 950, 1100, 1101]) {
    await page.setViewportSize({ width, height: 844 })
    expect(
      await page.locator('#source-panel .editor-body').evaluate((body) => {
        const editor = getComputedStyle(body.querySelector('.text-editor')!)
        const overlay = getComputedStyle(body.querySelector('.diff-overlay')!)
        return [
          'padding',
          'font-size',
          'line-height',
          'font-family',
          'white-space',
          'overflow-wrap',
        ].every((p) => editor.getPropertyValue(p) === overlay.getPropertyValue(p))
      }),
    ).toBe(true)
    await noOverflow(page)
    if (width > 650) {
      expect(
        await page.locator('.desktop-nav').evaluate((nav) => {
          const a = nav.getBoundingClientRect(),
            b = document.querySelector('.header-actions')!.getBoundingClientRect()
          return a.right <= b.left || a.top >= b.bottom
        }),
      ).toBe(true)
    }
  }
})

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: 展开输入控件与两种数据矩阵预览保持一致`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/text')
    await page.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('textbox', { name: '第 1 条查找' }).focus()
    const fields = page.locator('.replace-rule input, .list-options input')
    for (const field of await fields.all()) {
      await expect(field).toHaveCSS('height', '36px')
      await expect(field).toHaveCSS('border-radius', '6px')
    }
    await expect(page.getByRole('textbox', { name: '第 1 条查找' })).toHaveCSS(
      'outline-width',
      '2px',
    )
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath('text-options.png'), fullPage: true })
    await page.getByRole('button', { name: '全部设置' }).click()
    await expect(page.getByRole('textbox', { name: '预设名称' })).toHaveCSS('height', '36px')
    await page.getByRole('textbox', { name: '预设名称' }).fill('布局检查')
    expect(
      await page
        .locator('.settings-dialog .dialog-footer')
        .evaluate((e) => e.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true)
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath('settings.png'), fullPage: true })
    const csv = {
      name: '明细.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('编号,名称,数量\n001,办公用品,123.45\n002,长名称测试,6\n'),
    }
    await page.goto('/tools/#/files?mode=csv-excel')
    await expect(page.getByRole('heading', { name: '文件格式转换', exact: true })).toBeVisible()
    await page.setInputFiles('input[aria-label="选择待转换文件"]', csv)
    await expect(page.locator('.matrix-table')).toBeVisible()
    await expect(page.locator('.matrix-table')).toHaveCSS('font-size', '12px')
    await expect(page.locator('.matrix-table')).toHaveCSS('font-variant-numeric', 'tabular-nums')
    const matrix = await page
      .locator('.matrix-head .matrix-cell')
      .first()
      .evaluate((e) => {
        const c = getComputedStyle(e)
        return { padding: c.padding, background: c.backgroundColor, fontWeight: c.fontWeight }
      })
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath('matrix.png'), fullPage: true })
    await page.goto('/tools/#/table')
    await page.setInputFiles('input[aria-label="添加表格文件"]', csv)
    await expect(page.locator('.table-preview')).toBeVisible()
    await expect(page.locator('.table-preview')).toHaveCSS('font-size', '12px')
    await expect(page.locator('.table-preview')).toHaveCSS('font-variant-numeric', 'tabular-nums')
    expect(
      await page
        .locator('.table-preview th')
        .first()
        .evaluate((e) => {
          const c = getComputedStyle(e)
          return { padding: c.padding, background: c.backgroundColor, fontWeight: c.fontWeight }
        }),
    ).toEqual(matrix)
    await page.getByRole('switch', { name: '启用筛选' }).click()
    await expect(page.getByRole('textbox', { name: '筛选关键词' })).toHaveCSS('height', '36px')
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath('table-preview.png'), fullPage: true })
  })
}
