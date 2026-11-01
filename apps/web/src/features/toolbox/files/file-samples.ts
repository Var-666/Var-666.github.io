/**
 * 「载入示例」数据：与 table-samples.ts 同一模式——包装成 File 交给
 * addFiles，走既有校验/队列管线，不绕过任何现有逻辑。
 * 图片无法像 CSV 那样用文本常量构造，改用 Canvas 在点击时运行时生成
 * 两张 320×200 的小 PNG（toBlob 导出）；只在浏览器事件回调里执行，SSR 不会触达。
 */

/** 用 Canvas 画一张 320×200 示例图：双色渐变背景 + 居中文字，导出 PNG Blob */
function renderSamplePng(label: string, from: string, to: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 200
    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('当前浏览器不支持 Canvas'))
      return
    }
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, from)
    gradient.addColorStop(1, to)
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.font = '600 28px system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, canvas.width / 2, canvas.height / 2)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('生成示例图片失败'))),
      'image/png',
    )
  })
}

/** 图片类模式示例：两张不同配色的示例 PNG（画内文字与文件名对应） */
export async function sampleImageFiles(): Promise<File[]> {
  const [a, b] = await Promise.all([
    renderSamplePng('示例图片 A', '#0071e3', '#0a2f5c'),
    renderSamplePng('示例图片 B', '#1a7f37', '#0a3d1e'),
  ])
  return [
    new File([a], '示例-风景.png', { type: 'image/png' }),
    new File([b], '示例-合影.png', { type: 'image/png' }),
  ]
}
