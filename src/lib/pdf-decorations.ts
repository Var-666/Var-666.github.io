export async function createPdfWatermark(text: string) {
  if (!text.trim()) return undefined
  if (text.length > 80) throw new Error('水印最多 80 字符。')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法创建水印画布。')
  context.font = '48px sans-serif'
  canvas.width = Math.min(4096, Math.max(1, Math.ceil(context.measureText(text).width) + 48))
  canvas.height = 96
  try {
    context.font = '48px sans-serif'
    context.fillStyle = '#444'
    context.textBaseline = 'middle'
    context.fillText(text, 24, 48, canvas.width - 48)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('无法生成水印。'))),
        'image/png',
      ),
    )
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    canvas.width = canvas.height = 0
  }
}
