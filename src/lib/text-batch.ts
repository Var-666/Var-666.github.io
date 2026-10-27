import { readTextFile, type TextEncoding, type DecodedText } from './text-encoding'
// 批量文本文件处理：多份 TXT/MD 顺序应用当前整理规则。
// 单文件的错误（过大、编码无效、超字符上限）只标记该文件，不中断其余文件。
import { processText, type Options, type ProcessResult } from './text'

export const batchTextLimits = {
  maxFiles: 20,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxChars: 1_000_000,
} as const

export type BatchTextStatus = 'waiting' | 'working' | 'done' | 'error'

export type BatchTextItem = {
  id: string
  name: string
  status: BatchTextStatus
  originalBytes: number
  resultBytes?: number
  result?: string
  changeCount?: number
  encoding?: DecodedText['encoding']
  message?: string
}

/** 校验新增批量文件的数量与总量；单文件大小延后到处理时按项报错 */
export function validateBatchTextFiles(
  existingCount: number,
  incoming: Pick<File, 'name' | 'size'>[],
): void {
  if (!incoming.length) return
  if (existingCount + incoming.length > batchTextLimits.maxFiles)
    throw new Error(`一次最多处理 ${batchTextLimits.maxFiles} 个文件。`)
  const total = incoming.reduce((sum, file) => sum + file.size, 0)
  if (total > batchTextLimits.maxTotalBytes)
    throw new Error(
      `新增文件合计超过 ${batchTextLimits.maxTotalBytes / 1024 / 1024} MB，请减少数量。`,
    )
}

export function batchTextOutputName(name: string): string {
  const base = name.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, '') || '文本'
  return `${base}-整理.txt`
}

export async function processBatchTextFiles(
  files: Pick<File, 'name' | 'size' | 'arrayBuffer'>[],
  options: Options,
  hooks: {
    onStart: (id: string) => void
    onDone: (
      id: string,
      result: ProcessResult,
      originalBytes: number,
      encoding: DecodedText['encoding'],
    ) => void
    onError: (id: string, message: string) => void
  },
  encoding: TextEncoding = 'auto',
): Promise<{ done: number; failed: number }> {
  let done = 0
  let failed = 0
  for (const [index, file] of files.entries()) {
    const id = `batch-${index}`
    hooks.onStart(id)
    // 让出主线程，逐文件刷新状态
    await new Promise((resolve) => setTimeout(resolve, 0))
    try {
      if (file.size > batchTextLimits.maxFileBytes)
        throw new Error(`单个文件不超过 ${batchTextLimits.maxFileBytes / 1024 / 1024} MB。`)
      const decoded = await readTextFile(file, encoding)
      const text = decoded.text
      if (text.length > batchTextLimits.maxChars)
        throw new Error(`超过 ${batchTextLimits.maxChars / 10000} 万字符上限，请拆分文件。`)
      const result = processText(text, options)
      done++
      hooks.onDone(id, result, file.size, decoded.encoding)
    } catch (error) {
      failed++
      hooks.onError(
        id,
        error instanceof Error
          ? error instanceof TypeError
            ? '读取失败，请检查文件编码。'
            : error.message
          : '处理失败。',
      )
    }
  }
  return { done, failed }
}
