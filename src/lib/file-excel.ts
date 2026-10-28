import { readTextFile, type TextEncoding, type DecodedText } from './text-encoding'
// Excel (.xlsx) 读取与生成：SheetJS CE（Apache-2.0）按需动态加载。
// 保真策略：单元格一律导出为 Excel 的「显示值」（cell.w，由数字格式渲染），
// 文本单元格保持原值；数值日期不重新计算公式，只读取缓存结果。
import Papa from 'papaparse'
import { unzipSync } from 'fflate'
import { markdownTableFromMatrix, uniqueHeaders } from './file-text'
import { outputName, type OutputFile } from './file-convert'
import type { WorkBook, WorkSheet } from 'xlsx'

// 集中管理的处理上限：xlsx 可能在很小的体积里包含海量单元格，不能只看文件大小
export const excelLimits = {
  maxFileBytes: 10 * 1024 * 1024,
  /** 解压总量上限：百万格以内的合法工作簿 XML 远小于此，超限按压缩炸弹拒绝 */
  maxUnzipBytes: 256 * 1024 * 1024,
  maxRows: 100_000,
  maxCols: 1_024,
  maxCells: 1_000_000,
} as const

export type SheetSummary = { name: string; rows: number; cols: number }
export type SheetData = {
  name: string
  /** 显示值矩阵；行宽统一，区域内的空单元格为 '' */
  rows: string[][]
  /** 有公式但没有缓存计算结果的单元格数量 */
  missingFormulaValues: number
  /** 存储为数值且超出 Excel 15 位有效数字精度的单元格数量 */
  precisionLoss: number
}
export type WorkbookData = {
  fileName: string
  sheets: SheetSummary[]
  /** 读取指定工作表（含上限校验），同一工作簿内缓存，不重复解析 */
  sheet(name: string): SheetData
}
type FileLike = { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }

async function loadSheetJs() {
  return import('xlsx')
}

function sheetRange(XLSX: typeof import('xlsx'), sheet: WorkSheet) {
  return (sheet['!ref'] && XLSX.utils.decode_range(sheet['!ref'])) || null
}

/** 校验 zip 结构并返回中央目录声明的解压后总大小（含 ZIP64）；不解压任何条目。
 *  声明值可拦住如实申报的压缩炸弹；恶意低报元数据的文件只能在后续解析阶段暴露 */
export function unzipTotalSize(bytes: Uint8Array): number {
  let total = 0
  // filter 恒为 false：只累加各条目声明的 originalSize，不解压；结构损坏时 unzipSync 仍会抛错
  unzipSync(bytes, {
    filter: (file) => {
      total += file.originalSize
      return false
    },
  })
  return total
}

