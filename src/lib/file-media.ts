import { openPdf, outputName, type OutputFile } from './file-convert'
import { pdfPageNumbers, pdfSheetGeometry, type PdfSheetSize } from './media-options'

export type ImagesToPdfOptions = {
  size: PdfSheetSize
  orientation: 'portrait' | 'landscape'
  /** contain=完整显示（留白），cover=填满页面（超出部分在页面边缘外，不可见） */
  fit: 'contain' | 'cover'
}

export const defaultImagesToPdfOptions: ImagesToPdfOptions = {
  size: 'a4',
  orientation: 'portrait',
  fit: 'contain',
}

export async function packOutputs(
  outputs: Iterable<OutputFile>,
  name: string,
): Promise<OutputFile> {
  const { zipSync } = await import('fflate')
  const files: Record<string, Uint8Array> = Object.create(null)
  let bytes = 0
  const parts: OutputFile[] = [],
    used = new Set<string>()
  for (const output of outputs) {
    // fflate flattens names into a plain object, where this key would silently disappear.
    if (output.name === '__proto__') throw new Error('不支持此文件名，请先添加编号或修改名称。')
    bytes += output.blob.size
    if (bytes > 100 * 1024 * 1024) throw new Error('输出超过 100 MB，请减少页数或文件数量。')
    const dot = output.name.lastIndexOf('.'),
      stem = dot > 0 ? output.name.slice(0, dot) : output.name,
      extension = dot > 0 ? output.name.slice(dot) : ''
    let fileName = output.name,
      suffix = 2
    while (used.has(fileName.normalize('NFC').toLowerCase()))
      fileName = `${stem} (${suffix++})${extension}`
    used.add(fileName.normalize('NFC').toLowerCase())
    files[fileName] = new Uint8Array(await output.blob.arrayBuffer())
    parts.push({ ...output, name: fileName })
  }
  const data = zipSync(files, { level: 0 })
  return {
    name,
    blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
    parts,
  }
}

async function canvasBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpeg') {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob?.type === `image/${format}`
          ? resolve(blob)
          : reject(new Error('图片编码失败，请减少尺寸后重试。')),
      `image/${format}`,
      0.92,
    ),
  )
}

export async function pdfToImages(
  file: File,
  options: { pages: string; format: 'png' | 'jpeg'; layout: 'pages' | 'long' },
  progress: (message: string) => void,
): Promise<OutputFile> {
  const task = await openPdf(file)
  const canvas = document.createElement('canvas')
  const combined = document.createElement('canvas')
  try {
    const pdf = await task.promise
    if (pdf.numPages > 50) throw new Error('一次最多读取 50 页 PDF，请先拆分。')
    const numbers = pdfPageNumbers(options.pages, pdf.numPages)
    const dimensions = []
    for (const number of numbers) {
      const page = await pdf.getPage(number)
      const view = page.getViewport({ scale: 2 })
      const width = Math.ceil(view.width)
      const height = Math.ceil(view.height)
      if (width * height > 24_000_000 || Math.max(width, height) > 16384)
        throw new Error('PDF 页面尺寸过大，请缩小页面后重试。')
      dimensions.push({ width, height })
    }
    if (options.layout === 'long') {
      combined.width = Math.max(...dimensions.map((size) => size.width))
      combined.height = dimensions.reduce((sum, size) => sum + size.height, 0)
      if (combined.width * combined.height > 24_000_000 || combined.height > 16384)
        throw new Error('长图超过 2400 万像素或高度 16384 px，请减少页数或改为逐页导出。')
      const context = combined.getContext('2d')
      if (!context) throw new Error('浏览器无法创建长图画布。')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, combined.width, combined.height)
    }
    const outputs: OutputFile[] = []
    const extension = options.format === 'png' ? 'png' : 'jpg'
    let top = 0
    let bytes = 0
    for (const [index, number] of numbers.entries()) {
      progress(`正在渲染第 ${number} 页（${index + 1} / ${numbers.length}）`)
      const page = await pdf.getPage(number)
      canvas.width = dimensions[index].width
      canvas.height = dimensions[index].height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('浏览器无法创建图片画布。')
      await page.render({
        canvas,
        canvasContext: context,
        viewport: page.getViewport({ scale: 2 }),
        background: '#ffffff',
      }).promise
      if (options.layout === 'long') {
        combined
          .getContext('2d')!
          .drawImage(canvas, Math.floor((combined.width - canvas.width) / 2), top)
        top += canvas.height
      } else {
        const blob = await canvasBlob(canvas, options.format)
        bytes += blob.size
        if (bytes > 100 * 1024 * 1024) throw new Error('输出超过 100 MB，请减少页数。')
        outputs.push({ name: outputName(file.name, `page-${number}.${extension}`), blob })
      }
      page.cleanup()
    }
    if (options.layout === 'long')
      return {
        name: outputName(file.name, `long.${extension}`),
        blob: await canvasBlob(combined, options.format),
      }
    return outputs.length === 1
      ? outputs[0]
      : packOutputs(outputs, outputName(file.name, 'images.zip'))
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error('PDF 已加密，请解密后重试。', { cause: error })
    throw error
  } finally {
    canvas.width = canvas.height = combined.width = combined.height = 0
    await task.destroy()
  }
}

export async function imagesToPdf(
  files: File[],
  progress: (message: string) => void,
  options: ImagesToPdfOptions = defaultImagesToPdfOptions,
): Promise<OutputFile> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    unit: 'mm',
    format: options.size,
    orientation: options.orientation,
    compress: true,
  })
  const { widthMm, heightMm } = pdfSheetGeometry(options.size, options.orientation)
  const canvas = document.createElement('canvas')
  try {
    for (const [index, file] of files.entries()) {
      progress(`正在合并第 ${index + 1} / ${files.length} 张图片`)
      const bitmap = await createImageBitmap(file).catch(() => {
        throw new Error(`无法读取图片：${file.name}`)
      })
      try {
        if (bitmap.width * bitmap.height > 24_000_000)
          throw new Error(`${file.name} 超过 2400 万像素，请先缩小。`)
        // shortcut: rasterize photos at 144 DPI cap; use a dedicated archival workflow for print masters.
        const contentWidthMm = widthMm - 20
        const contentHeightMm = heightMm - 20
        const fitScale = Math.min(
          ((contentWidthMm / 25.4) * 144) / bitmap.width,
          ((contentHeightMm / 25.4) * 144) / bitmap.height,
        )
        const fillScale = Math.max(
          ((widthMm / 25.4) * 144) / bitmap.width,
          ((heightMm / 25.4) * 144) / bitmap.height,
        )
        const scale = Math.min(1, options.fit === 'cover' ? fillScale : fitScale)
        canvas.width = Math.max(1, Math.round(bitmap.width * scale))
        canvas.height = Math.max(1, Math.round(bitmap.height * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('浏览器无法创建图片画布。')
        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        if (index) pdf.addPage()
        const pageWidthPx = (widthMm / 25.4) * 72
        const pageHeightPx = (heightMm / 25.4) * 72
        const fit = Math.min(pageWidthPx / canvas.width, pageHeightPx / canvas.height)
        const width = canvas.width * fit
        const height = canvas.height * fit
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.92),
          'JPEG',
          (widthMm - (width * 25.4) / 72) / 2,
          (heightMm - (height * 25.4) / 72) / 2,
          (width * 25.4) / 72,
          (height * 25.4) / 72,
        )
      } finally {
        bitmap.close()
      }
    }
    return { name: '合并图片.pdf', blob: pdf.output('blob') }
  } finally {
    canvas.width = canvas.height = 0
  }
}
