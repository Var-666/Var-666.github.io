import { expect, test, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import * as XLSX from 'xlsx'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGN0S33BgA0wYRUdtBIAPicBo5sMNB0AAAAASUVORK5CYII=',
  'base64',
)
const csv = (name: string, text: string) => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(text),
})
async function pdf() {
  const document = await PDFDocument.create()
  document.addPage().drawText('Useful PDF text')
  return {
    name: 'source.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await document.save()),
  }
}
async function intake(page: Page, files: Parameters<Page['setInputFiles']>[1]) {
  await page.setInputFiles('input[aria-label="选择文件并推荐任务"]', files)
  await expect(page.getByRole('dialog', { name: '你想做什么？' })).toBeVisible()
  await expect(page.getByText('正在识别文件…', { exact: true })).toHaveCount(0)
}
async function task(page: Page, name: string) {
  await page
    .getByRole('dialog', { name: '你想做什么？' })
    .getByRole('button', { name, exact: true })
    .click()
}

test('首页识别误命名 PNG → 图片合 PDF → 继续整理 PDF，全程无需下载重传', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[aria-label="首页选择文件"]', {
    name: 'photo.txt',
    mimeType: 'text/plain',
    buffer: png,
  })
  await expect(page.getByRole('dialog', { name: '你想做什么？' })).toContainText(
    '按文件内容识别为 图片',
  )
  await task(page, '转换图片格式')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  await page.locator('.file-row').getByRole('button', { name: '继续处理', exact: true }).click()
  await task(page, '图片合成 PDF')
  await page.getByRole('button', { name: '切换并导入', exact: true }).click()
  await expect(page.getByRole('region', { name: '图片 → PDF', exact: true })).toBeVisible()
  await expect(page.locator('.file-row')).toHaveCount(1)
  await expect(page.locator('.file-row')).toContainText('photo.txt.png')
  await page.getByRole('button', { name: '合并 PDF', exact: true }).click()
  await page
    .locator('.merged-result')
    .getByRole('button', { name: '继续处理', exact: true })
    .click()
  await task(page, '合并、提取、拆分页面')
  await expect(page.locator('.pdf-thumbnail canvas')).toBeVisible()
})

test('PDF 入口提取文字后整理；PDF 转 Word 的实际文字也可接力', async ({ page }) => {
  await page.goto('/')
  await intake(page, await pdf())
  await task(page, '提取文字后整理')
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
    'Useful PDF text',
  )
  await intake(page, await pdf())
  await task(page, 'PDF 转成 Word')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  await expect(page.locator('.file-row a[download]')).toBeVisible()
  await page.locator('.file-row').getByRole('button', { name: '继续处理', exact: true }).click()
  await task(page, '整理提取的文字')
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
    'Useful PDF text',
  )
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '文件格式转换', exact: true })
    .click()
  await expect(page.locator('.file-row a[download]')).toBeVisible()
})

test('Excel 转 CSV 后直接接力表格批处理，保留 001 与中文', async ({ page }) => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['编号', '名称'],
      ['001', '中文'],
    ]),
    '明细',
  )
  await page.goto('/')
  await intake(page, {
    name: 'source.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
  })
  await task(page, 'Excel 转 CSV')
  await expect(page.getByRole('combobox', { name: '工作表' })).toBeVisible()
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  await page.locator('.file-row').getByRole('button', { name: '继续处理', exact: true }).click()
  await task(page, '合并、去重、筛选表格')
  await expect(page.locator('.table-preview')).toContainText('001')
  await expect(page.locator('.table-preview')).toContainText('中文')
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
  const url = await page.locator('.table-tool a[download]').getAttribute('href')
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: 'PDF 页面整理', exact: true })
    .click()
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '表格批量处理', exact: true })
    .click()
  expect(await page.evaluate(async (url) => (await fetch(url!)).ok, url)).toBe(true)
})

test('跨工具换转换方式前保留旧队列，取消与确认路径均可用', async ({ page }) => {
  await page.goto('/#/files?mode=csv-json')
  await page.setInputFiles(
    'input[aria-label="选择待转换文件"]',
    csv('old.csv', '编号,名称\n001,原内容'),
  )
  await intake(page, { name: 'new.png', mimeType: 'image/png', buffer: png })
  await task(page, '转换图片格式')
  await expect(page.getByRole('dialog', { name: '导入新任务' })).toBeVisible()
  await page.getByRole('button', { name: '保留当前内容', exact: true }).click()
  await expect(page.locator('.file-row')).toContainText('old.csv')
  await intake(page, { name: 'new.png', mimeType: 'image/png', buffer: png })
  await task(page, '转换图片格式')
  await page.getByRole('button', { name: '切换并导入', exact: true }).click()
  await expect(page.getByRole('region', { name: '图片互转', exact: true })).toBeVisible()
  await expect(page.locator('.file-row')).toHaveCount(1)
  await expect(page.locator('.file-row')).toContainText('new.png')
})

test('两份表格直接比较，重新导入已有对比时支持保留', async ({ page }) => {
  await page.goto('/')
  await intake(page, [csv('old.csv', '编号,名称\n001,旧值'), csv('new.csv', '编号,名称\n001,新值')])
  await task(page, '比较两份表格差异')
  await expect(page.getByText('修改 1', { exact: true })).toBeVisible()
  await intake(page, [csv('a.csv', '编号,名称\n002,甲'), csv('b.csv', '编号,名称\n003,乙')])
  await task(page, '比较两份表格差异')
  await page.getByRole('button', { name: '保留当前内容', exact: true }).click()
  await expect(page.locator('.compare-change')).toContainText('旧值')
})

