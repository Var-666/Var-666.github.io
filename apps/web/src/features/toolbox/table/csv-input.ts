import { parseCsvMatrix } from '../files/file-excel'
import { uniqueHeaders } from '../files/file-text'
import { readTextFile, type TextEncoding, type DecodedText } from '../lib/text-encoding'
import { tableLimits } from './table-process'

export function inputHeaders(raw: string[], notices: string[]) {
  const headers = uniqueHeaders(raw, notices)
  if (headers.some((header) => header.length > tableLimits.maxHeaderChars))
    throw new Error('列名超过 512 字符，请先缩短表头。')
  return headers
}

export type CsvTable = {
  headers: string[]
  rows: string[][]
  notices: string[]
  encoding: DecodedText['encoding']
}
export type CsvWorkerMessage =
  { rows: string[][] } | { result: Omit<CsvTable, 'rows'> } | { error: string }

export async function readCsvTable(file: File, encoding: TextEncoding): Promise<CsvTable> {
  const decoded = await readTextFile(file, encoding)
  const parsed = parseCsvMatrix(decoded.text, tableLimits.maxChars)
  const [raw = [], ...rows] = parsed.rows
  const notices = [...parsed.notices]
  return { headers: inputHeaders(raw, notices), rows, notices, encoding: decoded.encoding }
}
