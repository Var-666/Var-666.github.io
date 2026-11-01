import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 「更多操作」卡内的设计源 Collapsible 分区（ui.tsx 同款：18px 圆角描边 + 标题/hint + 旋转箭头）。
 * 用原生 details/summary 实现：内容常驻挂载，收起不丢草稿；summary 文本保持仅标题，
 * e2e（offline / text-extra）通过 summary 精确匹配分区名，因此 hint 不放入 summary。
 */
export function OpsCollapsible({
  title,
  hint,
  defaultOpen = false,
  onToggle,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  /** details 展开状态变化时回调（用于按需启用处理线程） */
  onToggle?: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <details
      className="group rounded-[18px] ring-1 ring-tb-line"
      open={defaultOpen || undefined}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[14px] font-medium">{title}</span>
          {hint && <span className="mt-0.5 block text-[12px] text-tb-mute">{hint}</span>}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-tb-mute transition', 'group-open:rotate-180')}
        />
      </summary>
      <div className="flex flex-col gap-2.5 px-4 pb-4">{children}</div>
    </details>
  )
}
