import type { Page } from '@playwright/test'

export async function openTool(page: Page, title: string) {
  await page
    .getByRole('navigation', { name: '网站导航' })
    .getByRole('link', { name: '工具箱', exact: true })
    .click()
  const name = ['表格对比', '表格批量处理'].includes(title) ? '表格工具' : title
  await page
    .locator('.tool-card')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .click()
  if (title === '表格对比') await page.getByRole('tab', { name: '表格对比', exact: true }).click()
}
