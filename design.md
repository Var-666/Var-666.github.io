# Design System · var 个人站

> 唯一的设计规范源。所有组件的颜色、字号、间距、圆角、阴影、状态都从这里出发。
> CSS 变量定义在 `src/style.css` 的 `:root` 中，组件内禁止硬编码这些值。

---

## 1. 色彩

### 浅色底 (Light Surface)

| 角色 | 变量名 | 值 | 用途 |
|------|--------|-----|------|
| 底色 | `--c-bg` | `#FAF8F5` | 页面背景 |
| 底色次 | `--c-bg-alt` | `#F0EDE8` | 交替区块底色 |
| 卡面 | `--c-surface` | `#FFFFFF` | 卡片、弹出层底色 |
| 卡面悬停 | `--c-surface-hover` | `#F7F5F1` | 卡片 hover |
| 凹陷 | `--c-surface-sunken` | `#EDEAE5` | 输入框底色 |

### 深色底 (Dark Surface)

| 角色 | 变量名 | 值 | 用途 |
|------|--------|-----|------|
| 深底 | `--c-bg-dark` | `#242725` | Contact / Player 区域 |
| 深底次 | `--c-bg-dark-alt` | `#2E312F` | 深色卡片底 |
| 深色面 | `--c-surface-dark` | `rgba(42, 45, 43, 0.92)` | 深色区域卡片 |

### 边框

| 角色 | 变量名 | 值 |
|------|--------|-----|
| 默认 | `--c-border` | `rgba(0,0,0, 0.08)` |
| 微弱 | `--c-border-subtle` | `rgba(0,0,0, 0.05)` |
| hover | `--c-border-hover` | `rgba(91,140,110, 0.4)` |
| 深色底 | `--c-border-dark` | `rgba(255,255,255, 0.12)` |
| 深色底 hover | `--c-border-dark-hover` | `rgba(255,255,255, 0.25)` |

### 文字

| 角色 | 变量名 | 浅底值 | 深底值 |
|------|--------|--------|--------|
| 主文字 | `--c-text` | `#2C2C2E` | — |
| 次文字 | `--c-text-2` | `#6B6B6F` | — |
| 辅文字 | `--c-text-3` | `#9A9A9E` | — |
| 反色主 | `--c-text-inv` | — | `#F0EFED` |
| 反色次 | `--c-text-inv-2` | — | `rgba(240,239,237, 0.65)` |
| 反色辅 | `--c-text-inv-3` | — | `rgba(240,239,237, 0.4)` |

> **对比度规则**：主文字在浅底上 ≥ 7:1，次文字 ≥ 4.5:1，辅文字 ≥ 3:1 (仅限大字或装饰)。
> 反色文字在深底上同等标准。

### 强调色

| 角色 | 变量名 | 值 | 用途 |
|------|--------|-----|------|
| 铜绿 | `--c-accent` | `#5B8C6E` | 按钮、链接、选中态 |
| 铜绿浅 | `--c-accent-light` | `#78A688` | hover 态 |
| 铜绿深 | `--c-accent-dark` | `#4A7559` | 按钮 pressed |
| 铜绿晕 | `--c-accent-glow` | `rgba(91,140,110, 0.15)` | 聚焦环 |
| 铜绿柔 | `--c-accent-soft` | `rgba(91,140,110, 0.08)` | 标签背景 |
| 琥珀 | `--c-warm` | `#C8944A` | 辅助强调、高亮 |
| 琥珀浅 | `--c-warm-light` | `#DEAE6B` | hover |
| 错误 | `--c-error` | `#C45B4A` | 错误状态 |
| 错误柔 | `--c-error-soft` | `rgba(196,91,74, 0.08)` | 错误背景 |

---

## 2. 字体

```
衬线标题：'Noto Serif SC', 'Songti SC', serif     → --f-serif
系统正文：-apple-system, BlinkMacSystemFont,
          'Noto Sans SC', system-ui, sans-serif     → --f-sans
等宽数据：'JetBrains Mono', 'Fira Code', monospace → --f-mono
```

### 字号阶梯

只用这 7 级，不发明中间值：

| Token | rem | px (≈) | 用途 |
|-------|-----|--------|------|
| `--fs-display` | `clamp(2rem, 3.6vw, 2.8rem)` | 32–45 | 板块标题 (衬线) |
| `--fs-h3` | `1.15rem` | 18 | 卡片标题、分组标题 (衬线) |
| `--fs-body` | `0.95rem` | 15 | 正文、按钮、输入框 |
| `--fs-sm` | `0.84rem` | 13 | 副文字、标签描述 |
| `--fs-xs` | `0.75rem` | 12 | 芯片标签、时间戳、角标 |
| `--fs-hero` | `clamp(4rem, 14vw, 11rem)` | — | 首屏大字，仅 Hero |
| `--fs-mono` | `0.82rem` | 13 | 等宽数据显示 |

