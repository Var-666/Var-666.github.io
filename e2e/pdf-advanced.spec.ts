import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { unzipSync } from 'fflate'
import { deflateSync } from 'node:zlib'

async function downloadBytes(page: Page): Promise<{ name: string; bytes: Buffer }> {
  const link = page.locator('a[download]')
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  const name = (await link.getAttribute('download')) ?? ''
  const base64 = await page.evaluate(async (url) => {
    const buffer = await (await fetch(url)).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }, href)
  return { name, bytes: Buffer.from(base64, 'base64') }
}

// 内存构造 N 页 PDF：每页宽度不同（300+i），用页面尺寸做内容归属核对
async function buildPdf(pages: number): Promise<Buffer> {
  const document = await PDFDocument.create()
  for (let index = 0; index < pages; index++) document.addPage([300 + index, 200])
  return Buffer.from(await document.save())
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  let crc = 0xffffffff
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, body, checksum])
}
function buildPng(width = 400, height = 300): Buffer {
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  let seed = 0x1234abcd
  for (let y = 0; y < height; y++)
    for (let x = 1; x < stride; x++) {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff
      raw[y * stride + x] = (seed >>> 16) & 0xff
    }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/pdf')
  await expect(page.getByRole('heading', { name: 'PDF 页面整理' })).toBeVisible()
})

test('按页码段拆分导出 ZIP，逐份核对页数与内容归属', async ({ page }) => {
  await page.setInputFiles('input[aria-label="选择需要整理的 PDF"]', {
    name: '三页.pdf',
    mimeType: 'application/pdf',
    buffer: await buildPdf(3),
  })
  await expect(page.getByRole('button', { name: /拆分导出/ })).toBeVisible()
  await page.getByRole('combobox', { name: '拆分方式' }).click()
  await page.getByRole('option', { name: '按页码段' }).click()
  await page.getByRole('textbox', { name: '拆分页码段' }).fill('1-2,3')
  await page.getByRole('button', { name: /拆分导出/ }).click()
  const { name, bytes } = await downloadBytes(page)
  expect(name).toBe('拆分结果.zip')
  const files = unzipSync(new Uint8Array(bytes))
  expect(Object.keys(files).sort()).toEqual(['拆分-01.pdf', '拆分-02.pdf'])
  const first = await PDFDocument.load(new Uint8Array(files['拆分-01.pdf']))
  const second = await PDFDocument.load(new Uint8Array(files['拆分-02.pdf']))
  expect(first.getPageCount()).toBe(2)
  // 段内保持当前排序：宽度 300 与 301 的两页
  expect(Math.round(first.getPage(0).getWidth())).toBe(300)
  expect(Math.round(first.getPage(1).getWidth())).toBe(301)
  expect(second.getPageCount()).toBe(1)
  expect(Math.round(second.getPage(0).getWidth())).toBe(302)
})

test('每 N 页拆分：3 页按每 2 页拆成 2 份，修改设置后旧下载失效', async ({ page }) => {
  await page.setInputFiles('input[aria-label="选择需要整理的 PDF"]', {
    name: '三页.pdf',
    mimeType: 'application/pdf',
    buffer: await buildPdf(3),
  })
  await page.getByRole('combobox', { name: '拆分方式' }).click()
  await page.getByRole('option', { name: '每 N 页一个文件' }).click()
  await page.getByRole('textbox', { name: '每份页数' }).fill('2')
  await page.getByRole('button', { name: /拆分导出/ }).click()
  const first = await downloadBytes(page)
  expect(first.name).toBe('拆分结果.zip')
  const files = unzipSync(new Uint8Array(first.bytes))
  expect(Object.keys(files).length).toBe(2)
  // 修改拆分设置后旧下载失效
  await page.getByRole('textbox', { name: '每份页数' }).fill('3')
  await expect(page.locator('a[download]')).toHaveCount(0)
})

test('图片合成 PDF：A3 横向页面尺寸写入输出', async ({ page }) => {
  await page.goto('/#/files')
  await page.getByRole('button', { name: '图片 → PDF' }).click()
  await page.setInputFiles('input[aria-label="选择待转换文件"]', {
    name: '图.png',
    mimeType: 'image/png',
    buffer: buildPng(),
  })
  await page.getByRole('combobox', { name: '页面尺寸' }).click()
  await page.getByRole('option', { name: /A3/ }).click()
  await page.getByText('高级设置与说明', { exact: true }).click()
  await page.getByRole('combobox', { name: '页面方向' }).click()
  await page.getByRole('option', { name: '横向' }).click()
  await page.getByRole('button', { name: '合并 PDF' }).click()
  const { name, bytes } = await downloadBytes(page)
  expect(name).toBe('合并图片.pdf')
  const merged = await PDFDocument.load(new Uint8Array(bytes))
  expect(merged.getPageCount()).toBe(1)
  const { width, height } = merged.getPage(0).getSize()
  // jsPDF A3：420 × 297 mm → 1190.55 × 841.89 pt
  expect(Math.round(width)).toBe(1191)
  expect(Math.round(height)).toBe(842)
})
