# 重设计版设计风格指南 · 2026-10-30

来源：工作区同级目录 `Redesign Personal Portfolio Website`（Figma Make 导出，2026-10-30 19:23 生成）。
本文从其源码抽取完整设计语言，作为后续视觉改版（ROADMAP 第 1 轮首页导航等）的对照基准。
只做记录，不改变现有实现；落地时按节末的映射建议分批进行。

## 1. 总体定位

Apple 官网式的双轨叙事：

- **首页（营销面）**：纯黑 hero（极光背景 + 轨道动效）→ 浅灰 `#f5f5f7` 内容区（bento 卡片网格）→ 纯黑 CTA → 浅灰 footer。深浅区块交替，导航栏样式随滚动位置自动切换（`data-nav="dark|light"` 探测）。
- **工具区（工作台面）**：独立浅色/深色双主题（默认跟随系统，localStorage 记忆 `var-theme`），信息密度高，圆角胶囊 + 毛玻璃工具条。

## 2. 颜色令牌

### 工具区主题变量（`.tb` 作用域，`src/index.css`）

| 变量 | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--tb-bg` | `#f5f5f7` | `#000000` | 页面底色 |
| `--tb-card` | `#ffffff` | `#1c1c1e` | 卡片 |
| `--tb-raise` | `#fbfbfd` | `#2c2c2e` | 输入框/内嵌面板 |
| `--tb-fg` | `#1d1d1f` | `#f5f5f7` | 主文字 |
| `--tb-mute` | `#6e6e73` | `#a1a1a6` | 次要文字 |
| `--tb-line` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.1)` | 分隔线/描边 |
| `--tb-link` | `#0066cc` | `#2997ff` | 链接 |
| `--tb-chip` | `#e8e8ed` | `#2c2c2e` | 次级按钮/胶囊底 |

三级灰：`#86868b`（标题弱化句，如「已经开放的，和正在准备的。」）。

### 功能色（Apple 系统色）

| 色 | 值 | 用途 |
| --- | --- | --- |
| 主蓝 | `#0071e3`（hover `#0077ed`） | 主按钮、focus ring、拖放高亮 |
| 链接蓝 | `#2997ff`（深底）/ `#0066cc`（浅底） | 文字链接、辅助入口 |
| 绿 | `#30d158` | 成功、在线、已开放、Toggle 选中 |
| 橙 | `#ff9f0a` | 警告、离线、收藏星、badge |
| 红 | `#ff3b30` | 错误 |
| 紫/粉/青 | `#bf5af2` / `#ff375f` / `#64d2ff` | 工具识别色 |

状态徽章公式：色值 12–15% 透明度做底 + 同色深字（浅色模式用更深的文字变体，如绿配 `#1f9d45`、橙配 `#c27100`、蓝配 `#0058b0`）。

### 工具识别色（渐变图标底，140deg）

| 工具 | 主色 | 渐变 |
| --- | --- | --- |
| 文本整理 | `#30d158` | `linear-gradient(140deg,#5be37d,#00a68a)` |
| 文件转换 | `#0a84ff` | `linear-gradient(140deg,#40a9ff,#5e5ce6)` |
| 表格工具 | `#ff9f0a` | `linear-gradient(140deg,#ffb340,#ff5e3a)` |
| PDF | `#ff375f` | `linear-gradient(140deg,#ff6482,#bf5af2)` |
| 重命名 | `#bf5af2` | `linear-gradient(140deg,#d17bff,#5e5ce6)` |

图标规格：白色 icon（strokeWidth 1.75，尺寸 = 容器 46%），内高光 + 投影：
`shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_20px_-8px_rgba(0,0,0,0.35)]`。

### 首页 hero 特有色

金属渐变字：`bg-gradient-to-b from-white via-[#f5f5f7] to-[#86868b] bg-clip-text text-transparent`；
极光渐变字：`linear-gradient(90deg,#2997ff,#a259ff,#ff6482,#ff9f0a,#2997ff)` + shimmer；
极光 blob：`#2f6bff` / `#a24bff` / `#ff4f8b` 的 radial-gradient（opacity 0.3–0.5，16–22s 漂移）。

## 3. 字体与排版

- 字体栈：`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif`（现站缺 SF Pro Display/Text 两级）。
- 字距：正文 `-0.01em`；标题随字号收紧，section 级 `-0.02em ~ -0.035em`，hero 级 `-0.045em ~ -0.05em`。
- 流式标题（clamp）：hero `clamp(52px,8.6vw,116px)/1.04`；section 标题 `clamp(40px,5.5vw,64px)/1.08`；工具页 h1 `clamp(30px,3.6vw,40px)`；卡片大标题 32px、中标题 24–28px。
- 正文 14–17px / 行高 1.5；说明文字 13–14px；法务 footer 12px / 1.6；数字一律 `tabular-nums`。
- 标志性句式：**「标题。+ 灰色续句」**，如 `工具箱。顺手的工具，就在浏览器里。`（续句用 `--tb-mute` 或 `#86868b`）。

## 4. 形状、阴影与布局

