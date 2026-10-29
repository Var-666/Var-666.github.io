# VAR 网站项目约定

- 项目是 VAR 网站；工具箱只是其中一个业务模块，入口 `/tools/`，不是整个网站。工具文件与正文只在浏览器本地处理，不上传、不自动持久化。
- 技术栈：pnpm workspace、Next.js App Router、React、TypeScript、Tailwind CSS、shadcn/ui。
- 前端位于 `apps/web`，静态导出至 `apps/web/out`，GitHub Pages 部署；既有根路径工具 hash 地址跳转到 `/tools/`，工具间草稿保留。
- 当前无 Python、服务端 API、数据库或迁移。将来确有 Python 需求时使用 uv，不预建空服务。

## 目录与依赖方向

- `apps/web/src/app` 仅维护页面、布局、全局样式和客户端启动边界。文件处理不进入服务端。
- `src/features/toolbox` 收拢工具箱入口、六个子工具、内部组件、业务函数、hooks、Worker、专属样式和测试。以后网站其他功能与 toolbox 平级。
- 工具箱对网站暴露 `features/toolbox/index.tsx` 入口和 `legacy-redirect.tsx` 旧链接适配；工具内部可共享各子工具明确导出的函数和类型，不跨子工具引用组件、hooks 或 Worker 内部实现。
- `src/components/ui` 保留 shadcn/ui 基础组件；工具箱内部共享组件放 `src/features/toolbox/components`，不叠加第二套 UI 体系。
- `src/lib` 仅放网站公共基础能力；工具专属能力放 `features/toolbox/lib`。只有真正跨应用复用时才建立 `packages/shared`。
- 项目目录和模块责任见 `docs/architecture.md`。

## 修改与验证

- 先读入口和调用方，复用已有能力，保持最小必要修改；不预建抽象、兼容层或空目录。
- 保留输入校验、容量限制、超时、取消、文件清理和明确失败信息；不得吞异常冒充成功。
- 工具箱 Service Worker 只控制 `/tools/`；不接管网站首页或其他栏目。
- Office/PDF/HEIC 等重型依赖按需加载，正则和解码等耗时处理保留 Worker 边界。
- 不提交 `.env`、密钥、用户文件、生成的 PDF 资源、`.next` 或 `out`。
- 只使用 pnpm 和根目录锁文件，不再生成 npm/yarn 锁文件。
- 从仓库根目录运行：`pnpm dev`、`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm test:e2e`、`pnpm build`、`pnpm preview`。
- 按影响选择验证，不默认要求每次新增测试或运行全量测试；构建、Worker、公共契约与部署变更需要核对相应关键路径。
- 如实说明实际检查、失败与未验证部分，不把静态检查通过等同于功能全部验证。
