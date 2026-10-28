// 表格批量处理：合并/连接 → 去重 → 筛选 → 列操作 → 按字段拆分。
// 固定顺序执行，每一步的影响（删除行数、分组数等）都在统计中显式给出，不静默丢数据。

export const tableLimits = {
  maxFiles: 10,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxChars: 10_000_000,
  maxRows: 100_000,
  maxCols: 1024,
  maxCells: 1_000_000,
  maxGroups: 1000,
  maxHeaderChars: 512,
} as const
export type TableMergeMode = 'strict' | 'align' | 'left' | 'inner' | 'full'
export type TableMergeOptions = { mode: TableMergeMode; leftKey: string; rightKey: string }
export type LoadedTable = { name: string; headers: string[]; rows: string[][] }

export type ProcessOptions = {
  merge?: TableMergeOptions
  renameColumns?: Record<string, string>
  columnOrder?: string[]
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
  mergeMode: TableMergeMode
  join?: { pairs: number; leftUnmatched: number; rightUnmatched: number }
  renamedColumns: number
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

function validateHeaders(headers: string[], name: string) {
  if (
    !headers.length ||
    headers.some((header) => !header) ||
    new Set(headers).size !== headers.length
  )
    throw new Error(`「${name}」存在空白或重复列名，请先调整表头。`)
  if (headers.some((header) => header.length > tableLimits.maxHeaderChars))
    throw new Error('列名超过 512 字符，请先缩短表头。')
  if (headers.length > tableLimits.maxCols) throw new Error('表格超过 1024 列。')
}
function checkTableSize(rows: number, columns: number) {
  if (rows + 1 > tableLimits.maxRows || (rows + 1) * columns > tableLimits.maxCells)
    throw new Error('处理结果超出 10 万行或 100 万格（含表头），请减少文件、字段或重复主键。')
}

/** 纵向合并默认要求相同表头，显式选择对齐时按列名取并集补空。 */
export function mergeTables(
  tables: LoadedTable[],
  align = false,
): { headers: string[]; rows: string[][] } {
  if (!tables.length) return { headers: [], rows: [] }
  const normalized = tables.map((table) => table.headers.map((header) => header.trim()))
  normalized.forEach((headers, index) => validateHeaders(headers, tables[index].name))
  const headers = align ? [...new Set(normalized.flat())] : normalized[0]
  validateHeaders(headers, '合并结果')
  const total = tables.reduce((sum, table) => sum + table.rows.length, 0)
  checkTableSize(total, headers.length)
  const rows: string[][] = []
  tables.forEach((table, index) => {
    const names = normalized[index]
    if (
      !align &&
      (names.length !== headers.length || names.some((header, i) => header !== headers[i]))
    )
      throw new Error(
        `「${table.name}」的表头与「${tables[0].name}」不一致（${names.join('、')} vs ${headers.join('、')}），请先统一列名或选择按列名对齐。`,
      )
    const indexes = new Map(names.map((name, i) => [name, i]))
    for (const row of table.rows)
      rows.push(headers.map((name) => row[indexes.get(name) ?? -1] ?? ''))
  })
  return { headers, rows }
}

export function joinColumns(leftHeaders: string[], rightHeaders: string[], rightKey: string) {
  const rightColumns = rightHeaders
    .map((name, index) => ({ name, index }))
    .filter(({ index }) => index !== rightHeaders.indexOf(rightKey))
  const used = new Set(leftHeaders)
  const addedHeaders = rightColumns.map(({ name }) => {
    let header = used.has(name) ? `${name}（右表）` : name,
      suffix = 2
    while (used.has(header)) header = `${name}（右表${suffix++}）`
    used.add(header)
    return header
  })
  const headers = [...leftHeaders, ...addedHeaders]
  return { headers, rightColumns }
}

export function joinTables(tables: LoadedTable[], options: TableMergeOptions) {
  if (tables.length !== 2) throw new Error('主键连接需要恰好两份表；第一份为左表，第二份为右表。')
  const [left, right] = tables.map((table) => ({
    ...table,
    headers: table.headers.map((header) => header.trim()),
  }))
  validateHeaders(left.headers, left.name)
  validateHeaders(right.headers, right.name)
  const leftKey = left.headers.indexOf(options.leftKey),
    rightKey = right.headers.indexOf(options.rightKey)
  if (leftKey < 0 || rightKey < 0) throw new Error('请选择左表和右表中有效的连接主键。')
  const { headers, rightColumns } = joinColumns(left.headers, right.headers, options.rightKey)
  validateHeaders(headers, '连接结果')
  const lookup = new Map<string, number[]>()
  right.rows.forEach((row, index) => {
    const key = (row[rightKey] ?? '').trim()
    if (!key) return
    const matches = lookup.get(key)
    if (matches) matches.push(index)
    else lookup.set(key, [index])
  })
  const matched = new Set<number>(),
    rows: string[][] = []
  const stats = { pairs: 0, leftUnmatched: 0, rightUnmatched: 0 }
  const push = (leftRow: string[] | undefined, rightRow: string[] | undefined) => {
    checkTableSize(rows.length + 1, headers.length)
    rows.push([
      ...left.headers.map(
        (_, index) => leftRow?.[index] ?? (index === leftKey ? (rightRow?.[rightKey] ?? '') : ''),
      ),
      ...rightColumns.map(({ index }) => rightRow?.[index] ?? ''),
    ])
  }
  for (const row of left.rows) {
    const key = (row[leftKey] ?? '').trim(),
      matches = key ? lookup.get(key) : undefined
    if (matches?.length)
      for (const index of matches) {
        push(row, right.rows[index])
        matched.add(index)
        stats.pairs++
      }
    else {
      stats.leftUnmatched++
      if (options.mode !== 'inner') push(row, undefined)
    }
  }
  right.rows.forEach((row, index) => {
    if (!matched.has(index)) {
      stats.rightUnmatched++
      if (options.mode === 'full') push(undefined, row)
    }
  })
  return { headers, rows, join: stats }
}

export function processTables(tables: LoadedTable[], options: ProcessOptions): ProcessResult {
  const mergeMode = options.merge?.mode ?? 'strict'
  const merged =
    mergeMode === 'strict' || mergeMode === 'align'
      ? { ...mergeTables(tables, mergeMode === 'align'), join: undefined }
      : joinTables(tables, options.merge!)
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
  if (!keptIndexes.length) throw new Error('不能删除全部列，请至少保留一列。')
  const order = options.columnOrder ?? []
  keptIndexes.sort((a, b) => {
    const ai = order.indexOf(a.header),
      bi = order.indexOf(b.header)
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi)
  })
  const headers = keptIndexes.map(({ header }) =>
    Object.hasOwn(options.renameColumns ?? {}, header)
      ? options.renameColumns![header].trim()
      : header,
  )
  validateHeaders(headers, '输出表格')
  const renamedColumns = headers.filter(
    (header, index) => header !== keptIndexes[index].header,
  ).length
  const finalRows = rows.map((row) => keptIndexes.map(({ index }) => row[index] ?? ''))

  let groups: { value: string; rows: string[][] }[] = []
  if (options.splitBy) {
    requireColumn(options.splitBy, '拆分列')
    const splitIndex = keptIndexes.findIndex(({ header }) => header === options.splitBy)
    if (splitIndex < 0) throw new Error('拆分列已被删除，请保留该列或取消拆分。')
    const map = new Map<string, string[][]>()
    for (const row of finalRows) {
      const value = (row[splitIndex] ?? '').trim()
      const bucket = map.get(value)
      if (bucket) bucket.push(row)
      else {
        if (map.size >= tableLimits.maxGroups)
          throw new Error('拆分超过 1000 个分组，请选择粒度更少的拆分列。')
        map.set(value, [row])
      }
    }
    groups = [...map.entries()].map(([value, groupRows]) => ({
      value: value || '（空值）',
      rows: groupRows,
    }))
  }

  return {
    headers,
    rows: finalRows,
    stats: {
      mergeMode,
      join: merged.join,
      renamedColumns,
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
    // eslint-disable-next-line no-control-regex -- Output names must also reject cell control characters.
    .replace(/[/\\?%*:|"<>\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  const safe = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned)
    ? cleaned + ' 分组'
    : cleaned
  return (safe || '分组').slice(0, 40)
}

/** Sanitation can collapse different group labels; reserve unique names before packaging. */
export function groupFileNames(values: string[]): string[] {
  const used = new Set<string>()
  return values.map((value) => {
    const base = groupFileName(value)
    let name = base,
      suffix = 2
    while (used.has(name.normalize('NFC').toLowerCase())) {
      const ending = ` (${suffix++})`
      name = base.slice(0, 40 - ending.length) + ending
    }
    used.add(name.normalize('NFC').toLowerCase())
    return name
  })
}
