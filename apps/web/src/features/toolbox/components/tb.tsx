import { useState, type ReactNode } from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'

/**
 * 工具箱页面对齐设计源一律使用 Tailwind 工具类 + tb-* 令牌（globals.css @theme 映射），
 * 不再新增手写 .tb-* CSS 类。
 *
 * 组件与工具类逐字移植自设计源 src/tools/ui.tsx（Redesign Personal Portfolio Website）。
 * 与本项目 shadcn 的 Select / Switch / Button 并存：需要视觉对齐时把工具类加在
 * shadcn 组件的 className 上，不用这里的基础控件替换它们（e2e 依赖其 Radix 行为与角色）。
 */

/** 设计源 Card：24px 圆角白卡 + title/extra 头部行 */
export function TbCard({
  children,
  className = '',
  title,
  extra,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  className?: string
  title?: string
  extra?: ReactNode
  'aria-label'?: string
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`rounded-[24px] bg-tb-card p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-6 ${className}`}
    >
      {(title || extra) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

/** 设计源 Label：12px 半标题灰色（自带 mb-2，适用于无容器间距的场景） */
export function TbLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[12px] font-semibold text-tb-mute">{children}</p>
}

const noticeTone = {
  info: 'bg-[#0071e3]/10 text-[#0058b0] dark:text-[#64b5ff]',
  warn: 'bg-[#ff9f0a]/12 text-[#a35a00] dark:text-[#ffb340]',
  error: 'bg-[#ff3b30]/10 text-[#c4141f] dark:text-[#ff6961]',
  ok: 'bg-[#30d158]/12 text-[#1a7f37] dark:text-[#30d158]',
}

/** 设计源 Notice：四种 tone 的提示条 */
export function TbNotice({
  tone = 'info',
  children,
}: {
  tone?: keyof typeof noticeTone
  children: ReactNode
}) {
  return (
    <p
      className={`flex items-start gap-2 rounded-[14px] px-3.5 py-2.5 text-[13px] leading-[1.5] ${noticeTone[tone]}`}
    >
      <CircleAlert size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** 设计源 Stat：状态栏「标签 + 数值」对 */
export function TbStat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-tb-mute">{label}</span>
      <span
        className="font-semibold text-tb-fg tabular-nums"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </span>
    </span>
  )
}

/**
 * 设计源 Collapsible（src/tools/ui.tsx 逐字移植）：18px 圆角描边盒 + 标题/hint 按钮 +
 * ChevronDown 180° 旋转 + grid-template-rows 0fr/1fr 行高展开动画（300ms ease-out）。
 * 收起态内容在动画容器上加 invisible：visibility:hidden 过渡到末帧才隐藏，
 * 既保留收起动画，又让 Playwright toBeHidden 与无障碍树语义与旧条件渲染一致。
 * 内容常驻挂载（收起不丢草稿）；open 由内部 useState 管理，onToggle 在状态变化时回调。
 */
export function TbCollapsible({
  title,
  hint,
  defaultOpen = false,
  onToggle,
  className = '',
  children,
}: {
  title: ReactNode
  hint?: ReactNode
  defaultOpen?: boolean
  /** 展开状态变化时回调（text 侧栏分区用于按需启用处理线程） */
  onToggle?: (open: boolean) => void
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const toggle = () => {
    const next = !open
    setOpen(next)
    onToggle?.(next)
  }
  return (
    <div className={`rounded-[18px] ring-1 ring-tb-line ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="tb-collapsible-toggle flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-medium">{title}</span>
          {hint && <span className="mt-0.5 block text-[12px] text-tb-mute">{hint}</span>}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-tb-mute transition motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid grid-cols-[minmax(0,1fr)] transition-all duration-300 ease-out motion-reduce:transition-none ${
          open ? '' : 'invisible'
        }`}
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Toggle 行下展开体的 grid 行高动画包装（机制同 TbCollapsible：0fr/1fr + 300ms ease-out +
 * 收起态 invisible，展开 state 由调用方传入）。列保持显式单列 minmax(0,1fr)，禁隐式 auto 轨道。
 */
export function TbReveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)] transition-all duration-300 ease-out motion-reduce:transition-none ${
        open ? '' : 'invisible'
      }`}
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}
