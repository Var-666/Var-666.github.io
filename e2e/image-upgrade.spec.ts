import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })
async function choose(page: Page, label: string, value: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: value, exact: true }).click()
}
async function png(page: Page, width = 64, height = 40, transparent = false) {
  const data = await page.evaluate(
    ({ width, height, transparent }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')!
      for (const [color, x, y] of [
        ['#ff0000', 0, 0],
        ['#00ff00', width / 2, 0],
        ['#0000ff', 0, height / 2],
        ['#ffff00', width / 2, height / 2],
      ] as const) {
        context.fillStyle = color
        context.fillRect(x, y, width / 2, height / 2)
      }
      if (transparent) context.clearRect(0, 0, 16, 16)
      return canvas.toDataURL().split(',')[1]
    },
    { width, height, transparent },
  )
  return { name: 'colors.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') }
}
async function output(page: Page, index = 0) {
  const link = page.locator('.file-row a[download]').nth(index)
  await expect(link).toBeVisible()
  return page.evaluate(
    async (url) => {
      const blob = await (await fetch(url!)).blob(),
        bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      const pixels = Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)
      return { width: canvas.width, height: canvas.height, type: blob.type, pixels }
    },
    await link.getAttribute('href'),
  )
}
async function forceWasm(page: Page) {
  await page.addInitScript(() => {
    const native = window.createImageBitmap
    window.createImageBitmap = ((source: ImageBitmapSource, ...args: unknown[]) => {
      if (source instanceof File && /\.(heic|heif)$/i.test(source.name))
        return Promise.reject(new Error('Fixture forces local WASM path'))
      return Reflect.apply(native, window, [source, ...args])
    }) as typeof createImageBitmap
  })
}

test('真实HEIC通过本地WASM转JPG；坏解码器失败后原文件可重试', async ({ page }) => {
  await forceWasm(page)
  await page.route('**/assets/heic.worker-*.js', (route) => route.abort())
  await page.goto('/#/files')
  await choose(page, '输出格式', 'JPG')
  await page.getByLabel('选择待转换文件').setInputFiles('e2e/fixtures/colors.heic')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('无法加载 HEIC 解码器')
  await page.unroute('**/assets/heic.worker-*.js')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  const result = await output(page)
  expect([result.width, result.height, result.type]).toEqual([64, 40, 'image/jpeg'])
  const pixel = (x: number, y: number) =>
    result.pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 3)
  expect(pixel(8, 8)[0]).toBeGreaterThan(200)
  expect(pixel(8, 8)[1]).toBeLessThan(60)
  expect(pixel(48, 8)[1]).toBeGreaterThan(200)
  expect(pixel(8, 30)[2]).toBeGreaterThan(200)
  await expect(page.locator('.file-row')).toContainText('colors.jpg')
})

test('裁剪旋转后按百分比缩放；指定宽高与单边等比尺寸正确，参数变化撤销旧链接', async ({ page }) => {
  await page.goto('/#/files')
  await page.getByLabel('选择待转换文件').setInputFiles(await png(page))
  await page.getByText('裁剪、旋转与水印', { exact: true }).click()
  await page.getByRole('switch', { name: '启用图片裁剪', exact: true }).click()
  await page.getByLabel('左边距（%）', { exact: true }).fill('50')
  await page.getByLabel('裁剪宽度（%）', { exact: true }).fill('50')
  await page.getByLabel('裁剪高度（%）', { exact: true }).fill('50')
  await choose(page, '图片旋转角度', '顺时针 90°')
  await choose(page, '缩放方式', '按百分比缩放')
  await page.getByLabel('缩放百分比', { exact: true }).fill('50')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  const result = await output(page)
  expect([result.width, result.height]).toEqual([10, 16])
  expect(result.pixels[1]).toBe(255)
  const oldUrl = await page.locator('.file-row a[download]').getAttribute('href')
  await page.getByRole('button', { name: '重置图片编辑', exact: true }).click()
  await expect(page.locator('.file-row a[download]')).toHaveCount(0)
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
  await choose(page, '缩放方式', '指定像素宽高')
  await page.getByLabel('输出宽度（px）', { exact: true }).fill('32')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  expect(await output(page).then(({ width, height }) => [width, height])).toEqual([32, 20])
  await page.getByLabel('输出高度（px）', { exact: true }).fill('30')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  expect(await output(page).then(({ width, height }) => [width, height])).toEqual([32, 30])
  await page.getByLabel('输出宽度（px）', { exact: true }).fill('20000')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('宽度请填写')
})

