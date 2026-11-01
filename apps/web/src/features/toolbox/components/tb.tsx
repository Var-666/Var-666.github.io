import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'

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
