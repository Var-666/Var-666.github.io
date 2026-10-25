// FileTool 队列行的共享类型与工具
import type { OutputFile } from '@/lib/file-convert'
import type { ConvertReport } from '@/lib/convert-report'

export type Row = {
  id: string
  file: File
  status: 'waiting' | 'working' | 'done' | 'error'
  message?: string
  output?: OutputFile & { url: string }
  report?: ConvertReport
  detail?: { kind: 'pdf'; file: File } | { kind: 'text'; text: string }
  showDetail?: boolean
  /** 转换过程中的处理说明（如表头改名），随成功结果展示 */
  notices?: string[]
}

export const sizeLabel = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`
