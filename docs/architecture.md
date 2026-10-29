# 架构与数据归属

VAR 是单前端应用的 pnpm Monorepo。仓库根目录维护工作区、锁文件、稳定开发约定、文档和公共构建脚本；Next.js 应用及其依赖和运行配置位于 `apps/web`。目录采用开发手册第 4 节，仅创建当前需要的部分。

`src/app/page.tsx` 是网站首页，包含欢迎区与内容入口。`src/components/SiteHeader.tsx` 提供网站级导航，在首页和工具箱中保持一致，并标明当前栏目。`src/app/tools/` 负责工具箱路由、元信息和专属样式入口，通过 `features/toolbox/index.tsx` 启动工具箱。旧的根路径工具 hash 地址会跳转至 `/tools/`，保留具体工具及模式参数。

工具箱是 `src/features/toolbox` 下的一个独立业务模块。内部的 `text/`、`files/`、`compare/`、`table/`、`pdf/` 和 `rename/` 分别包含对应的业务函数、界面、hooks、Worker 与测试。入口、首页、导航和文件交接仍由 toolbox 自身管理，切换子工具时保持已访问工具挂载，防止丢失尚未下载的草稿。

工具箱内部共享组件在 `toolbox/components`，存储、主题、剪贴板、输出保存、编码、离线与加载恢复在 `toolbox/lib`，专属样式在 `toolbox/styles.css`。网站级的 `src/components/ui` 保留 shadcn/ui 基础组件，`src/app/globals.css` 只维护网站基础样式和设计变量，`src/lib` 保留通用 UI 工具。以后新增网站功能与 toolbox 平级，不混入工具箱目录。当前无跨应用重复代码，不创建 `packages/shared`。

## 数据与信任边界

- 所有正文、文件、密码和处理结果属于当前浏览器标签页内存，刷新或关闭即清空。工具间传递也只发生在内存中。
- localStorage 仅保存偏好、规则预设、收藏、最近使用和转换参数。工具箱 Service Worker 仅控制 `/tools/`，缓存所需静态代码、字典、字体和 WASM，不缓存用户文件。
- 文件导入保留类型、大小、数量、解压体积、行列与像素限制；Worker 保留已有超时、取消和迟到结果保护。
- 当前无账号、数据库、API、SSE 或服务端数据，认证、迁移和 OpenAPI 生成不适用。若增加 Python 服务，使用 `apps/ai-engine` 与 uv，并先明确 API、身份和数据所有权。

## 构建与部署

Next.js 采用 `output: 'export'`，构建结果为 `apps/web/out`。使用 Webpack 编译现有模块 Worker；PDF.js 字体、Worker 及 qpdf WASM 在构建前从锁定依赖复制至应用的生成资源目录，不请求外部 CDN。

构建后脚本为静态 HTML 中的 Next.js 启动脚本生成 CSP 哈希，并为 `/tools/` 生成版本化离线清单。根路径旧 Service Worker 会自行注销，新 Worker 位于 `/tools/sw.js`，不接管网站首页和其他栏目。生产版后台 Worker 与 PDF.js Worker 同样使用 `/tools/` 下的地址，使线程内的词典、字体和 WASM 请求也能被该范围的离线缓存处理。GitHub Actions 使用锁定的 pnpm，验证格式、lint、单元测试、构建和浏览器关键流程后，发布 `apps/web/out` 到 GitHub Pages。部署配置仍在 `.github/workflows`，没有独立服务需要 Docker Compose 或 Caddy。

本地使用 `pnpm preview` 查看静态产物。回滚时恢复此前 Git 提交并重新执行构建、发布；不要混合不同构建的 HTML、Worker、WASM 和分块。切换部署版本后，Service Worker 清理旧版本缓存；正在操作的草稿不自动刷新。
