import type { PDFDocument } from 'pdf-lib'

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
      throw new Error('暂不支持加密 PDF，请解密后重试。', { cause: error })
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

export async function organizePdf(sources: Map<string, PDFDocument>, pages: PdfPageEntry[]) {
  const selected = pages.filter((page) => page.selected)
  if (!selected.length || selected.length > 100) throw new Error('请选择 1–100 页后导出。')
  const { PDFDocument, degrees } = await import('pdf-lib')
  const output = await PDFDocument.create()
  for (const page of selected) {
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
    copy.setRotation(degrees((copy.getRotation().angle + page.rotation) % 360))
    output.addPage(copy)
  }
  const bytes = await output.save({ addDefaultPage: false })
  if (bytes.length > 100 * 1024 * 1024) throw new Error('输出超过 100 MB，请减少页面数量。')
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
}
