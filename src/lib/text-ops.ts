// 文本批量操作：多条替换规则、列表行处理与条目格式转换。
// 全部为纯函数：预览与应用共用同一次计算，避免预览和实际写入不一致。

export type ReplaceRule = {
  find: string
  replace: string
  regex: boolean
  caseSensitive: boolean
}

/** 按顺序应用替换规则；返回逐条命中数。字面规则的替换值不解释 $1 等引用，正则规则保留引用能力 */
export function applyReplaceRules(
  text: string,
  rules: ReplaceRule[],
): { text: string; hits: number[] } {
  const hits: number[] = []
  let current = text
  rules.forEach((rule, index) => {
    if (!rule.find) {
      hits[index] = 0
      return
    }
    const source = rule.regex ? rule.find : rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let pattern: RegExp
    try {
      pattern = new RegExp(source, rule.caseSensitive ? 'g' : 'gi')
    } catch (error) {
      throw new Error(
        `第 ${index + 1} 条规则的正则无效：${error instanceof Error ? error.message : '语法错误'}`,
        { cause: error },
      )
    }
    hits[index] = [...current.matchAll(pattern)].length
    current = rule.regex
      ? current.replace(pattern, rule.replace)
      : current.replace(pattern, () => rule.replace)
  })
  return { text: current, hits }
}

export type ListOptions = {
  sort: 'none' | 'asc' | 'desc' | 'length'
  filterInclude: string
  filterExclude: string
  lineNumbers: 'none' | 'dot' | 'paren'
  prefix: string
  suffix: string
  removeEmpty: boolean
}

export const emptyListOptions: ListOptions = {
  sort: 'none',
  filterInclude: '',
  filterExclude: '',
  lineNumbers: 'none',
  prefix: '',
  suffix: '',
  removeEmpty: false,
}

const compareZh = (a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN')

/** 列表行处理：删空行 → 筛选 → 排序 → 行号 → 前后缀；返回行数变化，不静默吞掉数据 */
export function applyListOps(
  text: string,
  options: ListOptions,
): { text: string; beforeLines: number; afterLines: number; removedLines: number } {
  const lines = text.split(/\r\n|\r|\n/)
  const beforeLines = lines.length
  let kept = options.removeEmpty ? lines.filter((line) => line.trim() !== '') : [...lines]
  const include = options.filterInclude.trim()
  const exclude = options.filterExclude.trim()
  if (include) kept = kept.filter((line) => line.includes(include))
  if (exclude) kept = kept.filter((line) => !line.includes(exclude))
  if (options.sort === 'asc') kept.sort(compareZh)
  else if (options.sort === 'desc') kept.sort((a, b) => compareZh(b, a))
  else if (options.sort === 'length') kept.sort((a, b) => a.length - b.length || compareZh(a, b))
  // 行号在筛选与排序之后追加，编号与最终顺序一致
  const numbered =
    options.lineNumbers === 'none'
      ? kept
      : kept.map(
          (line, index) => `${index + 1}${options.lineNumbers === 'dot' ? '. ' : ') '}${line}`,
        )
  const decorated = numbered.map((line) => `${options.prefix}${line}${options.suffix}`)
  return {
    text: decorated.join('\n'),
    beforeLines,
    afterLines: decorated.length,
    removedLines: beforeLines - kept.length,
  }
}

export type LineJoinFormat = 'lines' | 'comma' | 'semicolon' | 'tab' | 'quote' | 'sql'

export const lineFormatLabels: Record<LineJoinFormat, string> = {
  lines: '每行一条',
  comma: '逗号分隔',
  semicolon: '分号分隔',
  tab: '制表符分隔',
  quote: '带引号列表',
  sql: 'SQL IN (…)',
}

/** 条目格式转换：多行 ↔ 单行分隔；单行输入自动按逗号 / 分号 / 制表符拆分（取拆出最多者）。空条目丢弃并计数 */
export function convertLineFormat(
  text: string,
  to: LineJoinFormat,
): { text: string; count: number; dropped: number } {
  let items = text.split(/\r\n|\r|\n/).map((line) => line.trim())
  if (items.length === 1 && items[0]) {
    const candidates = [items[0].split(','), items[0].split(';'), items[0].split('\t')]
    const best = candidates.reduce((a, b) => (b.length > a.length ? b : a))
    if (best.length > 1) items = best.map((item) => item.trim())
  }
  const kept = items.filter((item) => item !== '')
  const dropped = items.length - kept.length
  if (!kept.length) return { text: '', count: 0, dropped }
  const joined =
    to === 'lines'
      ? kept.join('\n')
      : to === 'comma'
        ? kept.join(',')
        : to === 'semicolon'
          ? kept.join(';')
          : to === 'tab'
            ? kept.join('\t')
            : to === 'quote'
              ? kept.map((item) => `"${item.replace(/"/g, '\\"')}"`).join(', ')
              : `(${kept.map((item) => `'${item.replace(/'/g, "''")}'`).join(', ')})`
  return { text: joined, count: kept.length, dropped }
}