test('多份文本进入批量面板且 StrictMode 不重复入队；过量任务可移除后恢复', async ({ page }) => {
  await page.goto('/')
  await intake(page, [
    { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('a  b') },
    { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('c  d') },
  ])
  await task(page, '批量整理文本')
  await expect(page.locator('.batch-item')).toHaveCount(2)
  await page.getByRole('button', { name: '开始处理', exact: true }).click()
  await expect(page.locator('.batch-state.state-done')).toHaveCount(2)
  await intake(page, [csv('a.csv', 'a,b\n1,2'), csv('b.csv', 'a,b\n3,4'), csv('c.csv', 'a,b\n5,6')])
  await expect(
    page.getByRole('button', { name: '比较两份表格差异 最多 2 个文件', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: '移除待处理文件 c.csv', exact: true }).click()
  await expect(page.getByRole('button', { name: '比较两份表格差异', exact: true })).toBeEnabled()
})

test('Ctrl/⌘ K 搜索可用，文本设置保留 Shift 快捷键；手机可直接换工具并保留草稿', async ({
  page,
}) => {
  await page.goto('/#/text')
  await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('保留的草稿')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: '搜索工具与任务', exact: true }).fill('压缩')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: '图片压缩', exact: true })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: '搜索工具与任务', exact: true }).fill('Word PDF')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Word → PDF', exact: true })).toBeVisible()
  await page.goto('/#/text')
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+Shift+k')
  await expect(page.getByRole('heading', { name: '整理设置', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('heading', { name: '整理设置', exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '切换工具', exact: true }).click()
  await page
    .getByRole('navigation', { name: '移动工具导航' })
    .getByRole('link', { name: 'PDF 页面整理', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'PDF 页面整理', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '切换工具', exact: true }).click()
  await page
    .getByRole('navigation', { name: '移动工具导航' })
    .getByRole('link', { name: '文本整理', exact: true })
    .click()
  await expect(page.getByRole('textbox', { name: '原始文本', exact: true })).toHaveValue(
    '保留的草稿',
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
})

test('全局拖放和截图粘贴推荐任务，现有工具的拖放/粘贴仍直接入队', async ({ page }) => {
  await page.goto('/#/pdf')
  const source = await pdf()
  const data = await page.evaluateHandle(
    ({ name, bytes, type }) => {
      const data = new DataTransfer()
      data.items.add(new File([new Uint8Array(bytes)], name, { type }))
      return data
    },
    { name: source.name, bytes: [...source.buffer], type: source.mimeType },
  )
  await page.locator('.file-drop').dispatchEvent('drop', { dataTransfer: data })
  await expect(page.locator('.pdf-thumbnail canvas')).toBeVisible()
  await expect(page.getByRole('dialog', { name: '你想做什么？' })).toHaveCount(0)
  await page.locator('.site-header').dispatchEvent('drop', { dataTransfer: data })
  await expect(page.getByRole('dialog', { name: '你想做什么？' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.evaluate(
    (bytes) => {
      const data = new DataTransfer()
      data.items.add(new File([new Uint8Array(bytes)], 'clipboard.png', { type: 'image/png' }))
      document.body.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    },
    [...png],
  )
  await task(page, '转换图片格式')
  await expect(page.locator('.file-row')).toHaveCount(1)
  await page.evaluate(
    (bytes) => {
      const data = new DataTransfer()
      data.items.add(new File([new Uint8Array(bytes)], 'clipboard2.png', { type: 'image/png' }))
      document.body.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    },
    [...png],
  )
  await expect(page.locator('.file-row')).toHaveCount(2)
  await expect(page.getByRole('dialog', { name: '你想做什么？' })).toHaveCount(0)
})

for (const colorScheme of ['light', 'dark'] as const)
  test(`390px ${colorScheme}: 文件任务面板、搜索与手机菜单无溢出`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto('/')
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important}',
    })
    const noOverflow = async () =>
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
    await noOverflow()
    await page.screenshot({ path: info.outputPath('home-mobile.png'), fullPage: true })
    await intake(page, [
      csv('一份很长的中文文件名需要在文件列表里面正常换行.csv', 'a,b\n1,2'),
      csv('b.csv', 'a,b\n3,4'),
      csv('c.csv', 'a,b\n5,6'),
    ])
    await noOverflow()
    const dialog = page.getByRole('dialog', { name: '你想做什么？' })
    await expect(dialog).toBeInViewport({ ratio: 1 })
    await page.screenshot({ path: info.outputPath('intake-mobile.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: '切换工具', exact: true }).click()
    await noOverflow()
    await page.screenshot({ path: info.outputPath('menu-mobile.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '搜索工具与任务', exact: true }).click()
    await page.getByRole('combobox', { name: '搜索工具与任务', exact: true }).fill('表格')
    await noOverflow()
    await page.screenshot({ path: info.outputPath('command-mobile.png'), fullPage: true })
  })

test.describe('取消未完成的交接', () => {
  test.use({ serviceWorkers: 'block' })
  test('目标工具加载失败后，返回首页仍可发送文件到其他工具', async ({ page }) => {
    await page.route('**/assets/PdfTool-*.js', (route) => route.abort())
    await page.goto('/')
    await intake(page, await pdf())
    await task(page, '合并、提取、拆分页面')
    await expect(page.getByRole('alert')).toContainText('PDF 页面整理加载失败')
    await page.getByRole('link', { name: '返回全部工具', exact: true }).click()
    await intake(page, csv('still-usable.csv', 'a,b\n1,2'))
    await task(page, '批量修改文件名')
    await expect(page.locator('.rename-table')).toContainText('still-usable.csv')
  })
})
