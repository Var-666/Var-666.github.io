import { expect, test, type Page } from '@playwright/test'

// 离线可用性：Service Worker 仅在生产构建注册（vite preview 服务 dist 满足条件）。
// 策略：导航网络优先 → 断网时回退缓存；同源资源 stale-while-revalidate。
async function waitForSwControl(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    // sw.js 注册在入口之后；轮询直到接管页面
    for (let i = 0; i < 100; i++) {
      if (navigator.serviceWorker.controller) return
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('Service Worker 未接管页面')
  })
}

async function visitAllTools(page: Page) {
  // 先在线访问一次，让懒加载 chunk 进入 stale-while-revalidate 缓存
  for (const route of ['#/text', '#/files', '#/compare', '#/table', '#/pdf', '#/rename']) {
    await page.goto(`/${route}`)
    await page.waitForLoadState('load')
  }
}

const routes: [string, RegExp][] = [
  ['#/text', /文本整理/],
  ['#/files', /文件格式转换/],
  ['#/compare', /表格对比/],
  ['#/table', /表格批量处理/],
  ['#/pdf', /PDF 页面整理/],
  ['#/rename', /批量重命名/],
]

test('Service Worker 接管页面并预缓存入口资源', async ({ page }) => {
  await waitForSwControl(page)
  const state = await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    const keys = await caches.keys()
    const cache = await caches.open(keys[0])
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      keys,
      entries: (await cache.keys()).length,
    }
  })
  expect(state.controlled).toBe(true)
  expect(state.keys.some((key) => key.startsWith('var-toolbox-'))).toBe(true)
  expect(state.entries).toBeGreaterThan(5)
})

test('断网后已访问过的工具页仍可打开', async ({ page, context }) => {
  await waitForSwControl(page)
  await visitAllTools(page)
  await context.setOffline(true)
  for (const [route, heading] of routes) {
    await page.goto(`/${route}`)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10_000 })
  }
  await context.setOffline(false)
})

test('断网时未访问过的懒加载工具给出可理解的失败而非白屏', async ({ page, context }) => {
  // 只预热首页，不访问任何工具：懒加载 chunk 不在缓存
  await waitForSwControl(page)
  await context.setOffline(true)
  await page.goto('/#/pdf')
  // 页面外壳（缓存）仍应渲染，动态模块加载失败时显示加载占位而非崩溃
  await expect(page.locator('body')).toContainText(/正在加载|PDF 页面整理/, { timeout: 10_000 })
  await context.setOffline(false)
})
