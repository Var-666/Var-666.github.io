# VAR · 日常工具箱

React + TypeScript + Vite + Tailwind CSS 4，使用官方 shadcn/ui New York 组件、Radix UI、Lucide 图标和 Sonner 通知。

## 本地运行

```sh
npm install
npm run dev
```

打开终端打印的本地地址。`npm test` 验证整理规则，`npm run build` 完成 TypeScript 检查并生成 `dist/`，`npm run preview` 查看构建结果。

## 工具与入口

- `#/`：工具箱首页。
- `#/text`：文本整理，保留现有全部功能。
- `#/files`：文件格式转换。使用 hash 路由，GitHub Pages 刷新子页面无需重写规则。
- 工具之间切换会保留当前页面内的输入和转换结果；刷新或关闭后清空。主题在首页与各工具间共用。

## 文件格式转换

- PNG / JPG / WebP 互转，最多 10 个文件，可单独下载或 ZIP 打包。单张 20 MB、2400 万像素，总输入 50 MB、总输出 100 MB。JPG 透明背景填白，动画仅保留第一帧，元数据不保留。
- Markdown → TXT，复用现有 Markdown 解析规则。
- CSV → JSON：逗号分隔、首行为唯一且非空的列名；保留字符串和前导零，支持引号、逗号、换行。
- JSON → CSV：非空对象数组，不支持嵌套字段；合并所有列，缺失字段留空，长整数需要写成字符串；对疑似表格公式添加单引号。
- Word `.docx` → PDF：浏览器渲染并输出图片版 A4 PDF，文字不能选择。字体、复杂分页、表格等不保证原样还原，不支持旧 `.doc`。外部资源在隔离渲染区域内禁止加载，文件解压大小受限。
- 文字型 PDF → Word `.docx`：提取文字、保留页间分页，不恢复图片、表格与布局。扫描件、含无文字页的混合文档、加密 PDF 不转换，以免无提示地遗漏内容。
- 文本类文件单个 2 MB、UTF-8；办公文档单个 10 MB、最多 50 页。所有转换在本地执行，没有服务端或文件上传。转换依赖按需加载。`predev` / `prebuild` 从已安装的 PDF.js 复制中文字符映射与标准字体到 `public/pdf-assets/`，该生成目录不提交 Git。

## 文本整理

- 日常清理、PDF 复制文字断行修复、名单去重、中文排版、Markdown 转纯文本。
- Markdown 模式去除标题、强调、引用和列表标记，保留代码内容和缩进；链接保留为“文字（网址）”，图片保留说明，表格转成制表符分隔的文本行。
- 原文与结果对照，实时整理，单项规则设置，恢复预设。
- TXT / Markdown 导入及拖放（UTF-8，最大 2 MB、100 万字符），TXT 下载，复制结果。
- 撤销上次导入、示例替换或清空。原文框输入支持浏览器原生撤销。
- 手机端原文/结果切换，深浅主题，键盘操作，使用指南。
- 文本通过 Web Worker 在本地处理；只把设置和主题保存在 localStorage，正文不自动持久化。

## 结构

- `src/App.tsx`：首页、导航和共用主题。
- `src/TextTool.tsx`：原文本工具、文件与剪贴板交互、设置。
- `src/FileTool.tsx`：转换队列、错误状态、结果与批量下载。
- `src/lib/file-convert.ts`：本地图片与办公文档转换。
- `src/lib/file-text.ts`：CSV / JSON 与 Markdown 文件转换。
- `src/lib/text.ts`：纯函数整理规则、场景预设、统计。
- `src/lib/markdown.ts`：基于 Marked 语法分析的纯文本转换，不渲染或执行 HTML。
- `src/lib/markdown.test.ts`：Markdown 格式、代码、链接、图片、表格等转换测试。
- `src/lib/text.worker.ts`：后台整理线程。
- `src/lib/text.test.ts`：保护段落、列表、链接、数字和去重顺序的测试。
- `src/lib/clipboard.test.ts`：剪贴板成功、权限拒绝及超时的测试。
- `src/components/ui/`：来自官方 shadcn/ui 注册表的组件。
- `src/index.css`：设计变量、布局及手机适配。

## 部署与边界

线上地址：https://www.hi-var.top/ 。推送到 `main` 后，GitHub Actions 使用 Node.js 22 安装锁定依赖、运行测试、构建并发布 `dist/` 到 GitHub Pages。自定义域名沿用仓库 Pages 设置，本地电脑无需保持开机。回退到此前的 Git 提交并重新发布即可恢复旧版。

`dist/` 是标准静态网站产物，可以部署在支持 HTTPS 的静态托管或自己的服务器上，再配置域名。剪贴板接口需要 HTTPS 或 localhost，权限不足时会提示使用键盘复制粘贴。

Markdown 默认保留空格与空行，避免破坏代码缩进；另外开启清理或排版规则时，这些规则会继续作用于转换后的纯文本。任务列表的复选框作为格式标记去除，正文保留。

PDF 功能接受复制后的纯文本，不解析 PDF 文件。断行修复为启发式规则，复杂表格、多栏与特殊编号可能需要手动调整。操作统计按规则命中次数计算，不等同于修改字符总数。刷新会清空正文，下载结果前请检查预览。

shadcn/ui 组件按 MIT 许可分发，见 `THIRD_PARTY_NOTICES.md`。

最近一次本地功能检查记录见 [CHECKS.md](./CHECKS.md)。
