import { expect, test, type Page } from '@playwright/test'
import { zipSync } from 'fflate'
import * as XLSX from 'xlsx'
import { deflateSync } from 'node:zlib'

// 夹具全部在内存中构造：xlsx 用项目内 SheetJS 生成，压缩炸弹只伪造中央目录声明的解压大小
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function buildWorkbook(): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['名称', '小数15位', '小数16位', '长编号'],
    ['甲', 1.23456789012345, 1.234567890123456, '12345678901234567890'],
    ['乙', 0.5, 0.25, '00123'],
  ])
  const summary = XLSX.utils.aoa_to_sheet([
    ['汇总', '数量'],
    ['行数', 2],
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '明细')
  XLSX.utils.book_append_sheet(workbook, summary, '汇总')
  return Buffer.from(XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer)
}

function buildBomb(): Buffer {
  const bomb = Buffer.from(zipSync({ 'xl/worksheets/sheet1.xml': new TextEncoder().encode('x') }))
  bomb.writeUInt32LE(256 * 1024 * 1024 + 1, bomb.indexOf('PK\x01\x02') + 24)
  return bomb
}

const corruptXlsx = Buffer.from('PK\u0003\u0004 not a real workbook')
const dupHeadersCsv = Buffer.from(
  '\uFEFF订单号,订单号(2),订单号,备注\nA001,B001,C001,首行\nA002,B002,C002,次行\n',
)

async function upload(page: Page, name: string, buffer: Buffer, mimeType: string) {
  await page.setInputFiles('input[aria-label="选择待转换文件"]', { name, mimeType, buffer })
}

async function downloadText(page: Page): Promise<{ name: string; text: string }> {
  const link = page.locator('a[download]')
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  const name = (await link.getAttribute('download')) ?? ''
  // blob URL 直接在页面里取回，核对下载内容而不仅是链接出现
  const text = await page.evaluate(async (url) => await (await fetch(url)).text(), href)
  return { name, text }
}

async function downloadBytes(page: Page): Promise<{ name: string; size: number }> {
  const link = page.locator('a[download]')
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  const name = (await link.getAttribute('download')) ?? ''
  const size = await page.evaluate(
    async (url) => (await (await fetch(url)).arrayBuffer()).byteLength,
    href,
  )
  return { name, size }
}

// 内存构造一张确定性伪噪声 PNG（难以压缩，保证压缩流程有实际工作量）
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
function buildNoisyPng(width = 320, height = 320): Buffer {
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  let seed = 0x2f6e2b1
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < stride; x++) {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff
      raw[y * stride + x] = (seed >>> 16) & 0xff
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 2 // 8 位 RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/files')
  await expect(page.getByRole('heading', { name: '文件格式转换' })).toBeVisible()
})

test('CSV → JSON：重复表头加序号去重（与 Excel 一致）并在队列中提示', async ({ page }) => {
  await page.getByRole('tab', { name: '表格' }).click()
  await upload(page, '订单.csv', dupHeadersCsv, 'text/csv')
  await page.getByRole('button', { name: '开始转换' }).click()
  const { name, text } = await downloadText(page)
  expect(name).toBe('订单.json')
  expect(JSON.parse(text)).toEqual([
    { 订单号: 'A001', '订单号(2)': 'B001', '订单号(3)': 'C001', 备注: '首行' },
    { 订单号: 'A002', '订单号(2)': 'B002', '订单号(3)': 'C002', 备注: '次行' },
  ])
  await expect(page.locator('.matrix-notice').filter({ hasText: '重复表头' })).toBeVisible()
})

test('Excel → CSV：工作表选择、精度提示与导出内容一致', async ({ page }) => {
  await page.getByRole('tab', { name: '表格' }).click()
  await page.getByRole('button', { name: 'Excel → CSV' }).click()
  await upload(page, '数据.xlsx', buildWorkbook(), XLSX_MIME)
  const sheetSelect = page.getByRole('combobox', { name: '选择工作表' })
  await expect(sheetSelect).toContainText('明细（3 行 × 4 列）')
  // 恰好一个超精度数值（16 位小数），15 位同类值不计入
  await expect(page.getByText(/1 个数值超出 Excel 的 15 位有效数字精度/)).toBeVisible()
  await page.getByRole('button', { name: '开始转换' }).click()
  const { name, text } = await downloadText(page)
  expect(name).toBe('数据-明细.csv')
  expect(text).toContain('12345678901234567890')
  expect(text).toContain('00123')
  // 切换工作表后旧下载失效
  await sheetSelect.click()
  await page.getByRole('option', { name: '汇总（2 行 × 2 列）' }).click()
  await expect(page.locator('a[download]')).toHaveCount(0)
})

test('损坏文件与压缩炸弹被即拒绝，移除后可恢复转换', async ({ page }) => {
  await page.getByRole('tab', { name: '表格' }).click()
  await page.getByRole('button', { name: 'Excel → CSV' }).click()
  await upload(page, '坏.xlsx', corruptXlsx, XLSX_MIME)
  await expect(page.getByRole('alert')).toContainText('无法读取 Excel 文件')
  await page.getByRole('button', { name: '移除 坏.xlsx' }).click()
  await upload(page, '炸弹.xlsx', buildBomb(), XLSX_MIME)
  await expect(page.getByRole('alert')).toContainText('文件解压后超过 256 MB')
  await page.getByRole('button', { name: '移除 炸弹.xlsx' }).click()
  await upload(page, '数据.xlsx', buildWorkbook(), XLSX_MIME)
  await expect(page.getByRole('combobox', { name: '选择工作表' })).toContainText('明细')
  await page.getByRole('button', { name: '开始转换' }).click()
  expect((await downloadText(page)).name).toBe('数据-明细.csv')
})

test('图片压缩：指定目标大小，输出真实达标并显示前后对比', async ({ page }) => {
  await page.getByRole('button', { name: '图片压缩' }).click()
  await page.getByRole('combobox', { name: '目标大小' }).click()
  await page.getByRole('option', { name: '100 KB' }).click()
  const png = buildNoisyPng()
  await upload(page, '噪声.png', png, 'image/png')
  await page.getByRole('button', { name: '开始转换' }).click()
  const { name, size } = await downloadBytes(page)
  expect(name).toBe('噪声.jpg')
  expect(size).toBeGreaterThan(0)
  expect(size).toBeLessThanOrEqual(100 * 1024)
  await expect(
    page.locator('.matrix-notice').filter({ hasText: /KB → .* · 320×320 · 质量 \d+%/ }),
  ).toBeVisible()
})

test('切换转换方式清空队列并复位按钮', async ({ page }) => {
  await page.getByRole('tab', { name: '表格' }).click()
  await upload(page, '订单.csv', dupHeadersCsv, 'text/csv')
  await expect(page.getByText('订单.csv')).toBeVisible()
  await page.getByRole('tab', { name: '表格' }).click()
  await page.getByRole('button', { name: 'Excel → CSV' }).click()
  await expect(page.locator('.file-queue')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '开始转换' })).toBeDisabled()
})
