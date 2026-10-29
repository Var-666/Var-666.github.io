import { defineConfig, devices } from '@playwright/test'

// 端到端回归：Next.js 静态导出 + 本地静态预览，覆盖文件转换的关键交互路径
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      process.env.PLAYWRIGHT_SKIP_BUILD === '1'
        ? 'pnpm preview --port 4173'
        : 'pnpm build && pnpm preview --port 4173',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI && process.env.PLAYWRIGHT_SKIP_BUILD !== '1',
    timeout: 180_000,
  },
})
