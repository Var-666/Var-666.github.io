import { expect, test, type Page } from '@playwright/test'
import { PDFDocument, PDFName, PDFRawStream, PDFArray, decodePDFRawStream, degrees } from 'pdf-lib'
import { readFile, writeFile } from 'node:fs/promises'

test.use({ serviceWorkers: 'block' })
const secret = ' 密碼-123 '
async function pdf(pages = 1, rotations = false) {
  const document = await PDFDocument.create()
  for (let i = 0; i < pages; i++) {
    const page = document.addPage([300, 400])
    page.drawText(`SELECTABLE 00${i + 1}`, { x: 45, y: 300, size: 16 })
    if (rotations) {
      page.setRotation(degrees(i * 90))
      page.setCropBox(20, 30, 250, 340)
    }
  }
  return {
    name: 'source.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await document.save()),
  }
}
async function bytes(page: Page, selector = '.pdf-tool .conversion-actions a[download]') {
  const link = page.locator(selector)
  await expect(link).toBeVisible()
  return Buffer.from(
    await page.evaluate(
      async (url) => Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
      await link.getAttribute('href'),
    ),
  )
}
function contents(document: PDFDocument, index: number) {
  const value = document.getPage(index).node.Contents()!
  return (value instanceof PDFArray ? value.asArray() : [value])
    .map((ref) => document.context.lookup(ref))
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'))
    .join('\n')
}
async function readyPreview(page: Page) {
  await expect(page.locator('.pdf-preview-dialog canvas')).toBeVisible()
  await expect(page.getByLabel('整页预览，可滚动查看', { exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
}

test('Unicode已知密码解密，错密码保留队列；副本保留书签/元信息和矢量文字，密码不持久化', async ({
  page,
}, info) => {
  const messages: string[] = [],
    requests: string[] = []
  page.on('console', (message) => messages.push(message.text()))
  page.on('request', (request) => requests.push(request.url() + (request.postData() ?? '')))
  await page.goto('/#/pdf')
  await page
    .getByLabel('选择 PDF 或图片', { exact: true })
    .setInputFiles('e2e/fixtures/encrypted.pdf')
  await expect(page.getByRole('region', { name: '待解密 PDF', exact: true })).toBeVisible()
  await page.getByLabel('PDF 打开密码', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: '解密并导入', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('密码不正确')
  await expect(page.locator('.pdf-page')).toHaveCount(0)
  await expect(page.getByLabel('PDF 打开密码', { exact: true })).toHaveValue('')
  await page.getByLabel('PDF 打开密码', { exact: true }).fill(secret)
  await page.getByRole('button', { name: '解密并导入', exact: true }).click()
  await expect(page.locator('.pdf-page')).toHaveCount(2)
  const output = await bytes(page, '[aria-label="解密结果"] a[download]')
  await writeFile(info.outputPath('unlocked.pdf'), output)
  const result = await PDFDocument.load(output)
  expect(result.isEncrypted).toBe(false)
  expect(result.getTitle()).toBe('Local encrypted fixture')
  expect(result.catalog.has(PDFName.of('Outlines'))).toBe(true)
  expect(result.getPage(0).node.Resources()?.has(PDFName.of('Font'))).toBe(true)
  expect(contents(result, 0)).toContain('CONFIDENTIAL 001')
  await expect(page.getByRole('region', { name: '待解密 PDF', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('密碼-123')
  expect(messages.join('\n') + requests.join('\n')).not.toContain(secret)
  expect(messages.join('\n')).not.toContain('wrong-password')
})

test('插入图片/空白页与排序，页码和中文水印覆盖四个旋转方向，导出预览可翻页', async ({
  page,
}, info) => {
  await page.goto('/#/pdf')
  await page.getByLabel('选择 PDF 或图片', { exact: true }).setInputFiles(await pdf(4, true))
  await expect(page.locator('.pdf-page')).toHaveCount(4)
  const transfer = await page.evaluateHandle(
    (data) => {
      const files = new DataTransfer()
      files.items.add(new File([Uint8Array.from(data)], 'photo.heic', { type: 'image/heic' }))
      return files
    },
    Array.from(await readFile('e2e/fixtures/colors.heic')),
  )
  await page.locator('.pdf-tool .file-drop').dispatchEvent('drop', { dataTransfer: transfer })
  await transfer.dispose()
  await expect(page.locator('.pdf-page')).toHaveCount(5)
  await page.getByRole('button', { name: '添加 A4 空白页', exact: true }).click()
  await expect(page.locator('.pdf-page')).toHaveCount(6)
  await page
    .locator('summary')
    .filter({ hasText: /^页码与水印$/ })
    .click()
  await page.getByRole('switch', { name: '添加 PDF 页码', exact: true }).click()
  await page.getByLabel('PDF 起始页码', { exact: true }).fill('5')
  await page.getByLabel('PDF 水印文字', { exact: true }).fill('仅供校验')
  await page.getByRole('button', { name: /^导出所选/ }).click()
  const resultBytes = await bytes(page)
  await writeFile(info.outputPath('decorated.pdf'), resultBytes)
  const result = await PDFDocument.load(resultBytes)
  expect(result.getPageCount()).toBe(6)
  expect(
    result
      .getPages()
      .slice(0, 4)
      .map((page) => page.getRotation().angle),
  ).toEqual([0, 90, 180, 270])
  for (let index = 0; index < 6; index++) {
    expect(contents(result, index)).toContain(
      `<${Buffer.from(String(index + 5))
        .toString('hex')
        .toUpperCase()}>`,
    )
    expect(result.getPage(index).node.Resources()?.has(PDFName.of('XObject'))).toBe(true)
  }
  await page.getByRole('button', { name: '预览导出 PDF', exact: true }).click()
  await readyPreview(page)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await readyPreview(page)
  await page.keyboard.press('Escape')
  const oldUrl = await page.locator('.conversion-actions a[download]').getAttribute('href')
  await page.getByLabel('PDF 起始页码', { exact: true }).fill('10')
  await expect(page.locator('.conversion-actions a[download]')).toHaveCount(0)
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
})

test('结构压缩真实减少未压缩流，保留字体/可选择文字和页面尺寸', async ({ page }, info) => {
  const document = await PDFDocument.create(),
    source = document.addPage([300, 400])
  source.drawText('COMPRESSED BUT SELECTABLE', { x: 30, y: 300 })
  source.node.addContentStream(
    document.context.register(document.context.stream(new Uint8Array(1_000_000).fill(32))),
  )
  const input = Buffer.from(await document.save({ useObjectStreams: false }))
  await page.goto('/#/pdf')
  await page
    .getByLabel('选择 PDF 或图片', { exact: true })
    .setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer: input })
  await expect(page.locator('.pdf-page')).toHaveCount(1)
  await page
    .locator('summary')
    .filter({ hasText: /^PDF 结构压缩$/ })
    .click()
  await page.getByRole('button', { name: '压缩并导出所选', exact: true }).click()
  const output = await bytes(page)
  await writeFile(info.outputPath('compressed.pdf'), output)
  expect(output.length).toBeLessThan(input.length / 4)
  const result = await PDFDocument.load(output)
  expect(result.getPage(0).getSize()).toEqual({ width: 300, height: 400 })
  expect(result.getPage(0).node.Resources()?.has(PDFName.of('Font'))).toBe(true)
  expect(contents(result, 0)).toContain('<434F4D50524553534544204255542053454C45435441424C45>')
  await expect(page.getByRole('status').filter({ hasText: /减少 \d+%/ })).toBeVisible()
})

test('解密器加载失败不覆盖已有页面和下载，重试恢复；移除待解密文件可继续使用', async ({ page }) => {
  await page.route('**/assets/qpdf-*.wasm', (route) => route.abort())
  await page.goto('/#/pdf')
  await page.getByLabel('选择 PDF 或图片', { exact: true }).setInputFiles(await pdf())
  await page.getByRole('button', { name: /^导出所选/ }).click()
  await expect(page.locator('.conversion-actions a[download]')).toBeVisible()
  const previous = await page.locator('.conversion-actions a[download]').getAttribute('href')
  await page
    .getByLabel('选择 PDF 或图片', { exact: true })
    .setInputFiles('e2e/fixtures/encrypted.pdf')
  await page.getByLabel('PDF 打开密码', { exact: true }).fill(secret)
  await page.getByRole('button', { name: '解密并导入', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('无法加载或运行 PDF 处理器')
  await expect(page.locator('.pdf-page')).toHaveCount(1)
  expect(await page.locator('.conversion-actions a[download]').getAttribute('href')).toBe(previous)
  await page.unroute('**/assets/qpdf-*.wasm')
  await page.getByLabel('PDF 打开密码', { exact: true }).fill(secret)
  await page.getByRole('button', { name: '解密并导入', exact: true }).click()
  await expect(page.locator('.pdf-page')).toHaveCount(3)
  await page
    .getByLabel('选择 PDF 或图片', { exact: true })
    .setInputFiles('e2e/fixtures/encrypted.pdf')
  await page.getByRole('button', { name: '移除此文件', exact: true }).click()
  await expect(page.getByRole('region', { name: '待解密 PDF', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^导出所选/ })).toBeEnabled()
})

for (const theme of ['light', 'dark'] as const)
  test(`390px ${theme}: 页码水印、折叠和结果预览可用，无横向溢出`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/#/pdf')
    await page.getByLabel('选择 PDF 或图片', { exact: true }).setInputFiles(await pdf())
    await page.getByRole('button', { name: '添加 A4 空白页', exact: true }).click()
    await expect(page.locator('.pdf-page')).toHaveCount(2)
    await page
      .locator('summary')
      .filter({ hasText: /^页码与水印$/ })
      .click()
    await page.getByRole('switch', { name: '添加 PDF 页码', exact: true }).click()
    await page.getByLabel('PDF 水印文字', { exact: true }).fill('仅供内部使用')
    await expect(page.getByLabel('PDF 水印文字', { exact: true })).toHaveCSS('height', '36px')
    await page.getByRole('button', { name: /^导出所选/ }).click()
    await expect(page.locator('.conversion-actions a[download]')).toBeVisible()
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important}',
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath('pdf-upgrade-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: '预览导出 PDF', exact: true }).click()
    await readyPreview(page)
    await page.screenshot({ path: info.outputPath('pdf-output-preview.png') })
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await readyPreview(page)
  })

test('空白页复用来源，不占十文件名额；100页边界后拒绝新增且原队列可恢复', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/#/pdf')
  const add = page.getByRole('button', { name: '添加 A4 空白页', exact: true })
  for (let index = 0; index < 100; index++) {
    await add.click()
    await expect(page.locator('.pdf-page')).toHaveCount(index + 1)
  }
  await expect(add).toBeDisabled()
  await page.getByLabel('选择 PDF 或图片', { exact: true }).setInputFiles(await pdf())
  await expect(page.getByText(/所有文件和当前列表合计最多 100 页/)).toBeVisible()
  await expect(page.locator('.pdf-page')).toHaveCount(100)
  await page.getByRole('button', { name: '删除页面 100', exact: true }).click()
  await expect(add).toBeEnabled()
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await expect(page.locator('.pdf-page')).toHaveCount(0)
  await page.getByLabel('选择 PDF 或图片', { exact: true }).setInputFiles(await pdf())
  await expect(page.locator('.pdf-page')).toHaveCount(1)
})

test('结构压缩不增大极简PDF，未收益时下载保持输入原字节', async ({ page }) => {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>\nendobj\n',
  ]
  let text = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(text))
    text += object
  }
  const start = Buffer.byteLength(text)
  text +=
    'xref\n0 4\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
      .join('')
  text += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`
  const input = Buffer.from(text)
  await page.goto('/#/pdf')
  await page
    .getByLabel('选择 PDF 或图片', { exact: true })
    .setInputFiles({ name: 'minimal.pdf', mimeType: 'application/pdf', buffer: input })
  await expect(page.locator('.pdf-page')).toHaveCount(1)
  await page
    .locator('summary')
    .filter({ hasText: /^PDF 结构压缩$/ })
    .click()
  await page.getByRole('button', { name: '压缩并导出所选', exact: true }).click()
  const output = await bytes(page)
  expect(output.equals(input)).toBe(true)
  await expect(page.getByRole('status').filter({ hasText: '未进一步减小' })).toBeVisible()
})
