import { expect, test, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

declare global {
  interface Window {
    nativeTest: {
      saved: Record<string, string>
      shared: { name: string; text: string }[]
      cancelPicker: boolean
      cancelShare: boolean
      failName: string
      picks: number
    }
  }
}

async function nativeFiles(page: Page) {
  await page.addInitScript(() => {
    window.nativeTest = {
      saved: { 'a-整理.txt': 'existing' },
      shared: [],
      cancelPicker: false,
      cancelShare: false,
      failName: '',
      picks: 0,
    }
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: ({ files }: { files: File[] }) => !!files?.length,
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async ({ files }: { files: File[] }) => {
        if (window.nativeTest.cancelShare) throw new DOMException('cancelled', 'AbortError')
        window.nativeTest.shared = await Promise.all(
          files.map(async (file) => ({ name: file.name, text: await file.text() })),
        )
      },
    })
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        window.nativeTest.picks++
        if (window.nativeTest.cancelPicker) throw new DOMException('cancelled', 'AbortError')
        return {
          async getFileHandle(name: string, options?: { create?: boolean }) {
            if (!(name in window.nativeTest.saved) && !options?.create)
              throw new DOMException('missing', 'NotFoundError')
            if (options?.create) window.nativeTest.saved[name] ??= ''
            return {
              async createWritable() {
                let content = ''
                return {
                  async write(blob: Blob) {
                    if (name === window.nativeTest.failName)
                      throw new DOMException('disk full', 'QuotaExceededError')
                    content = await blob.text()
                  },
                  async close() {
                    window.nativeTest.saved[name] = content
                  },
                  async abort() {},
                }
              },
            }
          },
        }
      },
    })
  })
}

const csvFile = (name: string, text = '编号,部门\n001,研发\n002,销售') => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(text),
})

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy()
}

test('手机分享实际 TXT/转换结果；取消不报错、下载继续可用，原生按钮无溢出', async ({
  page,
}, testInfo) => {
  await nativeFiles(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/text')
  await page.getByRole('textbox', { name: '原始文本', exact: true }).fill('  中文 001  ')
  await page.getByRole('tab', { name: '整理结果', exact: true }).click()
  const share = page.getByRole('button', { name: /^分享 理文-/ })
  await expect(share).toBeVisible()
  await share.click()
  await expect.poll(() => page.evaluate(() => window.nativeTest.shared[0]?.text)).toBe('中文 001')
  await page.evaluate(() => {
    window.nativeTest.cancelShare = true
  })
  await share.click()
  await expect(share).toBeEnabled()
  await expect(page.getByText('cancelled', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '下载 TXT 文件', exact: true })).toBeEnabled()
  await noOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('text-native-mobile.png') })
  await page.evaluate(() => {
    window.nativeTest.cancelShare = false
    location.hash = '#/files?mode=csv-json'
  })
  await page.getByLabel('选择待转换文件').setInputFiles(csvFile('a.csv'))
  await page.getByRole('button', { name: '开始转换' }).click()
  await page.getByRole('button', { name: '分享 a.json', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.nativeTest.shared[0]?.name)).toBe('a.json')
  const shared = await page.evaluate(() => window.nativeTest.shared[0])
  expect(shared.name).toBe('a.json')
  expect(JSON.parse(shared.text)[0]).toEqual({ 编号: '001', 部门: '研发' })
  await noOverflow(page)
  expect(
    await page
      .locator('.file-tool .file-details')
      .evaluate((element) => element.getBoundingClientRect().width),
  ).toBeGreaterThan(200)
  await page.screenshot({ path: testInfo.outputPath('file-native-mobile.png') })
})

test('批量文本直接存目录避开已有文件；取消目录选择保留结果，失败诚实报告进度', async ({ page }) => {
  await nativeFiles(page)
  await page.goto('/#/text')
  await page.getByRole('button', { name: '更多操作' }).click()
  await page.getByLabel('添加批量文本文件').setInputFiles([
    { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('  001  ') },
    { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('  中文  ') },
  ])
  await page.getByRole('button', { name: '开始处理', exact: true }).click()
  const save = page.getByRole('button', { name: '保存到文件夹', exact: true })
  await expect(save).toBeVisible()
  await page.evaluate(() => {
    window.nativeTest.cancelPicker = true
  })
  await save.click()
  await expect(save).toBeEnabled()
  expect(await page.evaluate(() => Object.keys(window.nativeTest.saved))).toEqual(['a-整理.txt'])
  await page.evaluate(() => {
    window.nativeTest.cancelPicker = false
  })
  await save.click()
  await expect.poll(() => page.evaluate(() => window.nativeTest.saved['b-整理.txt'])).toBe('中文')
  expect(await page.evaluate(() => window.nativeTest.saved['a-整理.txt'])).toBe('existing')
  expect(await page.evaluate(() => window.nativeTest.saved['a-整理 (2).txt'])).toBe('001')
  await page.evaluate(() => {
    window.nativeTest.saved = {}
    window.nativeTest.failName = 'b-整理.txt'
  })
  await save.click()
  await expect(page.getByText(/已保存 1\/2 个文件，后续保存失败/)).toBeVisible()
  await expect(page.getByRole('button', { name: '打包下载 ZIP', exact: true })).toBeEnabled()
})

