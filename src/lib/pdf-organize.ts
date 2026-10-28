import type { PDFDocument } from 'pdf-lib'

export class EncryptedPdfError extends Error {}
export type PdfOutputOptions = {
  numbering?: { start: number }
  watermark?: { bytes: Uint8Array; opacity: number }
}

export type PdfPageEntry = {
  id: string
  sourceId: string
  index: number
  rotation: number
  selected: boolean
}

export async function loadOrganizablePdf(bytes: Uint8Array) {
  const { PDFDocument, PDFName, PDFDict } = await import('pdf-lib')
  let document: PDFDocument
  try {
    document = await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message))
      throw new EncryptedPdfError('PDF 已加密，请输入打开密码解密后再导入。', { cause: error })
    throw new Error('无法读取 PDF，请检查文件是否损坏。', { cause: error })
  }
  if (!document.getPageCount() || document.getPageCount() > 100)
    throw new Error('单个 PDF 需要有 1–100 页。')
  const form = document.getForm()
  if (
    form.hasXFA() ||
    form.getFields().length ||
    document.catalog.has(PDFName.of('Perms')) ||
    document.getPages().some((page) => {
      const annotations = page.node.Annots()
      return annotations?.asArray().some((ref) => {
        const annotation = document.context.lookup(ref)
        return (
          annotation instanceof PDFDict &&
          annotation.get(PDFName.of('Subtype')) === PDFName.of('Widget')
        )
      })
    })
  )
    throw new Error('暂不支持带表单或数字签名的 PDF，请使用普通 PDF 副本。')
  return document
}

export async function organizePdf(
  sources: Map<string, PDFDocument>,
  pages: PdfPageEntry[],
  options: PdfOutputOptions = {},
) {
  const selected = pages.filter((page) => page.selected)
  if (!selected.length || selected.length > 100) throw new Error('请选择 1–100 页后导出。')
  return buildOrganizedPdf(sources, selected, options)
}

/** 拆分模式：each=每页一个文件；every=每 N 页一个；ranges=按页码段（如 1-3,5） */
export type SplitMode =
  { mode: 'each' } | { mode: 'every'; size: number } | { mode: 'ranges'; ranges: string }

/** 把当前所选页（1-based 位置）切成若干段；段按给定顺序保留，不重排、不合并 */
export function splitSegments(split: SplitMode, total: number): number[][] {
  if (total < 1) throw new Error('没有可拆分的页面，请先选择页面。')
  if (split.mode === 'each') return Array.from({ length: total }, (_, i) => [i + 1])
  if (split.mode === 'every') {
    const size = Math.floor(split.size)
    if (!Number.isFinite(size) || size < 1) throw new Error('每份页数至少为 1。')
    if (size >= total) throw new Error(`每份 ${size} 页不会产生拆分，请输入小于 ${total} 的页数。`)
    const segments: number[][] = []
    for (let start = 1; start <= total; start += size)
      segments.push(Array.from({ length: Math.min(size, total - start + 1) }, (_, i) => start + i))
    return segments
  }
  // 直接按段解析，保留用户给定的段序与边界（pdfPageNumbers 的排序去重会丢失边界）
  const segments: number[][] = []
  const seen = new Set<number>()
  for (const part of split.ranges.split(/[,，]/)) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new Error('页码段格式示例：1-3,4-6；每页恰好属于一段。')
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (start < 1 || end < start || end > total)
      throw new Error(`页码超出范围，请填写 1–${total}。`)
    const segment: number[] = []
    for (let page = start; page <= end; page++) {
      if (seen.has(page)) throw new Error(`第 ${page} 页在页码段中重复出现，每页恰好属于一段。`)
      seen.add(page)
      segment.push(page)
    }
    segments.push(segment)
  }
  if (seen.size !== total)
    throw new Error(`页码段需要恰好覆盖全部 ${total} 页，当前覆盖 ${seen.size} 页。`)
  return segments
}

