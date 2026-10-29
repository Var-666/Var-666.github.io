import { expect, test, type Page } from '@playwright/test'
import Papa from 'papaparse'

async function csv(page: Page) {
  const link = page.locator('.file-tool a[download]').first()
  await expect(link).toBeVisible()
  const text = await page.evaluate(
    async (url) => (await fetch(url)).text(),
    await link.getAttribute('href'),
  )
  return Papa.parse<string[]>(text).data
}

test('嵌套 JSON 导出点路径列，保留前导零/数组/字面点字段，公式被保护', async ({ page }) => {
  await page.goto('/tools/#/files?mode=json-csv')
  await page.getByLabel('选择待转换文件').setInputFiles({
    name: 'nested.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      '[{"user":{"name":"甲","id":"001"},"user.name":"literal","tags":["a","b"],"note":"=1+1"},{"user":{"name":"乙"}}]',
    ),
  })
  expect(await csv(page)).toEqual([
    ['user.name', 'user.id', 'user\\.name', 'tags', 'note'],
    ['甲', '001', 'literal', '["a","b"]', "'=1+1"],
    ['乙', '', '', '', ''],
  ])
  await expect(page.locator('.matrix-notice').filter({ hasText: '嵌套对象已按点' })).toBeVisible()
  await expect(page.locator('.matrix-notice').filter({ hasText: '数组保留' })).toBeVisible()
})

test('首页识别 JSONL/NDJSON 并逐行转换，坏文件显示行号且不影响成功文件', async ({ page }) => {
  await page.goto('/tools/')
  await page.getByLabel('首页选择文件', { exact: true }).setInputFiles([
    {
      name: 'log.jsonl',
      mimeType: 'application/x-ndjson',
      buffer: Buffer.from(
        '\uFEFF{"id":"001","context":{"user":"甲"}}\n\n{"id":"002","context":{"user":"乙"}}\n',
      ),
    },
    {
      name: 'bad.ndjson',
      mimeType: 'application/x-ndjson',
      buffer: Buffer.from('{"id":1}\n\n{bad}'),
    },
  ])
  await page.getByRole('button', { name: 'JSON 转 CSV', exact: true }).click()
  expect(await csv(page)).toEqual([
    ['id', 'context.user'],
    ['001', '甲'],
    ['002', '乙'],
  ])
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    '第 3 行格式不正确',
  )
  await expect(page.locator('.matrix-notice').filter({ hasText: '2 条 JSON Lines' })).toBeVisible()
})

test('JSONL 转换保留深链接，单行对象也按 JSON Lines 读取', async ({ page }) => {
  await page.goto('/tools/#/files?mode=json-csv')
  await page.getByLabel('选择待转换文件').setInputFiles({
    name: 'single.ndjson',
    mimeType: 'application/x-ndjson',
    buffer: Buffer.from('{"id":"001"}'),
  })
  expect(await csv(page)).toEqual([['id'], ['001']])
})
