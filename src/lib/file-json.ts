import Papa from 'papaparse'

export function jsonToCsv(text: string, jsonLines = false): { text: string; notices: string[] } {
  if (text.length > 2_000_000) throw new Error('文本过大，请使用 200 万字符以内的文件。')
  const source = text.replace(/^\uFEFF/, '')
  const objectRow = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  let data: unknown
  if (jsonLines) {
    data = source.split(/\r\n|\r|\n/).flatMap((line, index) => {
      if (!line.trim()) return []
      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        throw new Error(`JSON Lines 第 ${index + 1} 行格式不正确。`)
      }
      if (!objectRow(value)) throw new Error(`JSON Lines 第 ${index + 1} 行需要是一个对象。`)
      return [value]
    })
  } else {
    try {
      data = JSON.parse(source)
    } catch {
      throw new Error('JSON 格式不正确，请检查引号、逗号和括号。')
    }
  }
  if (!Array.isArray(data) || !data.length || !data.every(objectRow))
    throw new Error('请提供非空的对象数组，例如 [{"姓名":"小王","部门":"设计"}]。')
  if (data.length > 100_000) throw new Error('JSON 最多支持 10 万条记录。')
  const columns = new Set<string>()
  let nested = false,
    arrays = false
  const checkValue = (value: unknown, depth: number) => {
    if (depth > 32) throw new Error('JSON 嵌套超过 32 层，请先简化结构。')
    if (
      typeof value === 'number' &&
      (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
    )
      throw new Error('JSON 含有超出安全精度或数值范围的数字，请把长编号改为带引号的字符串。')
    if (value && typeof value === 'object')
      for (const child of Object.values(value)) checkValue(child, depth + 1)
  }
  const rows = data.map((row) => {
    checkValue(row, 0)
    const values = new Map<string, unknown>()
    const visit = (object: Record<string, unknown>, path: string[]) => {
      for (const [key, value] of Object.entries(object)) {
        const next = [...path, key.replace(/\\/g, '\\\\').replace(/\./g, '\\.')]
        if (objectRow(value) && Object.keys(value).length) {
          nested = true
          visit(value, next)
        } else {
          const name = next.join('.')
          columns.add(name)
          if (columns.size > 1024 || columns.size * data.length > 1_000_000)
            throw new Error('展开后超过 1024 列或 100 万个单元格，请减少字段或记录。')
          if (Array.isArray(value)) arrays = true
          values.set(
            name,
            value !== null && typeof value === 'object' ? JSON.stringify(value) : value,
          )
        }
      }
    }
    visit(row, [])
    return values
  })
  if (!columns.size) throw new Error('JSON 对象至少需要一个字段。')
  const fields = [...columns]
  return {
    text: Papa.unparse(
      { fields, data: rows.map((row) => fields.map((key) => row.get(key) ?? '')) },
      { escapeFormulae: true },
    ),
    notices: [
      ...(jsonLines ? [`已读取 ${data.length} 条 JSON Lines 记录；空白行跳过。`] : []),
      ...(nested ? ['嵌套对象已按点分隔路径展开；原字段名中的点和反斜线使用反斜线转义。'] : []),
      ...(arrays ? ['数组保留为单元格内的 JSON 文本，不展开或复制记录。'] : []),
    ],
  }
}