/** 读取工作簿：校验体积与解压总量、解析结构与各表尺寸；损坏或不支持的文件给出可理解的错误 */
export async function loadWorkbook(file: FileLike): Promise<WorkbookData> {
  if (!file.size || file.size > excelLimits.maxFileBytes)
    throw new Error(`文件不能为空，且单个不超过 ${excelLimits.maxFileBytes / 1024 / 1024} MB`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  // xlsx 是 zip 包：先校验结构，避免 SheetJS 把残缺输入容错成垃圾数据；
  // 10 MB 压缩体可能解压出数 GB，必须在解析前按声明的解压总量拒绝压缩炸弹
  let unzipTotal: number
  try {
    unzipTotal = unzipTotalSize(bytes)
  } catch {
    throw new Error('无法读取 Excel 文件，请确认是有效的 .xlsx 工作簿（暂不支持旧版 .xls）。')
  }
  if (unzipTotal > excelLimits.maxUnzipBytes)
    throw new Error(
      `文件解压后超过 ${excelLimits.maxUnzipBytes / 1024 / 1024} MB，超出处理上限，请确认文件完好或拆分后重试。`,
    )
  const XLSX = await loadSheetJs()
  let workbook: WorkBook
  try {
    workbook = XLSX.read(bytes, { type: 'array' })
  } catch {
    throw new Error('无法读取 Excel 文件，请确认是有效的 .xlsx 工作簿（暂不支持旧版 .xls）。')
  }
  const names = workbook.SheetNames.filter((name) => workbook.Sheets[name])
  if (!names.length) throw new Error('工作簿中没有可读取的工作表。')
  const sheets: SheetSummary[] = names.map((name) => {
    const range = sheetRange(XLSX, workbook.Sheets[name])
    return {
      name,
      rows: range ? range.e.r - range.s.r + 1 : 0,
      cols: range ? range.e.c - range.s.c + 1 : 0,
    }
  })
  const cache = new Map<string, SheetData>()
  return {
    fileName: file.name,
    sheets,
    sheet(name: string): SheetData {
      const cached = cache.get(name)
      if (cached) return cached
      const sheet = workbook.Sheets[name]
      if (!sheet) throw new Error('没有找到选中的工作表，请重新选择。')
      const data = readSheet(XLSX, name, sheet)
      cache.set(name, data)
      return data
    },
  }
}

/** 最短往返十进制表示（String(number)，至多 17 位）里的有效数字位数 */
function significantDigits(value: number): number {
  // 去掉小数点再计数：1.23456789012345 是 15 位有效数字，不能因 '.' 占一个字符而误报
  const mantissa = String(value).split('e')[0].replace(/[-.]/g, '')
  const start = mantissa.search(/[1-9]/)
  if (start === -1) return 0
  let end = mantissa.length
  while (end > start && mantissa[end - 1] === '0') end--
  return end - start
}

/** 超出 Excel 15 位有效数字精度：≥1e15 的整数第 16 位起会被 Excel 截成 0（尾部的零可能正是
 *  被破坏的原始数字）；小于该阈值但有效数字超过 15 位的数值也无法被 Excel 完整呈现 */
function beyondExcelPrecision(value: number): boolean {
  return Math.abs(value) >= 1e15 || significantDigits(value) > 15
}

/** 把工作表物化为显示值矩阵；先做尺寸上限防护，再逐格读取并裁掉末尾空行空列 */
function readSheet(XLSX: typeof import('xlsx'), name: string, sheet: WorkSheet): SheetData {
  const range = sheetRange(XLSX, sheet)
  if (!range) return { name, rows: [], missingFormulaValues: 0, precisionLoss: 0 }
  const rows = range.e.r - range.s.r + 1
  const cols = range.e.c - range.s.c + 1
  if (
    rows > excelLimits.maxRows ||
    cols > excelLimits.maxCols ||
    rows * cols > excelLimits.maxCells
  )
    throw new Error(
      `「${name}」超出处理上限（${excelLimits.maxRows / 10000} 万行、${excelLimits.maxCols} 列、${excelLimits.maxCells / 10000} 万格），请拆分工作表或删除空白区域后重试。`,
    )
  const matrix: string[][] = []
  let missingFormulaValues = 0
  let precisionLoss = 0
  for (let r = range.s.r; r <= range.e.r; r++) {
    const line: string[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      if (!cell) {
        line.push('')
        continue
      }
      if (cell.f && (cell.v === undefined || cell.v === null)) {
        missingFormulaValues++
        line.push('')
        continue
      }
      if (
        cell.t === 'n' &&
        Number.isFinite(cell.v as number) &&
        beyondExcelPrecision(cell.v as number)
      )
        precisionLoss++
      // cell.w 是按数字格式渲染后的显示值：000000 格式的前导零、日期显示形式都在这里
      line.push(cell.w ?? (cell.v === undefined || cell.v === null ? '' : String(cell.v)))
    }
    matrix.push(line)
  }
  trimTrailingBlanks(matrix)
  return { name, rows: matrix, missingFormulaValues, precisionLoss }
}

function trimTrailingBlanks(matrix: string[][]) {
  while (matrix.length && matrix[matrix.length - 1].every((value) => !value)) matrix.pop()
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0)
  if (!width) return
  let last = width
  while (last > 0 && matrix.every((row) => !row[last - 1])) last--
  if (last < width) for (const row of matrix) row.length = last
}

/** 与数据保真相关的提示，转换前在界面展示 */
export function sheetNotices(sheet: SheetData): string[] {
  const notices: string[] = []
  if (sheet.missingFormulaValues)
    notices.push(
      `${sheet.missingFormulaValues} 个公式单元格没有缓存计算结果，已按空值导出；请在 Excel 中打开原文件重新计算后保存，再进行转换。`,
    )
  if (sheet.precisionLoss)
    notices.push(
      `${sheet.precisionLoss} 个数值超出 Excel 的 15 位有效数字精度，存储时可能已失真；转换按 Excel 显示值导出，无法恢复原始数字。`,
    )
  return notices
}

/** 供预览展示的 JSON 表头处理提示（不生成完整输出）；规则见 file-text 的 uniqueHeaders */
export function jsonHeaderNotices(headers: string[]): string[] {
  const notices: string[] = []
  uniqueHeaders(headers, notices)
  return notices
}

function requireRows(sheet: SheetData) {
  if (!sheet.rows.length) throw new Error(`「${sheet.name}」没有可读取的数据。`)
  return sheet.rows
}

export function sheetToCsv(sheet: SheetData): string {
  const rows = requireRows(sheet)
  return Papa.unparse(rows, { escapeFormulae: true })
}

export function sheetToJson(sheet: SheetData): { text: string; notices: string[] } {
  const rows = requireRows(sheet)
  const notices: string[] = []
  const headers = uniqueHeaders(rows[0], notices)
  const body = rows.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])))
  return { text: JSON.stringify(body, null, 2), notices }
}

export function sheetToMarkdown(sheet: SheetData): string {
  const rows = requireRows(sheet)
  return markdownTableFromMatrix(rows[0], rows.slice(1))
}

// ---------- CSV → XLSX ----------

/** 只识别格式明确安全的普通数字：无符号、无前导零、无千分位/科学计数法，整数部分 ≤ 12 位 */
const safeNumber = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,8})?$/
export const isSafeNumberText = (value: string) => safeNumber.test(value.trim())

