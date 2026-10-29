import { expect, test, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'
import { unzipSync } from 'fflate'
import Papa from 'papaparse'

const old = '编号,名称,数量,备注\n001,甲,1,旧备注\n002,乙,2,删除备注\n003,丙,3,不变备注'
const newer = '编号,名称,数量,备注\n001,甲,10,新备注\n004,丁,4,新增备注\n003,丙,3,不变备注'
async function upload(page: Page, left = old, right = newer) {
  await page.goto('/tools/#/compare')
  for (const [label, name, body] of [
    ['旧表（左）', 'old.csv', left],
    ['新表（右）', 'new.csv', right],
  ])
    await page
      .getByLabel(`选择${label}文件`, { exact: true })
      .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(body) })
}
async function output(page: Page) {
  const link = page.locator('.compare-tool a[download]')
  await expect(link).toBeVisible()
  return new Uint8Array(
    await page.evaluate(
      async (url) => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),
      await link.getAttribute('href'),
    ),
  )
}
async function choose(page: Page, label: string, value: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: value, exact: true }).click()
}

test('新增/删除显示整行，统计按钮切换类型，筛选不影响 XLSX 中全部差异和真实填充色', async ({
  page,
}) => {
  await upload(page)
  await expect(page.getByRole('table', { name: '新增记录（1）', exact: true })).toContainText(
    '新增备注',
  )
  await expect(page.getByRole('table', { name: '删除记录（1）', exact: true })).toContainText(
    '删除备注',
  )
  await page.getByRole('button', { name: '新增 1', exact: true }).click()
  await expect(page.getByRole('table', { name: '删除记录（1）', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '修改记录（1）', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^导出 XLSX/ }).click()
  const workbook = XLSX.read(await output(page), { type: 'array', cellStyles: true })
  expect(workbook.SheetNames).toHaveLength(3)
  const added = workbook.Sheets[workbook.SheetNames[0]],
    removed = workbook.Sheets[workbook.SheetNames[1]],
    changed = workbook.Sheets[workbook.SheetNames[2]]
  expect(added.A2.v).toBe('004')
  expect(removed.A2.v).toBe('002')
  expect(changed.C2.v).toBe('1')
  expect(changed.D2.v).toBe('10')
  expect(added.A2.s.fgColor.rgb).toBe('E2F0D9')
  expect(removed.A2.s.fgColor.rgb).toBe('FCE4E4')
  expect(changed.C2.s.fgColor.rgb).toBe('FCE4E4')
  expect(changed.D2.s.fgColor.rgb).toBe('E2F0D9')
  expect(added.A2.t).toBe('s')
  await page.getByRole('button', { name: '未变 1', exact: true }).click()
  await expect(page.getByRole('table', { name: '未变记录（1）', exact: true })).toContainText('003')
  await expect(page.getByRole('table', { name: '新增记录（1）', exact: true })).toHaveCount(0)
})

test('组合主键区分同编号不同地区，导出保留完整元组、空值与重复诊断', async ({ page }) => {
  await upload(
    page,
    '编号,地区,数量\n001,北京,1\n001,上海,2\n,空白,3',
    '编号,地区,数量\n001,北京,10\n001,上海,2\n002,深圳,4\n,空白,5',
  )
  await page.getByRole('switch', { name: '使用组合主键', exact: true }).click()
  await page.getByRole('checkbox', { name: '主键字段 地区', exact: true }).check()
  await expect(page.getByRole('button', { name: '修改 1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '未变 1', exact: true })).toBeVisible()
  await expect(page.getByText(/重复主键（按首次出现匹配）/)).toHaveCount(0)
  await expect(page.getByText(/主键为空：旧表 1 行、新表 1 行/)).toBeVisible()
  await page.getByRole('button', { name: '导出 CSV（ZIP 三个文件）', exact: true }).click()
  const files = unzipSync(await output(page))
  const text = Buffer.from(files['修改明细.csv'])
    .toString()
    .replace(/^\uFEFF/, '')
  expect(Papa.parse<string[]>(text).data[1]).toEqual(['["001","北京"]', '数量', '1', '10'])
})

test('对比结果跨工具保留，规则变化回收旧下载；读取失败保留旧表与真实编码', async ({ page }) => {
  await upload(page)
  await page.getByRole('button', { name: /^导出 XLSX/ }).click()
  const link = page.locator('.compare-tool a[download]')
  const url = await link.getAttribute('href')
  await page.evaluate(() => {
    location.hash = '#/'
  })
  await expect(page.getByRole('heading', { name: '全部工具', exact: true })).toBeVisible()
  expect(await page.evaluate(async (url) => (await fetch(url)).ok, url)).toBeTruthy()
  await page.evaluate(() => {
    location.hash = '#/compare'
  })
  await expect(link).toBeVisible()
  await page.getByRole('button', { name: '新增 1', exact: true }).click()
  await expect(link).toBeVisible()
  await choose(page, '主键列', '名称')
  await expect(link).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(async (url) => {
        try {
          await fetch(url)
          return false
        } catch {
          return true
        }
      }, url),
    )
    .toBeTruthy()
  await page.getByLabel('选择旧表（左）文件', { exact: true }).setInputFiles({
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 120),
  })
  await expect(page.getByText(/CSV 单个最多 2 MB/)).toBeVisible()
  await expect(page.locator('.compare-file-meta').filter({ hasText: 'old.csv' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增 1', exact: true })).toBeVisible()
})

for (const theme of ['light', 'dark'] as const)
  test(`390px ${theme}: 整行结果、组合主键和高级规则可达，统计筛选无溢出`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await upload(page)
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important}',
    })
    await page.getByRole('switch', { name: '使用组合主键', exact: true }).click()
    await page.getByRole('checkbox', { name: '主键字段 名称', exact: true }).check()
    await page.getByText('比较范围与空格规则', { exact: true }).click()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy()
    await page.screenshot({ path: info.outputPath('compare-upgrade-mobile.png'), fullPage: true })
  })
