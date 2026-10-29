import { expect, test, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

test.use({ screenshot: 'only-on-failure' })

async function focusedControlVisible(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const element = document.activeElement
          if (!(element instanceof HTMLElement)) return { visible: false, label: '没有焦点' }
          const rect = element.getBoundingClientRect()
          const cover = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )
          return {
            label: element.getAttribute('aria-label') || element.textContent,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            cover: cover?.outerHTML.slice(0, 180),
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              rect.top >= 0 &&
              rect.bottom <= innerHeight + 1 &&
              rect.left >= 0 &&
              rect.right <= innerWidth + 1 &&
              !!cover &&
              element.contains(cover),
          }
        }),
      { message: '焦点控件需要在视口内且未被遮挡' },
    )
    .toMatchObject({ visible: true })
}

for (const [width, height] of [
  [640, 400],
  [320, 256],
]) {
  test(`${width}×${height}: 短视口下帮助、统计与设置弹窗可以滚动和关闭`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/tools/#/text')
    await page
      .getByRole('textbox', { name: '原始文本', exact: true })
      .fill('长内容验证\n'.repeat(15))
    for (const opener of [
      page.getByRole('button', { name: '使用指南', exact: true }),
      page.getByRole('button', { name: /^原始文本详细统计/ }),
      page.getByRole('button', { name: '全部设置' }),
    ]) {
      await opener.click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect
        .poll(() =>
          page.getByRole('dialog').evaluate((element) => element.contains(document.activeElement)),
        )
        .toBe(true)
      await page.getByRole('button', { name: '关闭', exact: true }).focus()
      await focusedControlVisible(page)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
      await page.screenshot({
        path: info.outputPath(
          `${width}-${await page.getByRole('dialog').getAttribute('aria-labelledby')}.png`,
        ),
      })
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(opener).toBeFocused()
    }
  })

  test(`${width}×${height}: 多文件任务与长表头选项保持可达`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/tools/')
    await page.getByLabel('首页选择文件', { exact: true }).setInputFiles(
      Array.from({ length: 12 }, (_, i) => ({
        name: `第${i + 1}份资料-用于核对很长的中文文件名称在放大时是否仍然可用.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from('编号,名称\n001,中文'),
      })),
    )
    await expect(page.getByText('正在识别文件…', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '批量修改文件名', exact: true }).focus()
    await focusedControlVisible(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goto('/tools/#/table')
    const headers = Array.from({ length: 40 }, (_, index) => `第${index + 1}列需要保留的字段名称`)
    await page.getByLabel('添加表格文件', { exact: true }).setInputFiles({
      name: '长表头.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(headers.join(',') + '\n' + headers.map(() => '数据').join(',')),
    })
    await page.getByRole('switch', { name: '启用去重', exact: true }).click()
    await page.getByRole('combobox', { name: '去重列', exact: true }).click()
    await page.keyboard.press('End')
    await expect(page.getByRole('option', { name: headers.at(-1), exact: true })).toBeFocused()
    await focusedControlVisible(page)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: '去重列', exact: true })).toContainText(
      headers.at(-1)!,
    )
    await expect(page.locator('.website-header')).not.toHaveAttribute('inert', '')
  })

  test(`${width}×${height}: PDF 预览控制条和关闭按钮可达`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/tools/#/pdf')
    const pdf = await PDFDocument.create()
    pdf.addPage().drawText('Accessible PDF preview')
    await page.getByLabel('选择 PDF 或图片', { exact: true }).setInputFiles({
      name: '一份用于检查放大后很长文件名称的PDF资料.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await pdf.save()),
    })
    await page.getByRole('button', { name: '放大页面 1', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect
      .poll(() =>
        page.getByRole('dialog').evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true)
    for (const name of ['适合页面', '关闭']) {
      await page.getByRole('button', { name, exact: true }).focus()
      await focusedControlVisible(page)
    }
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '放大页面 1', exact: true })).toBeFocused()
  })
}

test('系统强制颜色下，键盘焦点仍有系统轮廓', async ({ page, browserName }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  test.skip(
    !(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)),
    '当前引擎未提供强制颜色模拟，不能计为已验证',
  )
  await page.goto('/tools/')
  await expect(page.getByRole('heading', { name: '全部工具', exact: true })).toBeVisible()
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
  const skip = page.getByRole('link', { name: '跳到主要内容', exact: true })
  await expect(skip).toBeFocused()
  await expect(skip).toHaveCSS('outline-style', 'solid')
  await expect(skip).toHaveCSS('outline-width', '3px')
})