test('批量水印改变真实像素但不存正文，结果可预览，JPG透明区填白', async ({ page }) => {
  await page.goto('/#/files')
  const file = await png(page, 256, 160)
  await page.getByLabel('选择待转换文件').setInputFiles([file, { ...file, name: 'second.png' }])
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  const before = await output(page)
  await page.getByText('裁剪、旋转与水印', { exact: true }).click()
  await page.getByLabel('图片水印文字', { exact: true }).fill('仅供办理业务使用')
  await page.getByLabel('图片水印不透明度', { exact: true }).fill('80')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  const after = await output(page)
  expect(
    after.pixels.filter((value, index) => value !== before.pixels[index]).length,
  ).toBeGreaterThan(50)
  expect((await output(page, 1)).pixels).toEqual(after.pixels)
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('仅供办理业务使用')
  await page.getByRole('button', { name: '预览图片', exact: true }).first().click()
  await expect(page.locator('.file-image-preview')).toBeVisible()
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await page.getByRole('button', { name: '重置图片编辑', exact: true }).click()
  await page.getByLabel('选择待转换文件').setInputFiles(await png(page, 64, 40, true))
  await choose(page, '输出格式', 'JPG')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  const opaque = await output(page)
  const pixel = opaque.pixels.slice((4 * 64 + 4) * 4, (4 * 64 + 4) * 4 + 4)
  expect(pixel.slice(0, 3).every((channel) => channel > 240)).toBe(true)
  expect(pixel[3]).toBe(255)
})

test('AVIF输出能力检测禁用不支持项；保存的AVIF不伪装成PNG成功', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('var-file-options', JSON.stringify({ format: 'avif' }))
    const encode = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
      return encode.call(this, type === 'image/avif' ? 'image/png' : type, quality)
    }
    const blob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      return blob.call(this, callback, type === 'image/avif' ? 'image/png' : type, quality)
    }
  })
  await page.goto('/#/files')
  await expect(
    page.getByText('当前浏览器不支持 AVIF 编码，请改用 PNG、JPG 或 WebP。', { exact: true }),
  ).toBeVisible()
  await page.getByRole('combobox', { name: '输出格式', exact: true }).click()
  await expect(
    page.getByRole('option', { name: 'AVIF（当前浏览器不支持编码）', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.getByLabel('选择待转换文件').setInputFiles(await png(page))
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('不支持此输出格式')
  await expect(page.locator('.file-row a[download]')).toHaveCount(0)
  await choose(page, '输出格式', 'PNG')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  expect((await output(page)).type).toBe('image/png')
})

test('图片压缩复用编辑参数；HEIC可直接合PDF，原文件无需预转换', async ({ page }) => {
  await page.goto('/#/files?mode=image-compress')
  await page.getByLabel('选择待转换文件').setInputFiles(await png(page, 256, 160))
  await page.getByText('裁剪、旋转与水印', { exact: true }).click()
  await choose(page, '缩放方式', '指定像素宽高')
  await page.getByLabel('输出宽度（px）', { exact: true }).fill('128')
  await page.getByLabel('图片水印文字', { exact: true }).fill('压缩后仍有水印')
  await page.getByRole('button', { name: '开始转换', exact: true }).click()
  expect(await output(page).then(({ width, height }) => [width, height])).toEqual([128, 80])
  await expect(page.locator('.matrix-notice')).toContainText('128×80')
  await page.goto('/#/files?mode=image-pdf')
  await page.getByRole('button', { name: '切换并导入', exact: true }).click()
  await page.getByLabel('选择待转换文件').setInputFiles('e2e/fixtures/colors.heic')
  await page.getByRole('button', { name: '合并 PDF', exact: true }).click()
  const link = page.locator('.merged-result a[download]')
  await expect(link).toBeVisible()
  expect(
    await page.evaluate(
      async (url) => (await (await fetch(url!)).text()).slice(0, 4),
      await link.getAttribute('href'),
    ),
  ).toBe('%PDF')
})

for (const theme of ['light', 'dark'] as const)
  test(`390px ${theme}: 编辑设置和图片预览不溢出`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/#/files')
    await page.getByLabel('选择待转换文件').setInputFiles(await png(page, 320, 200))
    await page.getByText('裁剪、旋转与水印', { exact: true }).click()
    await page.getByRole('switch', { name: '启用图片裁剪', exact: true }).click()
    await page.getByLabel('左边距（%）', { exact: true }).fill('10')
    await page.getByLabel('裁剪宽度（%）', { exact: true }).fill('80')
    await page.getByLabel('图片水印文字', { exact: true }).fill('仅供办理业务使用')
    await choose(page, '缩放方式', '指定像素宽高')
    await page.getByLabel('输出宽度（px）', { exact: true }).fill('240')
    await expect(page.getByLabel('输出宽度（px）', { exact: true })).toHaveCSS('height', '36px')
    await expect(page.getByLabel('图片水印文字', { exact: true })).toHaveCSS('height', '36px')
    await page.getByRole('button', { name: '开始转换', exact: true }).click()
    await page.getByRole('button', { name: '预览图片', exact: true }).click()
    await expect(page.locator('.file-image-preview')).toBeVisible()
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important}',
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath('image-edit-mobile.png'), fullPage: true })
    await page.locator('.file-image-preview').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('image-result-mobile.png') })
  })
