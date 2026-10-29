import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

// 跨引擎验收按需运行；默认 Chromium 回归不要求安装其他浏览器。
export default defineConfig({
  ...base,
  projects: [
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
})
