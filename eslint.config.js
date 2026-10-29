import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'apps/web/.next/**',
      'apps/web/out/**',
      '**/node_modules/**',
      'apps/web/public/pdf-assets/**',
      'apps/web/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    extends: [reactHooks.configs.flat['recommended-latest']],
    rules: {
      // 现有代码使用「props 变化时复位状态」与防抖处理管线两种模式，
      // 均经过浏览器实测验证，不按新规则强行重写
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      '*.config.*',
      'apps/web/*.config.*',
      'apps/web/src/features/toolbox/lib/offline.ts',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Playwright 端到端测试运行在 Node 侧，不受 react-hooks 规则约束
    files: ['apps/web/e2e/**/*.ts', 'apps/web/playwright.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    extends: [],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['apps/web/public/**/sw.js', 'apps/web/public/sw.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
)
