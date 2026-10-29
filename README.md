# VAR · 个人网站

网站当前包含一个工具箱模块，位于 `/tools/`：免费、轻量、在浏览器本地处理，文件不上传。

[在线使用 →](https://www.hi-var.top/tools/)

## 为什么用工具箱

- **本地处理**：所有工具都在你的浏览器里运行，没有服务端、没有上传、没有账号。
- **打开即用**：无需安装，手机和电脑的浏览器都能用；访问过的工具断网后仍可打开。
- **诚实可靠**：每一步结果都可以核对——下载前看预览，做不到的明说，不假装成功。

## 五类工具

**📝 文本整理**
粘贴文字即可清理：空格、空行、重复行、PDF 复制来的断行，一键修复；原文与结果逐字高亮对比，改了哪里一目了然。还支持任意两段文本对比、邮箱等内容提取、简繁转换、详细中英字数统计，以及批量替换、列表排序编号和一次整理多份 TXT/MD。

**🔄 文件格式转换**
HEIC 等图片互转、裁剪旋转、精确缩放和批量水印，压缩到指定大小（100 KB 也能压）、图片合成 PDF、PDF 转图片、Excel / CSV / JSON / Markdown 互转、Word 与 PDF 互转。长编号、前导零、日期显示都会原样保留；Word → PDF 生成图片型文档（文字不可选中），PDF → Word 只提取文字。

**📊 表格工具**
同一入口提供「批量处理」和「表格对比」两种模式。批量处理支持 CSV / XLSX 合并、主键连接、去重、筛选、列改名排序与按字段拆分；对比支持单列或组合主键、新增 / 删除 / 修改、整行前后值及红绿高亮 XLSX / CSV 报告。切换模式保留各自草稿。

**📄 PDF 页面整理**
合并、提取、删除、旋转、排序 PDF 页面，插入图片或空白页，加页码和文字水印；支持按范围拆分、结构压缩及已知密码解密。原有 PDF 图文保持可选，下载前可预览实际结果。

**✏️ 批量重命名**
统一命名、编号补零、查找替换、逐个微调，或直接粘贴一份名称清单。重名和非法名称在导出前就被拦下，最终通过 ZIP 交付副本，原文件不动。

## 隐私

文件和文字只在你的浏览器内存中处理，关闭页面即清空；本地保存的只有你的偏好设置（主题、预设、收藏），不含任何文件内容。无需注册，没有追踪。

## 开发

使用 Node.js 22 和项目锁定的 pnpm 11.25.0，在仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev          # Next.js 本地开发
pnpm typecheck    # TypeScript
pnpm lint
pnpm test         # 现有单元测试与构建脚本检查
pnpm test:e2e     # 构建后进行浏览器回归
pnpm build       # 静态导出至 apps/web/out/
pnpm preview     # 本地预览静态产物，默认 4173 端口
```

技术栈：Next.js App Router + TypeScript + React + Tailwind CSS + shadcn/ui，部署在 GitHub Pages。使用 Webpack 构建以支持现有模块 Worker，所有文件处理仍在浏览器内完成。

## 目录与边界

按开发手册第 4 节组织为 pnpm Monorepo，只创建实际需要的应用与目录：

```text
hi-var-site/
├── AGENTS.md
├── README.md
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/                 # Next.js 页面、布局、全局样式、浏览器启动入口
│       │   ├── features/
│       │   │   └── toolbox/         # 工具箱模块，含六个子工具与内部共享能力
│       │   ├── components/
│       │   │   └── ui/              # 网站共享的 shadcn/ui 基础组件
│       │   └── lib/                # 网站公共基础能力
│       ├── e2e/
│       ├── public/
│       ├── vendor/
│       └── package.json
├── docs/
│   ├── architecture.md
│   ├── FEATURES.md
│   ├── ROADMAP.md
│   ├── CHECKS.md
│   └── THIRD_PARTY_NOTICES.md
├── scripts/                        # 静态资源、离线构建、本地预览
└── .github/workflows/deploy.yml
```

`src/app/page.tsx` 是网站首页，包含欢迎区、内容入口和网站级导航；`src/app/tools/` 是工具箱页面与元信息，调用 `features/toolbox` 的公开入口。工具箱内部维护 text、files、compare、table、pdf、rename 六个子工具，以及 components、lib、types 和 styles.css。其他网站功能以后放在 `features` 下，与 toolbox 平级。当前只有一个前端应用，不创建空的 `packages/shared`。项目没有 Python、数据库或服务端 API，暂不创建 `apps/ai-engine`；有 Python 后端需求时再用 uv 管理。

旧的 `/#/text` 等六工具地址会跳转到 `/tools/#/text`，保留模式参数；当前工具箱标签页内草稿保持原有行为。`output: 'export'` 输出标准静态站点，不包含需要服务器运行的接口。详细责任边界与发布方式见 [架构说明](./docs/architecture.md)。

## 了解更多

- [详细功能与限制](./docs/FEATURES.md) —— 每个工具的能力边界、文件大小与数量限制
- [无障碍说明](./docs/accessibility.md) —— WCAG 2.2 AA 实现、自动检查与人工验证范围
- [验证记录](./docs/CHECKS.md) —— 每一轮做了什么、怎么验证的
- [路线图](./docs/ROADMAP.md) —— 接下来做什么、明确不做什么
- [第三方许可](./docs/THIRD_PARTY_NOTICES.md)
