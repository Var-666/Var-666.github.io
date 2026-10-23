import { findWhitespaceCut } from './page-break'

export type OutputFile = { blob: Blob; name: string }
export const outputName = (name: string, extension: string) =>
  `${name.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, '') || '转换结果'}.${extension}`

export async function convertImage(
  file: File,
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
): Promise<OutputFile> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('无法读取图片，请检查文件是否损坏或格式是否正确。')
  })
  try {
    if (bitmap.width * bitmap.height > 24_000_000)
      throw new Error('图片超过 2400 万像素，请先缩小尺寸。')
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建图片画布。')
    if (format === 'jpeg') {
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(bitmap, 0, 0)
    const mime = `image/${format}`
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value?.type === mime ? resolve(value) : reject(new Error('当前浏览器不支持此输出格式。')),
        mime,
        quality,
      ),
    )
    canvas.width = 0
    canvas.height = 0
    return { blob, name: outputName(file.name, format === 'jpeg' ? 'jpg' : format) }
  } finally {
    bitmap.close()
  }
}

export async function pdfToWord(
  file: File,
  progress: (message: string) => void,
): Promise<OutputFile> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    enableXfa: false,
    useSystemFonts: true,
    cMapUrl: `${import.meta.env.BASE_URL}pdf-assets/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdf-assets/standard_fonts/`,
  })
  try {
    const pdf = await task.promise
    if (pdf.numPages > 50) throw new Error('一次最多转换 50 页 PDF，请先拆分。')
    const { Document, Packer, Paragraph, PageBreak, TextRun } = await import('docx')
    const paragraphs = []
    let total = 0
    let emptyPages = 0
    for (let page = 1; page <= pdf.numPages; page++) {
      progress(`正在提取第 ${page} / ${pdf.numPages} 页`)
      const pdfPage = await pdf.getPage(page)
      const content = await pdfPage.getTextContent()
      let line = ''
      let pageText = ''
      if (page > 1) paragraphs.push(new Paragraph({ children: [new PageBreak()] }))
      for (const item of content.items) {
        if (!('str' in item)) continue
        line += item.str
        if (item.hasEOL) {
          pageText += `${line}\n`
          line = ''
        } else if (item.str && !/\s$/.test(item.str)) line += ' '
      }
      pageText += line
      if (!pageText.trim()) emptyPages++
      for (const value of pageText.split('\n'))
        paragraphs.push(new Paragraph({ children: [new TextRun(value)] }))
      total += pageText.trim().length
      if (total > 1_000_000) throw new Error('PDF 文字量超过 100 万字符，请拆分后转换。')
      pdfPage.cleanup()
    }
    if (!total) throw new Error('没有找到可提取的文字。这可能是扫描件，需要先进行 OCR 识别。')
    if (emptyPages)
      throw new Error(
        `有 ${emptyPages} 页没有可提取文字，可能含扫描页。为避免遗漏，请先用 OCR 处理后再转换。`,
      )
    const blob = await Packer.toBlob(new Document({ sections: [{ children: paragraphs }] }))
    return { blob, name: outputName(file.name, 'docx') }
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error('PDF 已加密，请解密后重试。')
    throw error
  } finally {
    await task.destroy()
  }
}

