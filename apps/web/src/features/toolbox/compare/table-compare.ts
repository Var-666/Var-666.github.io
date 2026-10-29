// 两份表格的差异对比：按主键列匹配记录，列出新增 / 删除 / 修改（含逐列前后对照）。
// 纯函数：不猜主键、不合并重复主键（重复键按首次出现参与匹配并显式报告）、缺失主键行不参与匹配。

export type TableMatrix = { name: string; headers: string[]; rows: string[][] }

export type CompareOptions = {
  keyColumn: string
  keyColumns?: string[]
  /** 除主键外参与比较的列（调用方应传两表公共列；缺失即报错，不静默跳过） */
  compareColumns: string[]
  /** 比较前把连续空白折叠为单个空格并去首尾空白（差异明细仍显示原值） */
  normalizeSpaces: boolean
}

export type DuplicateKey = { side: 'left' | 'right'; key: string; count: number }
export type ChangeCell = { column: string; left: string; right: string }
export type KeyedRow = { key: string; row: string[] }
export type ChangedRow = { key: string; cells: ChangeCell[] }

export type CompareReport = {
  keyColumns: string[]
  leftName: string
  rightName: string
  headersOnlyLeft: string[]
  headersOnlyRight: string[]
  duplicateKeys: DuplicateKey[]
  missingKeys: { left: number; right: number }
  /** 新表（右）有、旧表（左）没有的记录 */
  added: KeyedRow[]
  /** 旧表有、新表没有的记录 */
  removed: KeyedRow[]
  changed: ChangedRow[]
  unchanged: number
  unchangedRows: KeyedRow[]
}

export function commonHeaders(left: TableMatrix, right: TableMatrix): string[] {
  const rightSet = new Set(right.headers)
  return left.headers.filter((header) => rightSet.has(header))
}

const normalizeValue = (value: string, normalizeSpaces: boolean) =>
  normalizeSpaces ? value.replace(/\s+/g, ' ').trim() : value

function indexByKey(
  table: TableMatrix,
  keyIndexes: number[],
  side: 'left' | 'right',
): { map: Map<string, string[]>; duplicates: DuplicateKey[]; missing: number } {
  const map = new Map<string, string[]>()
  const counts = new Map<string, number>()
  let missing = 0
  for (const row of table.rows) {
    const parts = keyIndexes.map((index) => (row[index] ?? '').trim())
    const key = parts.length === 1 ? parts[0] : JSON.stringify(parts)
    if (parts.some((part) => !part)) {
      missing++
      continue
    }
    if (map.has(key)) counts.set(key, (counts.get(key) ?? 1) + 1)
    else map.set(key, row)
  }
  return {
    map,
    missing,
    duplicates: [...counts.entries()].map(([key, count]) => ({ side, key, count })),
  }
}

export function compareTables(
  left: TableMatrix,
  right: TableMatrix,
  options: CompareOptions,
): CompareReport {
  const leftIndex = new Map(left.headers.map((header, i) => [header, i] as const))
  const rightIndex = new Map(right.headers.map((header, i) => [header, i] as const))
  const keys = [...new Set(options.keyColumns?.length ? options.keyColumns : [options.keyColumn])]
  if (!keys.length || keys.some((key) => !leftIndex.has(key) || !rightIndex.has(key)))
    throw new Error(`主键列「${keys.join('、')}」需要在两个表格中都存在。`)
  const keyLeft = keys.map((key) => leftIndex.get(key)!),
    keyRight = keys.map((key) => rightIndex.get(key)!)
  for (const column of options.compareColumns) {
    if (!leftIndex.has(column))
      throw new Error(`比较列「${column}」在旧表（${left.name}）中不存在。`)
    if (!rightIndex.has(column))
      throw new Error(`比较列「${column}」在新表（${right.name}）中不存在。`)
  }
  const L = indexByKey(left, keyLeft, 'left')
  const R = indexByKey(right, keyRight, 'right')

  const removed: KeyedRow[] = []
  const changed: ChangedRow[] = []
  let unchanged = 0
  const unchangedRows: KeyedRow[] = []
  for (const [key, row] of L.map) {
    const rightRow = R.map.get(key)
    if (!rightRow) {
      removed.push({ key, row })
      continue
    }
    const cells: ChangeCell[] = []
    for (const column of options.compareColumns) {
      const leftValue = row[leftIndex.get(column)!] ?? ''
      const rightValue = rightRow[rightIndex.get(column)!] ?? ''
      if (
        normalizeValue(leftValue, options.normalizeSpaces) !==
        normalizeValue(rightValue, options.normalizeSpaces)
      )
        cells.push({ column, left: leftValue, right: rightValue })
    }
    if (cells.length) changed.push({ key, cells })
    else {
      unchanged++
      unchangedRows.push({ key, row })
    }
  }
  const added: KeyedRow[] = []
  for (const [key, row] of R.map) if (!L.map.has(key)) added.push({ key, row })

  return {
    keyColumns: keys,
    leftName: left.name,
    rightName: right.name,
    headersOnlyLeft: left.headers.filter((header) => !rightIndex.has(header)),
    headersOnlyRight: right.headers.filter((header) => !leftIndex.has(header)),
    duplicateKeys: [...L.duplicates, ...R.duplicates],
    missingKeys: { left: L.missing, right: R.missing },
    added,
    removed,
    changed,
    unchanged,
    unchangedRows,
  }
}

/** 差异导出为三个矩阵：新增 / 删除（完整行）、修改明细（主键、列、旧值、新值） */
export function diffMatrices(
  left: TableMatrix,
  right: TableMatrix,
  report: CompareReport,
): { name: string; rows: string[][] }[] {
  const encoder = new TextEncoder()
  let bytes = 9
  const checked = (row: string[]) => {
    bytes += 2 + Math.max(0, row.length - 1)
    for (const value of row) {
      bytes += encoder.encode(value).byteLength
      const formula = /^[=+\-@\t\r]/.test(value)
      if (formula) bytes++
      const quoted =
        formula || /[",\r\n]/.test(value) || value.startsWith(' ') || value.endsWith(' ')
      if (quoted) {
        bytes += 2
        for (const character of value) if (character === '"') bytes++
      }
    }
    if (bytes > 100 * 1024 * 1024)
      throw new Error('差异导出超过 100 MB，请减少比较列或缩小数据范围。')
    return row
  }
  return [
    {
      name: '新增记录',
      rows: [checked(right.headers), ...report.added.map((entry) => checked(entry.row))],
    },
    {
      name: '删除记录',
      rows: [checked(left.headers), ...report.removed.map((entry) => checked(entry.row))],
    },
    {
      name: '修改明细',
      rows: [
        checked(['主键', '变化列', '旧值', '新值']),
        ...report.changed.flatMap((entry) =>
          entry.cells.map((cell) => checked([entry.key, cell.column, cell.left, cell.right])),
        ),
      ],
    },
  ]
}
