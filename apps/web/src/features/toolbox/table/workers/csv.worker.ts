import { readCsvTable, type CsvWorkerMessage } from '../csv-input'
import type { TextEncoding } from '../../lib/text-encoding'

const send = (message: CsvWorkerMessage) => self.postMessage(message)
self.onmessage = async ({ data }: MessageEvent<{ file: File; encoding: TextEncoding }>) => {
  try {
    const { rows, ...result } = await readCsvTable(data.file, data.encoding)
    // Bound each clone so a million cells do not return as one long main-thread task.
    const batchSize = Math.max(1, Math.floor(20_000 / result.headers.length))
    for (let start = 0; start < rows.length; start += batchSize)
      send({ rows: rows.slice(start, start + batchSize) })
    send({ result })
  } catch (error) {
    send({ error: error instanceof Error ? error.message : 'CSV 读取失败，请检查文件与编码。' })
  }
}
