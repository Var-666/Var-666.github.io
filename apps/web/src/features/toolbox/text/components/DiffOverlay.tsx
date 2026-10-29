export type DiffMark = { start: number; end: number; hunk: number; side: 'del' | 'ins' }

// 覆盖层内容：在完整原文中把变更范围包上高亮 span，文字本身保持透明
export function OverlayMarks({ text, marks }: { text: string; marks: DiffMark[] }) {
  const nodes: React.ReactNode[] = []
  let cursor = 0
  marks.forEach((mark, index) => {
    const start = Math.max(cursor, mark.start)
    if (start >= mark.end) return
    if (start > cursor) nodes.push(text.slice(cursor, start))
    nodes.push(
      <span
        key={index}
        data-hunk={mark.hunk}
        className={mark.side === 'del' ? 'diff-del' : 'diff-ins'}
      >
        {text.slice(start, mark.end)}
      </span>,
    )
    cursor = mark.end
  })
  nodes.push(text.slice(cursor))
  return <>{nodes}</>
}