> 行高：正文 `1.7`，标题 `1.3`，紧凑标签 `1.4`。

---

## 3. 间距

8px 网格，只用这些倍数：

| Token | 值 |
|-------|----|
| `--sp-1` | `4px` |
| `--sp-2` | `8px` |
| `--sp-3` | `12px` |
| `--sp-4` | `16px` |
| `--sp-5` | `20px` |
| `--sp-6` | `24px` |
| `--sp-8` | `32px` |
| `--sp-10` | `40px` |
| `--sp-12` | `48px` |
| `--sp-16` | `64px` |

### 组件内部间距

| 组件 | 内边距 | 元素间距 |
|------|--------|----------|
| 卡片 | `--sp-6` (24px) | `--sp-3` (12px) 元素之间 |
| 按钮 | `12px 28px` | `--sp-2` (8px) icon-text |
| 输入框 | `13px 18px` | — |
| 芯片标签 | `5px 14px` | `--sp-2` 内部 gap |
| 板块间 | `--section-py: 110px` | — |
| 板块头-内容 | `--sp-10` (40px) | — |

---

## 4. 圆角

只用这 4 + 1 级：

| Token | 值 | 用途 |
|-------|----|------|
| `--r-lg` | `16px` | 大卡片、弹出面板、表单容器 |
| `--r-md` | `12px` | 标准卡片、输入框 |
| `--r-sm` | `8px` | 小元素、时间线节点 |
| `--r-xs` | `4px` | 进度条、代码块 |
| `--r-full` | `9999px` | 按钮、芯片、头像、导航药丸 |

> 同一个组件只用一种圆角。卡片内嵌元素的圆角 = 外层圆角 − 内边距（即视觉保持等距）。

---

## 5. 阴影

只用这 3 级：

| Token | 值 | 用途 |
|-------|----|------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)` | 芯片、小元素 |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)` | 卡片默认 |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)` | 卡片 hover、弹出层 |

---

## 6. 动效

| Token | 值 | 用途 |
|-------|----|------|
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | 通用出场 |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | 退出 |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 弹性交互 |
| `--dur` | `0.28s` | 通用 hover/focus 过渡 |
| `--dur-slow` | `0.6s` | 大面积展开 |

> `prefers-reduced-motion: reduce` 时全部归零。

---

## 7. 组件规范

### 按钮 (Button)

**三种，只有三种：**

| 类名 | 外观 | 用途 |
|------|------|------|
| `.btn-primary` | 铜绿实底、白字、`--r-full` | 核心行为（提交、播放） |
| `.btn-secondary` | 透明底、墨石字、1.5px 边框、`--r-full` | 次要行为（跳转、取消） |
| `.btn-ghost` | 无底无框、铜绿字 | 内联链接级操作 |

**统一属性：**
- 字号：`--fs-body` (0.95rem)
- 字重：600 (primary) / 500 (secondary & ghost)
- 内边距：`12px 28px`
- icon-text gap：`8px`
- hover：primary 变深 + 上浮 2px；secondary 加铜绿底；ghost 加下划线
- focus-visible：`2px solid var(--c-accent)` offset 3px
- disabled：opacity 0.5, pointer-events none
- 加载中：文字替换为旋转的 spinner + "发送中..."

### 卡片 (Card)

**两种底色：**

| 类名 | 底色 | 边框 | 圆角 |
|------|------|------|------|
| `.card` | `--c-surface` (#FFF) | `--c-border` | `--r-md` (12px) |
| `.card-dark` | `--c-surface-dark` | `--c-border-dark` | `--r-md` (12px) |

**统一属性：**
- 内边距：`--sp-6` (24px)
- 阴影：`--shadow-md`，hover 时 `--shadow-lg`
- hover：translateY(-2px) + 边框变 `--c-border-hover`
- 内部标题：`--fs-h3`，衬线，font-weight 600
- 内部正文：`--fs-sm`，`--c-text-2`

### 输入框 (Input / Textarea)

| 属性 | 值 |
|------|----|
| 底色 | `--c-surface` (浅底) / `rgba(255,255,255,0.06)` (深底) |
| 边框 | `1.5px solid --c-border` |
| 圆角 | `--r-md` (12px) |
| 内边距 | `13px 18px` |
| 字号 | `--fs-body` |
| placeholder | `--c-text-3` |
| focus | 边框 `--c-accent`，外环 `0 0 0 3px --c-accent-glow` |

### 芯片标签 (Chip)

| 属性 | 值 |
|------|----|
| 底色 | `--c-accent-soft` |
| 边框 | `1px solid rgba(91,140,110, 0.18)` |
| 圆角 | `--r-full` |
| 内边距 | `5px 14px` |
| 字号 | `--fs-xs` |
| 字色 | `--c-accent` |

---

## 8. 状态画面

每个可能出现异步数据的位置都需要覆盖三种状态。不留空白，不弹 alert。

### 加载中 (Loading)

```
┌─────────────────────────────────┐
│                                 │
│     ◌  ← 铜绿色旋转环          │
│     加载中...                   │
│                                 │
└─────────────────────────────────┘
```

- 使用 `.state-loading` 类
- 铜绿色旋转圆环 (CSS animation, 不用 gif)
- 文字 "加载中..." 用 `--c-text-3`，`--fs-sm`
- 卡片保持正常尺寸，内容区域居中展示
- 骨架屏 (skeleton)：长条 `--c-bg-alt` 色块 + shimmer 动画，用于卡片内文字占位

### 空数据 (Empty)

```
┌─────────────────────────────────┐
│                                 │
│         📭                      │
│   暂无内容                      │
│   还没有数据可以显示             │
│                                 │
└─────────────────────────────────┘
```

- 使用 `.state-empty` 类
- emoji 或 SVG icon，尺寸 `48px`
- 主文字 `--c-text-2`，`--fs-body`
- 副文字 `--c-text-3`，`--fs-sm`
- 如果有行动按钮，放在副文字下方，使用 `.btn-secondary`

### 出错 (Error)

```
┌─────────────────────────────────┐
│                                 │
│         ⚠️                      │
│   加载失败                      │
│   网络出了点问题，点击重试       │
│   ┌──────────┐                  │
│   │  重新加载  │                 │
│   └──────────┘                  │
│                                 │
└─────────────────────────────────┘
```

- 使用 `.state-error` 类
- 卡片边框变为 `--c-error` (细微的红色边)，或者底色 `--c-error-soft`
- 主文字 "加载失败" 用 `--c-text`，`--fs-body`
- 描述用 `--c-text-2`，`--fs-sm`
- 重试按钮使用 `.btn-secondary`
- 说清楚哪里出了问题，不说 "Oops"，不弹 alert

### 提交反馈 (Toast)

- 定位：`fixed` 右下角 (bottom 40px, right 40px)
- 底色：`--c-accent`，白字
- 圆角：`--r-md`
- 阴影：`--shadow-lg`
- 进场动画：从下方 20px 滑入 + fade
- 4 秒后自动消失

---

## 9. 深色区域的规则

深色区域（Contact、MusicPlayer 托盘、CabinSection）：

1. 背景统一 `--c-bg-dark` (`#242725`)，不使用 `#1a1d1b`、`#2a2d2b` 等变体
2. 文字使用 `--c-text-inv` (主)、`--c-text-inv-2` (次)、`--c-text-inv-3` (辅)
3. 边框使用 `--c-border-dark`
4. 输入框底色 `rgba(255,255,255, 0.06)`，focus 底色 `rgba(255,255,255, 0.1)`
5. 按钮仍然使用 `.btn-primary` / `.btn-secondary`，颜色自动适配
6. 卡片使用 `.card-dark`

