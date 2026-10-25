import Papa from 'papaparse'
import { Lexer, walkTokens, type Tokens } from 'marked'
import { markdownInlineToText, markdownToText } from './markdown'

export type TextConversion = 'markdown' | 'csv-json' | 'json-csv' | 'csv-markdown'

// 表格 → Markdown 的统一转义与拼装：CSV / TSV 与 Excel 导出共用，避免两套行为
export function markdownTableFromMatrix(headers: string[], rows: string[][]): string {
  if (!headers?.length) throw new Error('表格不能为空。')
  const cell = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '\\\\')
      .replace(/([*_[\]`~])/g, '\\$1')
      .replace(/\|/g, '&#124;')
      .replace(/\r\n|\r|\n/g, '<br>')
  const row = (values: string[]) => `| ${values.map(cell).join(' | ')} |`
  return [row(headers), row(headers.map(() => '---')), ...rows.map(row)].join('\n')
}

export function convertFileText(
  text: string,
  mode: TextConversion,
  delimiter: ',' | '\t' = ',',
): string {
  if (text.length > 2_000_000) throw new Error('文本过大，请使用 200 万字符以内的文件。')
  if (mode === 'markdown') return markdownToText(text)
  if (mode === 'csv-json' || mode === 'csv-markdown') {
    const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
      skipEmptyLines: true,
      delimiter: mode === 'csv-markdown' ? delimiter : ',',
    })
    if (parsed.errors.length) throw new Error(`CSV 格式错误：${parsed.errors[0].message}`)
    const [headers, ...rows] = parsed.data
    if (mode === 'csv-markdown') {
      if (!headers?.length || !text.trim()) throw new Error('表格不能为空。')
      if (rows.some((row) => row.length !== headers.length))
        throw new Error('表格各行列数必须一致。')
      return markdownTableFromMatrix(headers, rows)
    }
    if (!headers?.length || headers.some((header) => !header.trim()))
      throw new Error('CSV 第一行需要填写列名。')
    if (new Set(headers).size !== headers.length) throw new Error('CSV 列名不能重复。')
    if (rows.some((row) => row.length !== headers.length))
      throw new Error('CSV 每行的列数必须与表头一致。')
    return JSON.stringify(
      rows.map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i]]))),
      null,
      2,
    )
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON 格式不正确，请检查引号、逗号和括号。')
  }
  if (
    !Array.isArray(data) ||
    !data.length ||
    data.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
  )
    throw new Error('请提供非空的对象数组，例如 [{"姓名":"小王","部门":"设计"}]。')
  const columns = [...new Set(data.flatMap((row) => Object.keys(row)))]
  if (!columns.length) throw new Error('JSON 对象至少需要一个字段。')
  if (
    data.some((row) =>
      Object.values(row).some((value) => value !== null && typeof value === 'object'),
    )
  )
    throw new Error('暂不支持嵌套对象或数组，请先展开字段。')
  if (
    data.some((row) =>
      Object.values(row).some(
        (value) =>
          typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value),
      ),
    )
  )
    throw new Error('JSON 含有超出安全精度的整数，请把长编号改为带引号的字符串。')
  return Papa.unparse(
    {
      fields: columns,
      data: data.map((row) =>
        columns.map((key) => (Object.hasOwn(row, key) ? (row[key] ?? '') : '')),
      ),
    },
    { escapeFormulae: true },
  )
}

export function markdownTables(text: string): string[] {
  if (text.length > 2_000_000) throw new Error('文本过大，请使用 200 万字符以内的文件。')
  const tables: string[] = []
  walkTokens(Lexer.lex(text, { gfm: true }), (token) => {
    if (token.type !== 'table') return
    const table = token as Tokens.Table
    tables.push(
      Papa.unparse(
        [table.header, ...table.rows].map((row) =>
          row.map((cell) => markdownInlineToText(cell.tokens)),
        ),
        { escapeFormulae: true },
      ),
    )
  })
  if (!tables.length) throw new Error('没有找到 Markdown 表格，请使用带表头分隔线的表格。')
  return tables
}
