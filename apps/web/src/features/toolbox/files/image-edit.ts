import { decodeImage } from './image-decode'
import { imageDimensions, type ImageSize } from './media-options'

export type ImageEditOptions = {
  resize: 'preset' | 'percent' | 'exact'
  percent: string
  width: string
  height: string
  rotation: 0 | 90 | 180 | 270
  crop: boolean
  x: string
  y: string
  cropWidth: string
  cropHeight: string
  watermark: string
  opacity: number
}
export const defaultImageEdit: ImageEditOptions = {
  resize: 'preset',
  percent: '100',
  width: '',
  height: '',
  rotation: 0,
  crop: false,
  x: '0',
  y: '0',
  cropWidth: '100',
  cropHeight: '100',
  watermark: '',
  opacity: 20,
}
function number(value: string, min: number, max: number, label: string) {
  const parsed = Number(value)
  if (!value.trim() || !Number.isFinite(parsed) || parsed < min || parsed > max)
    throw new Error(`${label}请填写 ${min}–${max}。`)
  return parsed
}
export function imageGeometry(
  width: number,
  height: number,
  size: ImageSize,
  options = defaultImageEdit,
) {
  const check = (w: number, h: number) => {
    if (
      !Number.isInteger(w) ||
      !Number.isInteger(h) ||
      w < 1 ||
      h < 1 ||
      w > 16384 ||
      h > 16384 ||
      w * h > 24_000_000
    )
      throw new Error('图片尺寸无效或超过 2400 万像素 / 边长 16384。')
  }
  check(width, height)
  if (![0, 90, 180, 270].includes(options.rotation)) throw new Error('旋转角度无效。')
  let x = 0,
    y = 0,
    cropWidth = width,
    cropHeight = height
  if (options.crop) {
    const left = number(options.x, 0, 99.9, '左边距'),
      top = number(options.y, 0, 99.9, '上边距')
    const w = number(options.cropWidth, 0.1, 100, '裁剪宽度'),
      h = number(options.cropHeight, 0.1, 100, '裁剪高度')
    if (left + w > 100 || top + h > 100) throw new Error('裁剪范围超出图片，请调整边距和宽高。')
    x = Math.floor((width * left) / 100)
    y = Math.floor((height * top) / 100)
    cropWidth = Math.min(width - x, Math.max(1, Math.round((width * w) / 100)))
    cropHeight = Math.min(height - y, Math.max(1, Math.round((height * h) / 100)))
  }
  const rotated = options.rotation === 90 || options.rotation === 270
  const baseWidth = rotated ? cropHeight : cropWidth,
    baseHeight = rotated ? cropWidth : cropHeight
  let output = imageDimensions(baseWidth, baseHeight, size)
  if (options.resize === 'percent') {
    const percent = number(options.percent, 0.1, 400, '缩放百分比') / 100
    output = {
      width: Math.max(1, Math.round(baseWidth * percent)),
      height: Math.max(1, Math.round(baseHeight * percent)),
    }
  } else if (options.resize === 'exact') {
    if (!options.width.trim() && !options.height.trim()) throw new Error('请至少填写宽度或高度。')
    const w = options.width.trim() ? number(options.width, 1, 16384, '宽度') : null
    const h = options.height.trim() ? number(options.height, 1, 16384, '高度') : null
    if ((w !== null && !Number.isInteger(w)) || (h !== null && !Number.isInteger(h)))
      throw new Error('像素宽高必须是整数。')
    output = {
      width: w ?? Math.max(1, Math.round((baseWidth * h!) / baseHeight)),
      height: h ?? Math.max(1, Math.round((baseHeight * w!) / baseWidth)),
    }
  } else if (options.resize !== 'preset') throw new Error('缩放方式无效。')
  check(output.width, output.height)
  if (
    options.watermark.length > 80 ||
    !Number.isFinite(options.opacity) ||
    options.opacity < 10 ||
    options.opacity > 80
  )
    throw new Error('水印最多 80 字符，透明度为 10–80%。')
  return { x, y, cropWidth, cropHeight, ...output }
}
export async function prepareImage(file: File, size: ImageSize, options = defaultImageEdit) {
  const bitmap = await decodeImage(file)
  const canvas = document.createElement('canvas')
  try {
    const geometry = imageGeometry(bitmap.width, bitmap.height, size, options)
    canvas.width = geometry.width
    canvas.height = geometry.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建图片画布。')
    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((options.rotation * Math.PI) / 180)
    const rotated = options.rotation === 90 || options.rotation === 270
    const w = rotated ? canvas.height : canvas.width,
      h = rotated ? canvas.width : canvas.height
    context.drawImage(
      bitmap,
      geometry.x,
      geometry.y,
      geometry.cropWidth,
      geometry.cropHeight,
      -w / 2,
      -h / 2,
      w,
      h,
    )
    context.restore()
    if (options.watermark.trim()) {
      const font = Math.min(96, Math.max(12, Math.round(canvas.width * 0.04)))
      context.font = `${font}px sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#333'
      context.globalAlpha = options.opacity / 100
      const step = Math.max(font * 6, context.measureText(options.watermark).width + font * 4)
      for (let y = font; y < canvas.height + font; y += font * 6)
        for (let x = 0; x < canvas.width + step / 2; x += step) {
          context.save()
          context.translate(x, y)
          context.rotate(-Math.PI / 6)
          context.fillText(options.watermark, 0, 0)
          context.restore()
        }
      context.globalAlpha = 1
    }
    return canvas
  } catch (error) {
    canvas.width = canvas.height = 0
    throw error
  } finally {
    bitmap.close()
  }
}