---

## 10. 变量命名对照 (旧 → 新)

旧变量将在 `style.css` 中保留为别名过渡，逐步在组件中替换。

| 旧 | 新 | 说明 |
|----|----|------|
| `--color-base`, `--color-bg` | `--c-bg` | 底色 |
| `--color-bg-alt` | `--c-bg-alt` | 次底色 |
| `--color-surface` | `--c-surface` | 卡面 |
| `--color-ink`, `--color-text` | `--c-text` | 主文字 |
| `--color-text-light` | `--c-text-2` | 次文字 |
| `--color-text-lighter`, `--color-text-muted` | `--c-text-3` | 辅文字 |
| `--color-accent` | `--c-accent` | 铜绿 |
| `--color-amber`, `--color-sunlit`, `--color-warm` | `--c-warm` | 琥珀 |
| `--radius-lg` | `--r-lg` | 大圆角 |
| `--radius`, `--radius-sm` | `--r-md` | 标准圆角 |
| `--radius-xs` | `--r-sm` | 小圆角 |
| `--radius-full` | `--r-full` | 胶囊 |
| `--tile-shadow` | `--shadow-md` | 卡片阴影 |
| `--tile-shadow-hover` | `--shadow-lg` | 悬停阴影 |
| `--font-serif` | `--f-serif` | 衬线 |
| `--font-sans` | `--f-sans` | 无衬线 |
| `--font-mono` | `--f-mono` | 等宽 |

---

## 检查清单

在修改任何组件前，对照此表检查：

- [ ] 颜色是否使用变量？无硬编码 hex/rgba？
- [ ] 字号是否在 7 级阶梯中？
- [ ] 圆角是否用了 `--r-*` 变量？
- [ ] 阴影是否用了 `--shadow-*` 变量？
- [ ] 间距是否为 4/8 的倍数？
- [ ] 按钮是否是三种之一？
- [ ] 卡片是否用了 `.card` / `.card-dark`？
- [ ] 深色区域文字对比度是否达标？
- [ ] 是否处理了 loading / empty / error 状态？
- [ ] hover 和 focus-visible 是否都有？