export function parseCsvMatrix(
  text: string,
  maxChars = 2_000_000,
): { rows: string[][]; notices: string[] } {
  if (text.length > maxChars)
    throw new Error(`文本过大，请使用 ${maxChars / 10000} 万字符以内的文件。`)
  if (!text.replace(/^\uFEFF/, '').trim()) throw new Error('CSV 内容为空。')
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: true })
  // UndetectableDelimiter 只是提示已按逗号兜底，不是解析失败
  const fatal = parsed.errors.filter((error) => error.code !== 'UndetectableDelimiter')
  if (fatal.length) throw new Error(`CSV 格式错误：${fatal[0].message}`)
  const rows = parsed.data.filter((row) => row.some((value) => value !== ''))
  if (!rows.length) throw new Error('CSV 内容为空。')
  const notices: string[] = []
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (width > excelLimits.maxCols) throw new Error(`CSV 超过 ${excelLimits.maxCols} 列，请先拆分。`)
  if (rows.length > excelLimits.maxRows || rows.length * width > excelLimits.maxCells)
    throw new Error('CSV 超出处理上限（10 万行、100 万格），请拆分后转换。')
  if (rows.some((row) => row.length !== width)) {
    notices.push('部分行的列数与最宽行不同，已用空单元格补齐。')
    for (const row of rows) while (row.length < width) row.push('')
  }
  return { rows, notices }
}

/** Excel 工作表命名限制：≤31 字符、不含 \ / ? * [ ] : 、不叫 History */
function sheetNameFrom(fileName: string): string {
  const base = fileName
    .replace(/.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .trim()
  const cleaned =
    (base || '数据')
      .replace(/[\\/?*[\]:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || '数据'
  return (cleaned === 'History' ? `${cleaned}表` : cleaned).slice(0, 31)
}

export type CsvToExcelOptions = { detectNumbers: boolean; encoding?: TextEncoding }

/** 依据显示宽度估算列宽（全角字符计 2），便于直接阅读 */
function matrixColumnWidths(rows: string[][]) {
  return (rows[0] ?? []).map((_, index) =>
    Math.min(
      50,
      Math.max(
        8,
        ...rows.slice(0, 200).map((row) => {
          const value = row[index] ?? ''
          let width = 0
          for (const char of value) width += char.charCodeAt(0) > 0xff ? 2 : 1
          return width
        }),
      ),
    ),
  )
}

function validateExcelSheets(sheets: { rows: string[][] }[]) {
  let totalCells = 0
  for (const { rows } of sheets) {
    const columns = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0)
    if (rows.length > excelLimits.maxRows || columns > excelLimits.maxCols)
      throw new Error('XLSX 单表超过 10 万行或 1024 列，请减少数据或导出 CSV。')
    totalCells += rows.length * columns
    if (totalCells > excelLimits.maxCells)
      throw new Error('XLSX 工作簿合计超过 100 万格，请减少数据或导出 CSV。')
    if (rows.some((row) => row.some((cell) => cell.length > 32767)))
      throw new Error('单元格超过 Excel 的 32767 字符上限，请缩短内容或改用 CSV 导出。')
  }
}

/** 生成多工作表 xlsx（全部按文本写入，不识别数字，避免编号类内容失真） */
export async function matricesToExcelFile(
  sheets: { name: string; rows: string[][] }[],
  fileName: string,
): Promise<OutputFile> {
  validateExcelSheets(sheets)
  const XLSX = await loadSheetJs()
  const workbook = XLSX.utils.book_new()
  sheets.forEach((sheet, index) => {
    // 序号前缀保证工作表名唯一，长度与非法字符由 sheetNameFrom 统一处理
    const name = sheetNameFrom(`${index + 1}-${sheet.name}`)
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows)
    ws['!cols'] = matrixColumnWidths(sheet.rows).map((width) => ({ wch: width }))
    XLSX.utils.book_append_sheet(workbook, ws, name)
  })
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return {
    blob: new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    name: outputName(fileName, 'xlsx'),
  }
}

/** 生成 xlsx：默认全部按文本写入（保留前导零与长编号），开启识别时仅转换安全数字。
 *  字符串一律写入文本单元格，不会变成公式。 */
export async function matrixToExcelFile(
  rows: string[][],
  fileName: string,
  options: CsvToExcelOptions,
): Promise<OutputFile> {
  validateExcelSheets([{ rows }])
  const XLSX = await loadSheetJs()
  const data = options.detectNumbers
    ? rows.map((row) =>
        row.map((value) => (isSafeNumberText(value) ? Number(value.trim()) : value)),
      )
    : rows
  const sheet = XLSX.utils.aoa_to_sheet(data)
  sheet['!cols'] = matrixColumnWidths(rows).map((width) => ({ wch: width }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sheetNameFrom(fileName))
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return {
    blob: new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    name: outputName(fileName, 'xlsx'),
  }
}

export async function csvFileToExcel(
  file: FileLike,
  options: CsvToExcelOptions,
): Promise<OutputFile & { encoding: DecodedText['encoding'] }> {
  const decoded = await readTextFile(file, options.encoding)
  const { rows } = parseCsvMatrix(decoded.text)
  return { ...(await matrixToExcelFile(rows, file.name, options)), encoding: decoded.encoding }
}
