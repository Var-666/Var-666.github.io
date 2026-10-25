// 多份同结构 CSV 的批量处理：合并 → 按关键列去重 → 按列筛选 → 删除列 → 按字段拆分。
// 固定顺序执行，每一步的影响（删除行数、分组数等）都在统计中显式给出，不静默丢数据。

export type LoadedTable = { name: string; headers: string[]; rows: string[][] }

export type ProcessOptions = {
  /** 按关键列去重，保留第一条或最后一条 */
  dedupe: { column: string; keep: 'first' | 'last' } | null
  /** 按列筛选：包含 / 不包含关键词（整格包含匹配） */
  filter: { column: string; mode: 'include' | 'exclude'; keyword: string } | null
  /** 要删除的列名 */
  dropColumns: string[]
  /** 按该列的值拆分为多组；null 表示不拆分 */
  splitBy: string | null
}

export const emptyProcessOptions: ProcessOptions = {
  dedupe: null,
  filter: null,
  dropColumns: [],
  splitBy: null,
}

export type ProcessStats = {
  files: number
  mergedRows: number
  dedupedRemoved: number
  filterRemoved: number
  droppedColumns: string[]
  finalRows: number
  finalColumns: number
  /** splitBy 非空时的分组（按首次出现顺序），value 为去掉首尾空白的列值 */
  groups: { value: string; rows: string[][] }[]
}

export type ProcessResult = { headers: string[]; rows: string[][]; stats: ProcessStats }

/** 合并多份表格：表头（去首尾空白后）必须完全一致，不一致时点名文件，不做静默对齐 */
export function mergeTables(tables: LoadedTable[]): { headers: string[]; rows: string[][] } {
  if (!tables.length) return { headers: [], rows: [] }
  const normalized = tables.map((table) => table.headers.map((header) => header.trim()))
  const headers = normalized[0]
  for (const [index, tableHeaders] of normalized.entries()) {
    if (
      tableHeaders.length !== headers.length ||
      tableHeaders.some((header, i) => header !== headers[i])
    )
      throw new Error(
        `「${tables[index].name}」的表头与「${tables[0].name}」不一致（${tableHeaders.join('、')} vs ${headers.join('、')}），请先统一列名。`,
      )
  }
  return { headers, rows: tables.flatMap((table) => table.rows) }
}

export function processTables(tables: LoadedTable[], options: ProcessOptions): ProcessResult {
  const merged = mergeTables(tables)
  const columnIndex = new Map(merged.headers.map((header, i) => [header, i] as const))
  const requireColumn = (column: string, what: string) => {
    if (!columnIndex.has(column)) throw new Error(`${what}「${column}」不在表格列中。`)
    return columnIndex.get(column)!
  }

  let rows = merged.rows
  const mergedRows = rows.length

  let dedupedRemoved = 0
  if (options.dedupe) {
    const keyIndex = requireColumn(options.dedupe.column, '去关键列')
    const seen = new Map<string, string[]>()
    if (options.dedupe.keep === 'first') {
      for (const row of rows) {
        const key = (row[keyIndex] ?? '').trim()
        if (!seen.has(key)) seen.set(key, row)
      }
    } else {
      for (const row of rows) seen.set((row[keyIndex] ?? '').trim(), row)
    }
    dedupedRemoved = rows.length - seen.size
    rows = [...seen.values()]
  }

  let filterRemoved = 0
  if (options.filter && options.filter.keyword.trim()) {
    const filterIndex = requireColumn(options.filter.column, '筛选列')
    const keyword = options.filter.keyword.trim()
    const kept = rows.filter((row) => {
      const value = row[filterIndex] ?? ''
      return options.filter!.mode === 'include' ? value.includes(keyword) : !value.includes(keyword)
    })
    filterRemoved = rows.length - kept.length
    rows = kept
  }

  const droppedColumns = options.dropColumns.filter((column) => columnIndex.has(column))
  const keptIndexes = merged.headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => !droppedColumns.includes(header))
  const headers = keptIndexes.map(({ header }) => header)
  if (!headers.length) throw new Error('不能删除全部列，请至少保留一列。')
  const finalRows = rows.map((row) => keptIndexes.map(({ index }) => row[index] ?? ''))

  let groups: { value: string; rows: string[][] }[] = []
  if (options.splitBy) {
    const splitIndex = requireColumn(options.splitBy, '拆分列')
    const map = new Map<string, string[][]>()
    for (const row of finalRows) {
      const value = (row[splitIndex] ?? '').trim() || '（空值）'
      const bucket = map.get(value)
      if (bucket) bucket.push(row)
      else map.set(value, [row])
    }
    groups = [...map.entries()].map(([value, groupRows]) => ({ value, rows: groupRows }))
  }

  return {
    headers,
    rows: finalRows,
    stats: {
      files: tables.length,
      mergedRows,
      dedupedRemoved,
      filterRemoved,
      droppedColumns,
      finalRows: finalRows.length,
      finalColumns: headers.length,
      groups,
    },
  }
}

/** 拆分组导出用的安全文件名：去路径与非法字符，超长截断 */
export function groupFileName(value: string): string {
  const cleaned = value
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || '分组').slice(0, 40)
}
