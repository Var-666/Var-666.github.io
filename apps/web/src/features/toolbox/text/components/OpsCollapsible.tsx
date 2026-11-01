import type { ReactNode } from 'react'
import { TbCollapsible } from '@/features/toolbox/components/tb'

/**
 * 「更多操作」卡内的设计源 Collapsible 分区（tb.tsx 的 TbCollapsible：grid 行高动画 + 收起态 invisible）。
 * 内容常驻挂载，收起不丢草稿；e2e（offline / text-extra）按按钮可访问名精确匹配分区名，
 * 被匹配的分区（内容提取 / 任意文本对比 / 简繁转换）均无 hint。
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
  /** 展开状态变化时回调（用于按需启用处理线程） */
  onToggle?: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <TbCollapsible title={title} hint={hint} defaultOpen={defaultOpen} onToggle={onToggle}>
      <div className="flex flex-col gap-2.5">{children}</div>
    </TbCollapsible>
  )
}