- 圆角阶梯：大卡 28px / 中卡 24px / 内嵌面板与功能格 20px / 输入框 10px / Collapsible 18px / 图标容器 15–22px / 按钮与胶囊全圆。
- 阴影：静止卡 `0 2px 12px rgba(0,0,0,0.04)`；hover 升起 `-translate-y-1` + `0 24px 50px -20px rgba(0,0,0,0.25)`；主 CTA 光晕 `0 0 40px -5px rgba(0,113,227,0.8)`；黑卡内 radial 光斑跟随指针（trackPointer 写 CSS 变量，不触发 re-render）。
- 容器：首页 `max-w-[1100px]`（footer 980px），工具区 `max-w-[1180px]`（工具页 1280px），水平 padding 20px。
- 导航：sticky 高 48px（工具条再叠一层 48px），`backdrop-blur-2xl backdrop-saturate-150`，浅色 `bg-white/70` / 深色 `bg-black/60`，底部 1px 半透明线；当前项用 2px 底线（非现站的底色块）。
- 工具页骨架（ToolShell）：面包屑 + 工具切换器（26px 图标，激活 ring-2 主蓝）+ 主题键 → 标题区（64px 渐变图标 + 标题 + tagline + 模式 segmented + 「说明与限制」grid-rows 折叠）→ 双栏主区 `lg:grid-cols-[minmax(0,1fr)_340px]`，aside sticky top-112px → 底部固定操作栏（毛玻璃 + 状态左、按钮右）。

## 5. 组件模式

- **Button**：胶囊。primary `bg-[#0071e3] text-white hover:bg-[#0077ed]`；secondary `bg-tb-chip`；ghost `text-tb-link hover:bg-tb-chip`；统一 `px-4 py-2 text-[14px] font-medium`。
- **Segmented**：`rounded-[14px] bg-tb-chip p-1`，选中项 `bg-tb-card shadow-sm`，未选中 `text-tb-mute`；badge 橙色 15% 底。
- **Toggle**：38×22 iOS 开关，选中 `#30d158`，knob 18px 白球。
- **输入框**：`bg-tb-raise ring-1 ring-tb-line focus:ring-2 focus:ring-[#0071e3]`（深色用 chip 底）。
- **Notice**：四 tone（info/warn/error/ok）各 10–12% 同色底 + 14px 圆角 + 图标。
- **DropZone**：2px 虚线框，中央主蓝圆钮 56px 带光晕，拖入时文案换「松手，看看能做什么」并 `scale-[1.01]` + 3px 蓝描边。
- **Card 列表**：bento 网格（6 列跨度 3/3/2/2/2），间距 20px；卡片 hover 升起，右上角 hover 出现工具色 radial 光晕。
- **Collapsible**：grid-template-rows 0fr→1fr 过渡（300–500ms），无 max-height hack。

## 6. 动效

| 名称 | 参数 | 用途 |
| --- | --- | --- |
| blur-in | blur(18px)+translateY(28px)+scale(1.03)→0，1.3s `cubic-bezier(0.2,0.7,0.1,1)`，阶梯 delay 150ms | 首屏进场 |
| Reveal | translateY(8/10)→0 + opacity，700–1000ms，IntersectionObserver 阈值 0.15–0.2，逐卡 delay 70–100ms | 滚动显现 |
| drift | 16/19/22s ease-in-out infinite | 极光 blob 漂移 |
| float / shimmer / marquee | 6s / 6s / 40s | 悬浮、文字流光、跑马灯 |
| grain | SVG feTurbulence 噪点，opacity 0.07 overlay | 黑色区块质感 |

交互微动效：hover 统一 `transition duration-300~500`；图标列 `group-hover:-translate-y-1.5` 逐个 delay 50ms；CTA 箭头 `group-hover:translate-x-1`；主 CTA `hover:scale-[1.04]`。
所有动效在 `prefers-reduced-motion: reduce` 下一律关闭。

## 7. 与现站（hi-var-site）的差异

| 维度 | 现站 | 重设计版 |
| --- | --- | --- |
| 主色 | 靛蓝 `#3653cd` 商务风 | Apple 蓝 `#0071e3` + 系统功能色 |
| 页面底 | `#f7f8fa` 单一浅色 | 首页黑白交替叙事；工具区浅/深双主题 |
| 卡片 | 16px 圆角、1px 边框、hover 换边框色 | 24–28px 圆角、无边框、双层阴影 hover 升起 |
| 按钮 | 8px 圆角矩形 | 全圆胶囊 |
| 导航 | 72px 实底 header、当前项底色+下划线 | 48px 毛玻璃 sticky、当前项 2px 底线、随区块换肤 |
| 排版 | 32–56px 标题 | 40–128px clamp 流式大标题 + 灰色续句 |
| 图标 | soft-blue 底色块 | 每工具专属双色渐变 + 内高光 |
| 动效 | 基础 transition（0.15s） | blur-in / Reveal / 极光 / 光斑跟随等成套体系 |

## 8. 落地建议（供后续批次参考，本次未实施）

1. **令牌先行**：把第 2 节的 `--tb-*` 变量与功能色并入 `globals.css`（保留现站 `--background` 等给工具内部渐替），新变量不影响既有页面即可合入。
2. **首页重写**（对应 ROADMAP 第 1 轮「首页导航」）：现 `home-intro/home-module` 结构替换为 Hero（黑）/Explore（浅灰 bento）/FinalCTA（黑）三段；SiteHeader 改 SiteNav 毛玻璃样式并接入 `data-nav` 换肤。注意保留 skip-link、focus-visible outline 与 `aria-current`（accessibility 套件依赖）。
3. **工具区换肤**：ToolShell 骨架（面包屑+切换器+底部操作栏）可整体映射到现 `ToolLoader`/各工具布局；组件按第 5 节样式逐个替换。
4. **风险**：`e2e/ui-consistency.spec.ts`、`accessibility*.spec.ts`、`home.spec.ts` 断言的选择器与文案会大面积受影响，改版批次需同步更新测试；`theme.ts`/`ThemeProvider` 需与 `--tb-*` 双轨变量合并，避免两套主题脚本并存。
5. **性能注意**：blur-in 与大面积 backdrop-blur 在低端机的合成开销明显，落地时保留 reduced-motion 降级，并考虑对工具区首页外的 blur 层数做收敛。
