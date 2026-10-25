// Word / PDF 互转的结果报告与结构校验：纯函数部分可独立测试，
// 校验用已有依赖（pdf-lib 重新打开 PDF、fflate 检查 DOCX zip 结构）。
export type ReportIssue = { level: 'info' | 'warning'; text: string }
export type ReportStatus = 'ok' | 'notes' | 'preview-error'
export type Metric = { label: string; value: string }
export type ConvertReport = { status: ReportStatus; issues: ReportIssue[]; metrics: Metric[] }

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** 重新打开生成的 PDF：能被现有解析器读取且页数大于零才算有效 */
export async function verifyPdfBlob(blob: Blob): Promise<{ ok: boolean; pages: number }> {
  if (!blob.size) return { ok: false, pages: 0 }
  try {
    const { PDFDocument } = await import('pdf-lib')
    const document = await PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false })
    const pages = document.getPageCount()
    return { ok: pages > 0, pages }
  } catch {
    return { ok: false, pages: 0 }
  }
}

/** 生成的 DOCX 必须是有效 zip 且包含 word/document.xml */
export async function verifyDocxBlob(blob: Blob): Promise<boolean> {
  if (!blob.size) return false
  try {
    const { unzipSync } = await import('fflate')
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    return Object.hasOwn(entries, 'word/document.xml')
  } catch {
    return false
  }
}

/** DOCX → PDF 的质量报告：文件有效性与「文字可搜索」是两个独立事实，分别说明 */
export function wordToPdfReport(input: {
  pages: number
  sections: number
  failedSections: number
  bytes: number
  verify: { ok: boolean; pages: number }
}): ConvertReport {
  const issues: ReportIssue[] = [
    {
      level: 'info',
      text: '输出为图片型 PDF：适合浏览与视觉交付，文字无法直接选择、复制或搜索。',
    },
  ]
  let status: ReportStatus = 'ok'
  if (input.failedSections > 0) {
    status = 'notes'
    issues.push({
      level: 'warning',
      text: `有 ${input.failedSections} 个文档分节渲染失败，输出可能缺少对应内容，请核对页数。`,
    })
  }
  if (!input.verify.ok) {
    status = 'notes'
    issues.push({
      level: 'warning',
      text: '输出 PDF 未能通过重新打开校验，请下载后确认能否正常查看。',
    })
  } else if (input.verify.pages !== input.pages) {
    status = 'notes'
    issues.push({
      level: 'warning',
      text: `转换记录为 ${input.pages} 页，重新校验读到 ${input.verify.pages} 页，请核对内容。`,
    })
  }
  return {
    status,
    issues,
    metrics: [
      { label: 'PDF 页数', value: `${input.pages} 页` },
      { label: '文件大小', value: formatSize(input.bytes) },
      { label: '文档分节', value: `${input.sections} 个` },
    ],
  }
}

/** PDF → DOCX 的质量报告：明确这是文字提取，不承诺还原排版 */
export function pdfToWordReport(input: {
  pages: number
  chars: number
  paragraphs: number
  bytes: number
  docxValid: boolean
}): ConvertReport {
  const issues: ReportIssue[] = [
    {
      level: 'info',
      text: '已提取 PDF 中的文字生成 Word：不保留图片、表格与原始排版，请核对关键内容。',
    },
  ]
  let status: ReportStatus = 'ok'
  if (!input.docxValid) {
    status = 'notes'
    issues.push({
      level: 'warning',
      text: '生成的 DOCX 未能通过结构校验，请下载后确认能否正常打开。',
    })
  }
  return {
    status,
    issues,
    metrics: [
      { label: '提取字符', value: input.chars.toLocaleString() },
      { label: '段落数', value: input.paragraphs.toLocaleString() },
      { label: 'PDF 页数', value: `${input.pages} 页` },
      { label: '文件大小', value: formatSize(input.bytes) },
    ],
  }
}

export const previewFailureIssue: ReportIssue = {
  level: 'info',
  text: '结果预览生成失败，转换文件本身已生成，可正常下载后查看。',
}
