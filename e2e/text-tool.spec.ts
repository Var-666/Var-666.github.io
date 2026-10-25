import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/#/text')
  await expect(page.getByRole('heading', { name: '文本整理' })).toBeVisible()
})

test('批量替换：命中计数、预览与应用后原文可再执行', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: '原始文本' })
  await editor.fill('客户A已签约\n客户B待跟进\n客户A已签约')
  await page.getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('textbox', { name: '第 1 条查找' }).fill('客户')
  await page.getByRole('textbox', { name: '第 1 条替换' }).fill('Customer')
  await expect(page.getByText('命中 3 处')).toBeVisible()
  await expect(page.getByLabel('替换预览')).toContainText('CustomerA已签约')
  await page.getByRole('button', { name: /应用替换（共 3 处）/ }).click()
  await expect(editor).toHaveValue('CustomerA已签约\nCustomerB待跟进\nCustomerA已签约')
  // 面板保持打开，规则保留，可对替换后的正文再次执行
  await expect(page.getByText('命中 0 处')).toBeVisible()
})

test('非法正则给出规则序号提示且不能应用', async ({ page }) => {
  await page.getByRole('textbox', { name: '原始文本' }).fill('示例')
  await page.getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('switch', { name: '第 1 条使用正则' }).click()
  await page.getByRole('textbox', { name: '第 1 条查找' }).fill('[')
  await expect(page.getByRole('alert')).toContainText('第 1 条规则的正则无效')
})

test('格式转换：多行转 SQL IN 并应用回写原文', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: '原始文本' })
  await editor.fill("A01\nB'02\nC03")
  await page.getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('combobox', { name: '输出格式' }).click()
  await page.getByRole('option', { name: 'SQL IN (…)' }).click()
  await expect(page.getByText(/3 个条目/)).toBeVisible()
  await expect(page.getByLabel('格式转换预览')).toHaveText("('A01', 'B''02', 'C03')")
  await page.getByRole('button', { name: '应用格式转换' }).click()
  await expect(editor).toHaveValue("('A01', 'B''02', 'C03')")
})

test('列表处理：排序加行号并显示行数变化', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: '原始文本' })
  await editor.fill('banana\napple\n\ncherry')
  await page.getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('combobox', { name: '行排序' }).click()
  await page.getByRole('option', { name: '拼音升序' }).click()
  await page.getByRole('switch', { name: '删除空行' }).click()
  await expect(page.getByText('4 行 → 3 行（1 行被移除）')).toBeVisible()
  await expect(page.getByLabel('列表处理预览')).toHaveText('apple\nbanana\ncherry')
  await page.getByRole('button', { name: '应用列表处理' }).click()
  await expect(editor).toHaveValue('apple\nbanana\ncherry')
})