/** 按段导出多份 PDF；段内保持当前排序与旋转 */
export async function organizePdfSegments(
  sources: Map<string, PDFDocument>,
  selected: PdfPageEntry[],
  segments: number[][],
  options: PdfOutputOptions = {},
): Promise<{ name: string; blob: Blob; pages: number }[]> {
  if (segments.length < 1 || segments.length > 100) throw new Error('拆分份数需要在 1–100 之间。')
  const outputs: { name: string; blob: Blob; pages: number }[] = []
  for (const [index, segment] of segments.entries()) {
    const entries = segment.map((position) => selected[position - 1])
    if (entries.some((entry) => !entry)) throw new Error('页码段超出所选页面范围。')
    const blob = await buildOrganizedPdf(sources, entries, options)
    outputs.push({
      name: `拆分-${String(index + 1).padStart(2, '0')}.pdf`,
      blob,
      pages: segment.length,
    })
  }
  return outputs
}

async function buildOrganizedPdf(
  sources: Map<string, PDFDocument>,
  selected: PdfPageEntry[],
  options: PdfOutputOptions,
) {
  const { PDFDocument, degrees, StandardFonts, rgb } = await import('pdf-lib')
  const output = await PDFDocument.create()
  if (
    options.numbering &&
    (!Number.isInteger(options.numbering.start) ||
      options.numbering.start < 1 ||
      options.numbering.start > 99999)
  )
    throw new Error('起始页码请填写 1–99999 的整数。')
  if (
    options.watermark &&
    (options.watermark.bytes.length > 1_000_000 ||
      !Number.isFinite(options.watermark.opacity) ||
      options.watermark.opacity < 0.1 ||
      options.watermark.opacity > 0.8)
  )
    throw new Error('水印大小或不透明度无效。')
  const font = options.numbering ? await output.embedFont(StandardFonts.Helvetica) : null
  const watermark = options.watermark ? await output.embedPng(options.watermark.bytes) : null
  for (const [index, page] of selected.entries()) {
    const source = sources.get(page.sourceId)
    if (
      !source ||
      !Number.isInteger(page.index) ||
      page.index < 0 ||
      page.index >= source.getPageCount() ||
      ![0, 90, 180, 270].includes(page.rotation)
    )
      throw new Error('页面信息无效，请重新添加文件。')
    const [copy] = await output.copyPages(source, [page.index])
    copy.setRotation(degrees((((copy.getRotation().angle + page.rotation) % 360) + 360) % 360))
    output.addPage(copy)
    const box = copy.getCropBox(),
      rotation = copy.getRotation().angle
    const width = rotation % 180 ? box.height : box.width,
      height = rotation % 180 ? box.width : box.height
    const point = (x: number, y: number) =>
      rotation === 90
        ? { x: box.x + box.width - y, y: box.y + x }
        : rotation === 180
          ? { x: box.x + box.width - x, y: box.y + box.height - y }
          : rotation === 270
            ? { x: box.x + y, y: box.y + box.height - x }
            : { x: box.x + x, y: box.y + y }
    if (font && options.numbering) {
      const text = String(options.numbering.start + index),
        size = Math.min(11, width / Math.max(4, text.length), height / 12)
      const position = point(
        (width - font.widthOfTextAtSize(text, size)) / 2,
        Math.min(18, height / 12),
      )
      copy.drawText(text, {
        ...position,
        size,
        font,
        rotate: degrees(rotation),
        color: rgb(0.3, 0.3, 0.3),
      })
    }
    if (watermark && options.watermark) {
      const w = Math.min(width * 0.7, height * 1.4),
        h = (w * watermark.height) / watermark.width
      const angle = Math.PI / 6
      const position = point(
        width / 2 - (w * Math.cos(angle) - h * Math.sin(angle)) / 2,
        height / 2 - (w * Math.sin(angle) + h * Math.cos(angle)) / 2,
      )
      copy.drawImage(watermark, {
        ...position,
        width: w,
        height: h,
        rotate: degrees(rotation + 30),
        opacity: options.watermark.opacity,
      })
    }
  }
  const bytes = await output.save({ addDefaultPage: false })
  if (bytes.length > 100 * 1024 * 1024) throw new Error('输出超过 100 MB，请减少页面数量。')
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
}
