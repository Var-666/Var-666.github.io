import type { ReactNode } from 'react'
import { tools } from '../tools'

/**
 * 重设计版工具页头部：渐变识别图标 + 标题 + tagline，右侧可挂工具自身的动作按钮。
 * title / tagline 用于表格双模式（批量处理 / 表格对比）覆盖默认文案。
 */
export function ToolHead({
  toolId,
  title,
  tagline,
  actions,
}: {
  toolId: string
  title?: string
  tagline?: string
  actions?: ReactNode
}) {
  const tool = tools.find((item) => item.id === toolId)
  if (!tool) return null
  return (
    <header className="intro">
      <div className="tool-head">
        <span className="tool-head-icon" style={{ background: tool.gradient }} aria-hidden="true">
          <tool.icon size={30} strokeWidth={1.75} />
        </span>
        <div className="tool-head-copy">
          <h1>{title ?? tool.title}</h1>
          <p className="tool-head-tagline">{tagline ?? tool.tagline}</p>
        </div>
      </div>
      {actions ? <div className="tool-title-actions">{actions}</div> : null}
    </header>
  )
}
