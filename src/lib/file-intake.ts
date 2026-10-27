import type { Mode } from '@/file-tool/modes'
import type { NewTransfer } from './tool-transfer'

export type FileKind =
  'image' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'tsv' | 'markdown' | 'json' | 'text' | 'unknown'
export type IdentifiedFile = { file: File; kind: FileKind; extension: string; note?: string }
export type IntakeTask = {
  id: string
  title: string
  target: NewTransfer['target']
  mode?: Mode
  preset?: NewTransfer['preset']
  maxFiles: number
  maxSingleMb: number
  maxTotalMb: number
}
const textKinds: FileKind[] = ['text', 'markdown', 'csv', 'tsv', 'json']
const kindLabels: Record<FileKind, string> = {
  image: '图片',
  pdf: 'PDF',
  docx: 'Word',
  xlsx: 'Excel',
  csv: 'CSV',
  tsv: 'TSV',
  markdown: 'Markdown',
  json: 'JSON',
  text: '文本',
  unknown: '未识别',
}
export const fileKindLabel = (kind: FileKind) => kindLabels[kind]

export function validateIntakeFiles(files: File[]) {
  if (!files.length) throw new Error('请选择文件。')
  if (files.length > 100 || files.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024)
    throw new Error('一次最多选择 100 个文件、总计 100 MB。')
}

export async function identifyFile(file: File): Promise<IdentifiedFile> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
  const ascii = new TextDecoder('latin1').decode(head)
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  let kind: FileKind = 'unknown',
    detected = extension
  const starts = (...signature: number[]) => signature.every((byte, index) => head[index] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    kind = 'image'
    detected = 'png'
  } else if (starts(0xff, 0xd8, 0xff)) {
    kind = 'image'
    detected = 'jpg'
  } else if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') {
    kind = 'image'
    detected = 'webp'
  } else if (
    ascii.search(/(?:^|[\r\n])%PDF-\d\.\d/) >= 0 &&
    ascii.search(/(?:^|[\r\n])%PDF-\d\.\d/) <= 1024
  ) {
    kind = 'pdf'
    detected = 'pdf'
  } else if (starts(0x50, 0x4b, 3, 4) && file.size <= 10 * 1024 * 1024) {
    try {
      const { unzipSync } = await import('fflate')
      let total = 0
      const names = new Set<string>()
      unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (entry) => {
          total += entry.originalSize
          names.add(entry.name)
          return false
        },
      })
      if (total > 256 * 1024 * 1024) throw new Error('Archive too large')
      if (names.has('xl/workbook.xml')) {
        kind = 'xlsx'
        detected = 'xlsx'
      } else if (names.has('word/document.xml')) {
        kind = 'docx'
        detected = 'docx'
      }
    } catch {
      /* Unknown archives remain available for renaming, never unpacked here. */
    }
  } else if (
    head.length &&
    !head.includes(0) &&
    !['png', 'jpg', 'jpeg', 'webp', 'pdf', 'docx', 'xlsx'].includes(extension)
  ) {
    let textual = false
    for (const encoding of ['utf-8', 'gb18030']) {
      try {
        new TextDecoder(encoding, { fatal: true }).decode(head, { stream: true })
        textual = true
        break
      } catch {
        /* Try the other supported text encoding. */
      }
    }
    if (textual) {
      kind =
        (
          {
            csv: 'csv',
            tsv: 'tsv',
            md: 'markdown',
            json: 'json',
            jsonl: 'json',
            ndjson: 'json',
            txt: 'text',
          } as Record<string, FileKind>
        )[extension] ?? 'text'
      detected =
        kind === 'json' && ['jsonl', 'ndjson'].includes(extension)
          ? extension
          : (({ markdown: 'md', text: 'txt' } as Record<string, string>)[kind] ?? kind)
    }
  }
  const same = extension === detected || (extension === 'jpeg' && detected === 'jpg')
  return {
    file,
    kind,
    extension: detected,
    ...(!same && kind !== 'unknown'
      ? { note: `按文件内容识别为 ${kindLabels[kind]}，导入时使用 .${detected} 后缀` }
      : {}),
  }
}

