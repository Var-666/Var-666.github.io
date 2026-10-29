import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import { exifJpeg } from './fixtures/exif'

test.use({ serviceWorkers: 'block' })

const file = (name: string, text = name) => ({
  name,
  mimeType: 'text/plain',
  buffer: Buffer.from(text),
})
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
async function advanced(page: Page) {
  await page.getByText('更多规则与名单导入', { exact: true }).click()
}

test('快速模式精简默认页面；正则捕获、大小写、扩展名与排序应用到 ZIP且字节不变', async ({
  page,
}) => {
  await page.goto('/tools/#/rename')
  await expect(page.getByRole('textbox', { name: '统一名称', exact: true })).toBeHidden()
  await expect(page.getByRole('textbox', { name: '粘贴目标名称列表' })).toBeHidden()
  await page
    .getByLabel('选择需要重命名的文件')
    .setInputFiles([file('IMG_10.JPG', 'ten'), file('IMG_2.JPG', 'two')])
  await page.getByRole('button', { name: '替换', exact: true }).click()
  await page.getByRole('textbox', { name: '查找文字', exact: true }).fill('^IMG_(\\d+)$')
  await page.getByRole('textbox', { name: '替换为', exact: true }).fill('Photo-$1')
  await page.getByRole('switch', { name: '正则表达式', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '新文件名 IMG_10.JPG' })).toHaveValue(
    'Photo-10_001.JPG',
  )
  await advanced(page)
  await choose(page, '编号位数', '01')
  await choose(page, '主名大小写', '全部小写')
  await choose(page, '扩展名', '全部小写')
  await choose(page, '文件排序', '名称自然升序')
  await expect(page.locator('.rename-new input').first()).toHaveValue('photo-2_01.jpg')
  await page.getByRole('button', { name: /^生成 ZIP/ }).click()
  const url = await page.locator('.rename-tool a[download]').getAttribute('href')
  const bytes = await page.evaluate(
    async (url) => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),
    url,
  )
  const packed = unzipSync(new Uint8Array(bytes))
  expect(Object.keys(packed)).toEqual(['photo-2_01.jpg', 'photo-10_02.jpg'])
  expect(Buffer.from(packed['photo-2_01.jpg']).toString()).toBe('two')
  expect(Buffer.from(packed['photo-10_02.jpg']).toString()).toBe('ten')
})

test('正则非法/超时/Worker失败均阻止导出；关闭后可继续使用原文件', async ({ page }) => {
  await page.goto('/tools/#/rename')
  const name = 'a'.repeat(100) + '!.txt'
  await page.getByLabel('选择需要重命名的文件').setInputFiles(file(name))
  await page.getByRole('button', { name: '替换', exact: true }).click()
  await page.getByRole('switch', { name: '正则表达式', exact: true }).click()
  await page.getByRole('textbox', { name: '查找文字', exact: true }).fill('[')
  await expect(page.locator('.rename-error')).toContainText('正则无效')
  await expect(page.getByRole('button', { name: /^生成 ZIP/ })).toBeDisabled()
  await page.getByRole('textbox', { name: '查找文字', exact: true }).fill('(a+)+$')
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: '处理超时' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^生成 ZIP/ })).toBeDisabled()
  await page.getByRole('switch', { name: '正则表达式', exact: true }).click()
  await expect(page.getByRole('button', { name: /^生成 ZIP/ })).toBeEnabled()
  await page.route('**/_next/static/chunks/rename.worker.*.js', (route) => route.abort())
  await page.getByRole('switch', { name: '正则表达式', exact: true }).click()
  await expect(
    page
      .locator('[role="alert"]:not(#__next-route-announcer__)')
      .filter({ hasText: '正则预览失败' }),
  ).toBeVisible()
  await page.getByRole('switch', { name: '正则表达式', exact: true }).click()
  await expect(page.getByRole('button', { name: /^生成 ZIP/ })).toBeEnabled()
})

test('照片时间真实读取，不受时区偏移；缺失时间明确显示并阻止日期命名', async ({ page }) => {
  await page.goto('/tools/#/rename')
  await page
    .getByLabel('选择需要重命名的文件')
    .setInputFiles([
      { name: 'shot10.jpg', mimeType: 'image/jpeg', buffer: exifJpeg('2020:02:29 03:04:05') },
      { name: 'shot2.jpg', mimeType: 'image/jpeg', buffer: exifJpeg('2021:01:01 01:02:03') },
      file('missing.txt'),
    ])
  await page.getByRole('button', { name: '读取照片时间', exact: true }).click()
  await expect(page.getByRole('button', { name: '读取照片时间', exact: true })).toBeEnabled()
  await expect(page.getByText('拍摄 2020:02:29 03:04:05', { exact: true })).toBeVisible()
  await advanced(page)
  await choose(page, '日期来源', 'EXIF 拍摄时间')
  await choose(page, '日期位置', '替换主名')
  await choose(page, '日期格式', '20261027_143000')
  await expect(page.getByRole('textbox', { name: '新文件名 shot10.jpg' })).toHaveValue(
    '20200229_030405_001.jpg',
  )
  await expect(page.locator('.rename-error')).toContainText('缺少拍摄时间')
  await expect(page.getByRole('button', { name: /^生成 ZIP/ })).toBeDisabled()
  await choose(page, '文件排序', '拍摄时间从晚到早')
  await expect(page.locator('.rename-table tbody tr').first()).toContainText('shot2.jpg')
  await expect(page.locator('.rename-table tbody tr').last()).toContainText('missing.txt')
  await page.getByRole('button', { name: '移除 missing.txt', exact: true }).click()
  await expect(page.getByRole('button', { name: /^生成 ZIP/ })).toBeEnabled()
})

for (const theme of ['light', 'dark'] as const)
  test(`390px ${theme}: 重命名快速与展开规则不溢出，修改时间和扩展名有预览`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/tools/#/rename')
    await expect(page.getByLabel('选择需要重命名的文件')).toBeAttached()
    await page.addStyleTag({
      content:
        '*, *::before, *::after { transition: none !important; animation: none !important; }',
    })
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="选择需要重命名的文件"]',
      )!
      const data = new DataTransfer()
      data.items.add(
        new File(['001'], 'Report.TXT', {
          lastModified: new Date(2026, 9, 27, 14, 30, 0).getTime(),
        }),
      )
      input.files = data.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.getByRole('button', { name: '前后缀', exact: true }).click()
    await page.getByRole('textbox', { name: '前缀', exact: true }).fill('项目-')
    await advanced(page)
    await choose(page, '日期来源', '文件修改时间')
    await choose(page, '日期格式', '2026-10-27_14-30-00')
    await choose(page, '扩展名', '指定扩展名')
    await page.getByRole('textbox', { name: '新扩展名', exact: true }).fill('.md')
    await expect(page.getByRole('textbox', { name: '新文件名 Report.TXT' })).toHaveValue(
      '项目-2026-10-27_14-30-00_Report_001.md',
    )
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath('rename-rules-mobile.png'), fullPage: true })
  })
