import {
  loadWorkbook,
  parseCsvMatrix,
  sheetNotices,
  unzipTotalSize,
  excelLimits,
  type WorkbookData,
} from '@/features/toolbox/files/file-excel'
import {
  readTextFile,
  type TextEncoding,
  type DecodedText,
} from '@/features/toolbox/lib/text-encoding'
import { uniqueHeaders } from '@/features/toolbox/files/file-text'
import { tableLimits, type LoadedTable } from '@/features/toolbox/table/table-process'

export type InputTable = LoadedTable & {
  id: string
  file: File
  encoding?: DecodedText['encoding']
  workbook?: WorkbookData
  sheetName?: string
  notices: string[]
  expandedBytes: number
}

function inputHeaders(raw: string[], notices: string[]) {
  const headers = uniqueHeaders(raw, notices)
  if (headers.some((header) => header.length > tableLimits.maxHeaderChars))
    throw new Error('列名超过 512 字符，请先缩短表头。')
  return headers
}

export function workbookTable(
  file: File,
  workbook: WorkbookData,
  sheetName: string,
  expandedBytes: number,
  id: string = crypto.randomUUID(),
): InputTable {
  const sheet = workbook.sheet(sheetName),
    notices = sheetNotices(sheet)
  const [raw = [], ...rows] = sheet.rows
  if (!raw.length) throw new Error('工作表没有可读取的表头。')
  return {
    id,
    name: file.name,
    file,
    workbook,
    sheetName,
    expandedBytes,
    headers: inputHeaders(raw, notices),
    rows,
    notices,
  }
}
export async function readTable(
  file: File,
  encoding: TextEncoding,
  id?: string,
  remainingArchiveBytes: number = excelLimits.maxUnzipBytes,
): Promise<InputTable> {
  if (!file.size || file.size > tableLimits.maxFileBytes)
    throw new Error('文件不能为空，单个最多 10 MB。')
  if (/\.xlsx$/i.test(file.name)) {
    const buffer = await file.arrayBuffer()
    let expandedBytes: number
    try {
      expandedBytes = unzipTotalSize(new Uint8Array(buffer))
    } catch (error) {
      throw new Error('无法读取 Excel 文件，请确认是有效的 .xlsx 工作簿。', { cause: error })
    }
    if (expandedBytes > remainingArchiveBytes)
      throw new Error('本批 XLSX 解压总量超过 256 MB，请减少工作簿数量。')
    const workbook = await loadWorkbook({
      name: file.name,
      size: file.size,
      arrayBuffer: async () => buffer,
    })
    if (!workbook.sheets.length) throw new Error('工作簿没有可读取的工作表。')
    return workbookTable(file, workbook, workbook.sheets[0].name, expandedBytes, id)
  }
  if (!/\.csv$/i.test(file.name)) throw new Error('请选择 CSV 或 XLSX 文件。')
  const decoded = await readTextFile(file, encoding),
    parsed = parseCsvMatrix(decoded.text, tableLimits.maxChars)
  const [raw = [], ...rows] = parsed.rows
  const notices = [...parsed.notices]
  return {
    id: id ?? crypto.randomUUID(),
    name: file.name,
    file,
    expandedBytes: 0,
    encoding: decoded.encoding,
    headers: inputHeaders(raw, notices),
    rows,
    notices,
  }
}

export function validateInputTables(tables: InputTable[]) {
  if (tables.reduce((sum, table) => sum + table.rows.length, 0) > 200_000)
    throw new Error('本批输入超过 20 万行，请减少文件数量。')
  if (
    tables.reduce((sum, table) => sum + table.rows.length * table.headers.length, 0) >
    tableLimits.maxCells
  )
    throw new Error('本批输入超过 100 万格，请减少文件或字段。')
  if (tables.reduce((sum, table) => sum + table.expandedBytes, 0) > excelLimits.maxUnzipBytes)
    throw new Error('本批 XLSX 解压总量超过 256 MB，请减少工作簿数量。')
}