test('重命名直接存目录保留原字节，表格分组 ZIP 可另存独立 CSV', async ({ page }) => {
  await nativeFiles(page)
  await page.goto('/#/rename')
  await page.getByLabel('选择需要重命名的文件').setInputFiles([
    { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('001') },
    { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('中文') },
  ])
  await page.getByRole('textbox', { name: '新文件名 a.txt' }).fill('first.txt')
  await page.getByRole('textbox', { name: '新文件名 b.txt' }).fill('second.txt')
  await page.getByRole('button', { name: '保存到文件夹', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.nativeTest.saved['second.txt'])).toBe('中文')
  expect(await page.evaluate(() => window.nativeTest.saved['first.txt'])).toBe('001')
  await page.evaluate(() => {
    location.hash = '#/table'
  })
  await page.getByLabel('添加表格文件').setInputFiles(csvFile('table.csv'))
  await page.getByRole('combobox', { name: '按列拆分' }).click()
  await page.getByRole('option', { name: '部门', exact: true }).click()
  await page.getByRole('button', { name: '导出 CSV（ZIP）', exact: true }).click()
  await page
    .locator('.table-tool')
    .getByRole('button', { name: '保存到文件夹', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => window.nativeTest.saved['研发.csv']))
    .toContain('001,研发')
  expect(await page.evaluate(() => window.nativeTest.saved['销售.csv'])).toContain('002,销售')
  await expect(page.locator('.table-tool a[download]')).toBeVisible()
})

test('PDF 拆分结果保存成多份 PDF，单文件可以系统分享；比较 CSV 也逐份保存', async ({ page }) => {
  await nativeFiles(page)
  const pdf = await PDFDocument.create()
  pdf.addPage()
  pdf.addPage()
  await page.goto('/#/pdf')
  await page.getByLabel('选择需要整理的 PDF').setInputFiles({
    name: 'two.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  })
  await page.getByRole('button', { name: /^导出所选/ }).click()
  await page.getByRole('button', { name: '分享 整理后的文档.pdf', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => window.nativeTest.shared[0]?.text.startsWith('%PDF-')))
    .toBeTruthy()
  await page.getByRole('button', { name: /拆分导出/ }).click()
  await page.getByRole('button', { name: '保存到文件夹', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.values(window.nativeTest.saved).filter((text) => text.startsWith('%PDF-')).length,
      ),
    )
    .toBe(2)
  await page.evaluate(() => {
    location.hash = '#/compare'
  })
  await page
    .getByLabel('选择旧表（左）文件')
    .setInputFiles(csvFile('old.csv', '编号,名称\n001,旧\n002,删'))
  await page
    .getByLabel('选择新表（右）文件')
    .setInputFiles(csvFile('new.csv', '编号,名称\n001,新\n003,增'))
  await page.getByRole('button', { name: '导出 CSV（ZIP 三个文件）', exact: true }).click()
  await page
    .locator('.compare-tool')
    .getByRole('button', { name: '保存到文件夹', exact: true })
    .click()
  await expect
    .poll(() =>
      page.evaluate(
        () => Object.keys(window.nativeTest.saved).filter((name) => name.endsWith('.csv')).length,
      ),
    )
    .toBe(3)
})

test('不支持原生能力时保留直接下载/ZIP入口，不显示失效按钮', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined })
    Object.defineProperty(navigator, 'canShare', { value: undefined })
    Object.defineProperty(navigator, 'share', { value: undefined })
  })
  await page.goto('/#/files?mode=csv-json')
  await page.getByLabel('选择待转换文件').setInputFiles([csvFile('a.csv'), csvFile('b.csv')])
  await page.getByRole('button', { name: '开始转换' }).click()
  await expect(page.locator('.file-tool a[download]')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^打包下载/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: '保存到文件夹', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^分享 / })).toHaveCount(0)
})
