// 整理前后差异计算：先用行级对齐找出增删块，再对「替换块」做字符级细化，
// 得到两侧高亮所需的精确字符范围。纯函数，运行在文本处理 Worker 中。
import { diffChars, diffLines } from 'diff'

export type DiffRange = { start: number; end: number }
export type DiffHunk = {
  id: number
  kind: 'add' | 'remove' | 'replace'
  /** 原文中的范围；add 时 start === end 表示插入点 */
  source: DiffRange
  /** 结果中的范围；remove 时 start === end */
  result: DiffRange
  /** 原文一侧被删除或替换掉的字符范围 */
  sourceRuns: DiffRange[]
  /** 结果一侧新增的字符范围 */
  resultRuns: DiffRange[]
}

// 差异计算按字符数平方级开销设防：超过阈值直接停用高亮，不影响整理本身
export const DIFF_MAX_CHARS = 200_000

export function textDiff(source: string, result: string): DiffHunk[] | null {
  if (!source && !result) return []
  if (source.length + result.length > DIFF_MAX_CHARS) return null
  const hunks: DiffHunk[] = []
  let sourceOffset = 0
  let resultOffset = 0
  let pendingRemoved = ''
  let pendingAdded = ''
  let pendingSourceStart = 0
  let pendingResultStart = 0

  const flush = () => {
    const oldText = pendingRemoved
    const newText = pendingAdded
    pendingRemoved = ''
    pendingAdded = ''
    if (oldText === newText) return
    const hunk: DiffHunk = {
      id: hunks.length + 1,
      kind: oldText && newText ? 'replace' : oldText ? 'remove' : 'add',
      source: { start: pendingSourceStart, end: pendingSourceStart + oldText.length },
      result: { start: pendingResultStart, end: pendingResultStart + newText.length },
      sourceRuns: [],
      resultRuns: [],
    }
    if (hunk.kind === 'remove') {
      hunk.sourceRuns = [hunk.source]
    } else if (hunk.kind === 'add') {
      hunk.resultRuns = [hunk.result]
    } else {
      refine(hunk, oldText, newText)
      // 行级不同但字符级全同（例如仅换行归属差异）时无需标注
      if (!hunk.sourceRuns.length && !hunk.resultRuns.length) return
      // 按字符级结果修正语义：只有一侧有变化的「替换」实际是行内插入或行内删除
      if (!hunk.sourceRuns.length) hunk.kind = 'add'
      else if (!hunk.resultRuns.length) hunk.kind = 'remove'
    }
    hunks.push(hunk)
  }

  for (const part of diffLines(source, result)) {
    if (!part.added && !part.removed) {
      flush()
      sourceOffset += part.value.length
      resultOffset += part.value.length
      continue
    }
    if (!pendingRemoved && !pendingAdded) {
      pendingSourceStart = sourceOffset
      pendingResultStart = resultOffset
    }
    if (part.removed) {
      pendingRemoved += part.value
      sourceOffset += part.value.length
    } else {
      pendingAdded += part.value
      resultOffset += part.value.length
    }
  }
  flush()
  return hunks
}

// 将替换块的旧文与新文做字符级对比，换算回全文坐标
function refine(hunk: DiffHunk, oldText: string, newText: string) {
  let oldOffset = 0
  let newOffset = 0
  const push = (runs: DiffRange[], start: number, length: number) => {
    const last = runs[runs.length - 1]
    const range = { start, end: start + length }
    // 相邻的同侧变更合并，减少渲染节点
    if (last && last.end === range.start) last.end = range.end
    else runs.push(range)
  }
  for (const part of diffChars(oldText, newText)) {
    if (!part.added && !part.removed) {
      oldOffset += part.value.length
      newOffset += part.value.length
    } else if (part.removed) {
      push(hunk.sourceRuns, hunk.source.start + oldOffset, part.value.length)
      oldOffset += part.value.length
    } else {
      push(hunk.resultRuns, hunk.result.start + newOffset, part.value.length)
      newOffset += part.value.length
    }
  }
}