export function intakeTasks(files: IdentifiedFile[]): IntakeTask[] {
  if (!files.length) return []
  const all = (...kinds: FileKind[]) => files.every((file) => kinds.includes(file.kind))
  const tasks: IntakeTask[] = []
  const conversion = (id: Mode, title: string, single = 2, maxFiles = 10) =>
    tasks.push({
      id,
      title,
      target: 'files',
      mode: id,
      maxFiles,
      maxSingleMb: single,
      maxTotalMb: 50,
    })
  if (all('image')) {
    conversion('image', '转换图片格式', 20)
    conversion('image-compress', '压缩图片', 20)
    conversion('image-pdf', '图片合成 PDF', 20)
  }
  if (all('pdf')) {
    conversion('pdf-image', 'PDF 转成图片', 10)
    conversion('pdf-word', 'PDF 转成 Word', 10)
    tasks.push({
      id: 'pdf-organize',
      title: '合并、提取、拆分页面',
      target: 'pdf',
      maxFiles: 10,
      maxSingleMb: 20,
      maxTotalMb: 50,
    })
    tasks.push({
      id: 'pdf-text',
      title: '提取文字后整理',
      target: 'text',
      preset: 'pdf',
      maxFiles: 1,
      maxSingleMb: 10,
      maxTotalMb: 10,
    })
  }
  if (all('docx')) conversion('word-pdf', 'Word 转成 PDF', 10)
  if (all('xlsx')) {
    conversion('excel-csv', 'Excel 转 CSV', 10, 1)
    conversion('excel-json', 'Excel 转 JSON', 10, 1)
    conversion('excel-md', 'Excel 转 Markdown', 10, 1)
  }
  if (all('csv')) {
    conversion('csv-json', 'CSV 转 JSON')
    conversion('csv-excel', 'CSV 转 Excel')
    tasks.push({
      id: 'table',
      title: '合并、去重、筛选表格',
      target: 'table',
      maxFiles: 10,
      maxSingleMb: 2,
      maxTotalMb: 50,
    })
  }
  if (all('csv', 'tsv')) conversion('csv-markdown', '表格转 Markdown')
  if (all('csv', 'xlsx'))
    tasks.push({
      id: 'compare',
      title: '比较两份表格差异',
      target: 'compare',
      maxFiles: 2,
      maxSingleMb: 10,
      maxTotalMb: 20,
    })
  if (all('markdown')) {
    conversion('markdown', 'Markdown 转纯文本')
    conversion('markdown-csv', 'Markdown 表格转 CSV')
  }
  if (all('json')) conversion('json-csv', 'JSON 转 CSV')
  if (all(...textKinds))
    tasks.push({
      id: 'text',
      title: files.length > 1 ? '批量整理文本' : '清理与整理文本',
      target: files.length > 1 ? 'text-batch' : 'text',
      preset: files.length > 1 ? undefined : 'clean',
      maxFiles: files.length > 1 ? 20 : 1,
      maxSingleMb: 2,
      maxTotalMb: 20,
    })
  tasks.push({
    id: 'rename',
    title: '批量修改文件名',
    target: 'rename',
    maxFiles: 100,
    maxSingleMb: 100,
    maxTotalMb: 100,
  })
  return tasks
}

export function taskLimit(task: IntakeTask, files: IdentifiedFile[]) {
  if (files.length > task.maxFiles) return `最多 ${task.maxFiles} 个文件`
  const limit = (file: IdentifiedFile) =>
    task.target === 'compare' && file.kind === 'csv' ? 2 : task.maxSingleMb
  if (
    files.some(
      (file) =>
        (task.target !== 'rename' && !file.file.size) || file.file.size > limit(file) * 1024 * 1024,
    )
  )
    return `文件需非空，单个不超过 ${task.target === 'compare' ? 'CSV 2 / Excel 10' : task.maxSingleMb} MB`
  if (files.reduce((sum, file) => sum + file.file.size, 0) > task.maxTotalMb * 1024 * 1024)
    return `总计不超过 ${task.maxTotalMb} MB`
  return ''
}

export function prepareTransfer(task: IntakeTask, files: IdentifiedFile[]): NewTransfer {
  const reason = taskLimit(task, files)
  if (reason) throw new Error(reason)
  return {
    target: task.target,
    mode: task.mode,
    preset: task.preset,
    files: files.map(({ file, extension }) => {
      if (task.target === 'rename') return file
      const desired =
        (task.target === 'text' || task.target === 'text-batch') && task.id !== 'pdf-text'
          ? /\.md$/i.test(file.name)
            ? 'md'
            : 'txt'
          : extension
      if (
        file.name.toLowerCase().endsWith('.' + desired) ||
        (desired === 'jpg' && /\.jpeg$/i.test(file.name))
      )
        return file
      const name = file.name || '文件'
      return new File([file], `${name}.${desired}`, {
        type: file.type,
        lastModified: file.lastModified,
      })
    }),
  }
}