// shortcut: PDF pages are images; use a document layout engine when selectable text is required.
export async function wordToPdf(
  file: File,
  progress: (message: string) => void,
): Promise<OutputFile> {
  const [{ renderAsync }, { default: html2canvas }, { jsPDF }, { unzipSync }] = await Promise.all([
    import('docx-preview'),
    import('html2canvas'),
    import('jspdf'),
    import('fflate'),
  ])
  const data = new Uint8Array(await file.arrayBuffer())
  // Bound decompression before the renderer reads the archive.
  let expanded = 0
  let documentFound = false
  try {
    unzipSync(data, {
      filter(entry) {
        expanded += entry.originalSize
        if (expanded > 60_000_000 || entry.originalSize > 30_000_000)
          throw new Error('文档解压后过大，请减少图片或拆分文档。')
        if (entry.name === 'word/document.xml') documentFound = true
        return false
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('解压后过大')) throw error
    throw new Error('无法读取 DOCX，请检查文件是否损坏或已加密。')
  }
  if (!documentFound) throw new Error('文件不是有效的 DOCX 文档。旧版 .doc 请先另存为 .docx。')
  const frame = document.createElement('iframe')
  frame.title = '文档转换渲染区'
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.setAttribute('sandbox', 'allow-same-origin')
  frame.style.cssText =
    'position:fixed;left:-12000px;top:0;width:1000px;height:1400px;border:0;pointer-events:none'
  const loaded = new Promise<void>((resolve) => {
    frame.onload = () => resolve()
  })
  frame.srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src blob: data:; font-src blob: data:"><style>body{margin:0;color:#000;background:white}*{box-sizing:border-box}</style></head><body></body></html>`
  document.body.append(frame)
  try {
    await loaded
    const doc = frame.contentDocument
    if (!doc) throw new Error('浏览器阻止了文档渲染。')
    progress('正在读取 Word 文档')
    await renderAsync(data, doc.body, undefined, {
      inWrapper: false,
      useBase64URL: true,
      renderAltChunks: false,
      ignoreLastRenderedPageBreak: false,
      experimental: false,
    })
    // Fallback spacing keeps CJK glyphs inside cells when the source has no cell margins.
    const spacing = doc.createElement('style')
    spacing.textContent =
      'section.docx td p,section.docx th p{line-height:1.5}section.docx td,section.docx th{padding:4px 6px}'
    doc.head.append(spacing)
    await doc.fonts.ready
    await Promise.all(Array.from(doc.images).map((image) => image.decode().catch(() => undefined)))
    const sections = Array.from(doc.querySelectorAll<HTMLElement>('section.docx'))
    if (!sections.length || sections.length > 50) throw new Error('文档为空或超过 50 个分页。')
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    let pageCount = 0
    for (let i = 0; i < sections.length; i++) {
      progress(`正在渲染第 ${i + 1} / ${sections.length} 个文档分节`)
      const section = sections[i]
      const width = section.offsetWidth
      const height = section.scrollHeight
      if (!width || width * height > 12_000_000 || height > 16000)
        throw new Error('文档单个分节过长，请在 Word 中添加分页后再转换。')
      const canvas = await html2canvas(section, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: false,
        imageTimeout: 2000,
        height,
      })
      const pageHeight = Math.round((canvas.width * 841.89) / 595.28)
      const sourceContext = canvas.getContext('2d')
      if (!sourceContext) throw new Error('无法读取 PDF 渲染页面。')
      for (let y = 0; y < canvas.height;) {
        let sliceHeight = Math.min(pageHeight, canvas.height - y)
        if (y + pageHeight < canvas.height) {
          const scanHeight = Math.min(80, pageHeight - 1)
          const band = sourceContext.getImageData(
            0,
            y + pageHeight - scanHeight,
            canvas.width,
            scanHeight,
          )
          // shortcut: images and ruled tables may have no blank row; use layout-aware pagination for those.
          const cut = findWhitespaceCut(band.data, canvas.width, scanHeight)
          if (cut !== null) sliceHeight = pageHeight - scanHeight + cut
        }
        if (++pageCount > 50) throw new Error('转换结果超过 50 页，请拆分文档。')
        if (pageCount > 1) pdf.addPage()
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = sliceHeight
        const context = slice.getContext('2d')
        if (!context) throw new Error('无法创建 PDF 页面。')
        context.drawImage(canvas, 0, y, slice.width, slice.height, 0, 0, slice.width, slice.height)
        pdf.addImage(
          slice.toDataURL('image/jpeg', 0.94),
          'JPEG',
          0,
          0,
          595.28,
          (slice.height * 595.28) / slice.width,
        )
        y += sliceHeight
        slice.width = 0
        slice.height = 0
      }
      canvas.width = 0
      canvas.height = 0
    }
    return { blob: pdf.output('blob'), name: outputName(file.name, 'pdf') }
  } finally {
    frame.remove()
  }
}
