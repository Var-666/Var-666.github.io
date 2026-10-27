import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

test('批量文件处理：应用当前规则、坏编码隔离、ZIP 内容核对', async ({ page }) => {
  await page.goto('/#/text')
  await expect(page.getByRole('heading', { name: '文本整理' })).toBeVisible()
  await page.getByRole('button', { name: '更多操作' }).click()
  // 默认规则（压缩空行 + 去行尾空格）应把三连空行压成单空行
  await page.setInputFiles('input[aria-label="添加批量文本文件"]', [
    {
      name: '好.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('第一行  \n\n\n\n第二行', 'utf8'),
    },
    {
      name: '乙.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('只有  一行', 'utf8'),
    },
    {
      name: '坏.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from([0xff, 0xfe, 0x00]),
    },
  ])
  await expect(page.locator('.batch-item')).toHaveCount(3)
  await page.getByRole('button', { name: /开始处理/ }).click()
  await expect(page.getByText(/批量处理完成：成功 2 个，失败 1 个/)).toBeVisible()
  await expect(page.locator('.batch-item.state-error, .batch-state.state-error')).toHaveCount(1)
  await expect(page.getByText('无法按 UTF-8 或 GBK / GB18030 读取，请检查文件编码。')).toBeVisible()
  await expect(page.getByText('好-整理.txt · 0.0 KB → 0.0 KB · 3 处调整')).toBeVisible()
  // 打包下载并核对清理后的内容
  await page.getByRole('button', { name: '打包下载 ZIP' }).click()
  const zipLink = page.locator('a[download="批量整理结果.zip"]')
  await expect(zipLink).toBeVisible()
  const base64 = await page.evaluate(
    async (url) => {
      const buffer = await (await fetch(url)).arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    },
    await zipLink.getAttribute('href'),
  )
  const bytes = Buffer.from(base64, 'base64')
  const files = unzipSync(new Uint8Array(bytes))
  expect(Object.keys(files).sort()).toEqual(['乙-整理.txt', '好-整理.txt'])
  expect(Buffer.from(files['好-整理.txt']).toString('utf8')).toBe('第一行\n\n第二行')
  // 默认预设折叠空格：双空格变单空格，规则确实随主编辑器生效
  expect(Buffer.from(files['乙-整理.txt']).toString('utf8')).toBe('只有 一行')
})
