/**
 * 「载入示例」数据：与 table-samples.ts / file-samples.ts 同一模式——
 * 运行时用 pdf-lib 生成一份 3 页 A4 小 PDF（封面 + 两页正文），包装成 File
 * 交给 addFiles，走既有校验/读取管线，不绕过任何现有逻辑。
 * pdf-lib 内置 StandardFonts 只支持 WinAnsi 字符集，画布文字用英文；
 * 中文仅用于文件名，不影响页面内容。只在浏览器事件回调里执行，SSR 不会触达。
 */

/** 与 PdfTool 空白页一致的 A4 尺寸 */
const A4: [number, number] = [595.28, 841.89]

/** 生成「示例文档.pdf」：封面 + 两页正文（标题与灰色占位条，版式对齐设计源 samplePdfs） */
export async function samplePdfFile(): Promise<File> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const document = await PDFDocument.create()
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const ink = rgb(0.11, 0.11, 0.12)
  const mute = rgb(0.45, 0.45, 0.5)
  const bar = rgb(0.9, 0.9, 0.92)
  const cover = document.addPage(A4)
  cover.drawText('Sample Document', { x: 48, y: A4[1] - 120, size: 30, font: bold, color: ink })
  cover.drawText('PDF tool sample · cover + 2 pages', {
    x: 48,
    y: A4[1] - 148,
    size: 12,
    font: regular,
    color: mute,
  })
  for (let index = 0; index < 6; index++)
    cover.drawRectangle({
      x: 48,
      y: A4[1] - 220 - index * 26,
      width: (A4[0] - 96) * (index % 3 === 2 ? 0.6 : 1),
      height: 8,
      color: bar,
    })
  for (let number = 0; number < 2; number++) {
    const body = document.addPage(A4)
    body.drawText(`Sample Document · ${number + 2}`, {
      x: 48,
      y: A4[1] - 80,
      size: 22,
      font: bold,
      color: ink,
    })
    for (let index = 0; index < 8; index++)
      body.drawRectangle({
        x: 48,
        y: A4[1] - 130 - index * 26,
        width: (A4[0] - 96) * (index % 3 === 2 ? 0.6 : 1),
        height: 8,
        color: bar,
      })
  }
  return new File([(await document.save()) as Uint8Array<ArrayBuffer>], '示例文档.pdf', {
    type: 'application/pdf',
  })
}
